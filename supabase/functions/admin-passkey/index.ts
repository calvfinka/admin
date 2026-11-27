// supabase/functions/admin-passkey/index.ts
// Edge Function 2FA Passkey (WebAuthn) untuk panel admin GoWithDME.
// Disesuaikan dengan skema asli admin_passkey.sql dan fungsi passkey_ok().
//
// Endpoint (POST, semua wajib header Authorization: Bearer <JWT Supabase>):
//   /options-register  -> buat challenge pendaftaran passkey
//   /verify-register   -> verifikasi, simpan public key, HANGUSKAN grant
//   /options-login     -> buat challenge login (setelah password berhasil)
//   /verify-login      -> verifikasi tanda tangan, tulis admin_mfa_sessions
//   /delete-passkey    -> hapus passkey milik sendiri
//
// Deploy: supabase functions deploy admin-passkey

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@13";
import { isoBase64URL } from "npm:@simplewebauthn/server@13/helpers";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================
// 1. KONFIGURASI
// ============================================================
const RP_ID = "admin.gowithdme.com";          // domain tempat passkey "terikat"
const RP_NAME = "GoWithDME Admin";
const ORIGIN = "https://admin.gowithdme.com"; // origin yang dicek di clientDataJSON
const CHALLENGE_TTL_MS = 5 * 60 * 1000;       // challenge hangus 5 menit
const MFA_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // lolos 2FA berlaku 12 jam

// Nilai kolom `type` di admin_webauthn_challenges. Kalau tabelmu punya CHECK
// constraint dengan nilai lain, ubah di sini.
const CH_REGISTER = "register";
const CH_LOGIN = "login";

// Skema (sesuai hasil query information_schema):
//  admin_passkeys:            id, user_id, credential_id (unik), public_key (text b64url),
//                             counter, transports (array, NOT NULL), device_type,
//                             backed_up (NOT NULL), name (NOT NULL), created_at, last_used_at
//  admin_webauthn_challenges: PK (session_id, type); user_id, challenge, expires_at
//  admin_mfa_sessions:        PK session_id; user_id, passkey_id, verified_at, expires_at
//  admin_passkey_grants:      PK user_id; expires_at   (ada baris = ada izin)
//  admin_security:            id, require_owner_passkey
const T = {
  passkeys: "admin_passkeys",
  challenges: "admin_webauthn_challenges",
  mfa: "admin_mfa_sessions",
  grants: "admin_passkey_grants",
  security: "admin_security",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Client service-role: melewati RLS. HANYA dipakai setelah user terverifikasi.
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ============================================================
// 2. UTILITAS
// ============================================================
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Ambil claim `session_id` dari JWT. Aman membaca payload tanpa verifikasi
// KARENA token sudah divalidasi server lewat auth.getUser() sebelumnya.
// Nilai ini sama dengan auth.jwt()->>'session_id' yang dibaca passkey_ok().
function sessionIdFromJwt(jwt: string): string {
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(isoBase64URL.toBuffer(jwt.split(".")[1])),
    );
    if (payload.session_id) return String(payload.session_id);
  } catch (_) { /* jatuh ke error di bawah */ }
  throw new HttpError(401, "Token tidak memuat session_id.");
}

interface Ctx {
  userId: string;
  email: string;
  sessionId: string;
  userClient: ReturnType<typeof createClient>; // jalan sebagai user (auth.uid() terisi)
}

// ============================================================
// 3. AUTENTIKASI (JWT) + CEK OWNER + GRANT
// ============================================================
async function authenticate(req: Request): Promise<Ctx> {
  const header = req.headers.get("Authorization") ?? "";
  const jwt = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!jwt) throw new HttpError(401, "Authorization header wajib.");

  // getUser(jwt) menanyakan ke server Auth Supabase: token valid, belum
  // kedaluwarsa, dan belum di-logout. Ini yang membuktikan password sudah benar.
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) throw new HttpError(401, "Token tidak valid.");

  // Client atas nama user, supaya is_owner() (pakai auth.uid()) dievaluasi
  // untuk user ini, bukan service role.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  return {
    userId: data.user.id,
    email: data.user.email ?? data.user.id,
    sessionId: sessionIdFromJwt(jwt),
    userClient,
  };
}

async function requireOwner(ctx: Ctx) {
  const { data, error } = await ctx.userClient.rpc("is_owner");
  if (error) throw new HttpError(500, "Gagal memeriksa peran owner.");
  if (data !== true) throw new HttpError(403, "Hanya Pemilik (owner).");
}

// Cek (tanpa menghabiskan) bahwa grant masih ada dan belum kedaluwarsa.
async function requireGrant(ctx: Ctx) {
  const { data, error } = await admin.from(T.grants)
    .select("expires_at").eq("user_id", ctx.userId)
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw new HttpError(500, "Gagal memeriksa izin passkey.");
  if (!data) throw new HttpError(403, "Belum ada izin (grant) untuk mendaftar passkey.");
}

// ============================================================
// 4. CHALLENGE: simpan & pakai-sekali
// ============================================================
// Challenge = angka acak dari server. Browser menandatanganinya dengan private
// key passkey; server lalu mencocokkan. Ini mencegah replay, maka challenge
// HARUS acak, cepat kedaluwarsa, dan hanya sekali pakai.
// Tabel kunci utamanya (session_id, type): satu challenge aktif per sesi per jenis.
async function saveChallenge(ctx: Ctx, challenge: string, type: string) {
  // upsert = challenge lama di sesi yang sama otomatis tertimpa.
  const { error } = await admin.from(T.challenges).upsert({
    session_id: ctx.sessionId,
    type,
    user_id: ctx.userId,
    challenge,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  }, { onConflict: "session_id,type" });
  if (error) throw new HttpError(500, "Gagal menyimpan challenge.");
}

// Ambil challenge lalu HAPUS dalam satu perintah DELETE ... RETURNING (atomik):
// dua request paralel tidak bisa memakai challenge yang sama, dan challenge
// yang sudah dipakai (berhasil maupun gagal) tidak bisa dicoba lagi.
async function consumeChallenge(ctx: Ctx, type: string): Promise<string> {
  const { data, error } = await admin.from(T.challenges).delete()
    .eq("session_id", ctx.sessionId).eq("type", type).eq("user_id", ctx.userId)
    .gt("expires_at", new Date().toISOString())
    .select("challenge");
  if (error) throw new HttpError(500, "Gagal membaca challenge.");
  if (!data || data.length === 0) {
    throw new HttpError(400, "Challenge tidak ada atau kedaluwarsa. Ulangi dari awal.");
  }
  return data[0].challenge as string;
}

// ============================================================
// 5. HANDLER ENDPOINT
// ============================================================

// ---------- /options-register ----------
async function optionsRegister(ctx: Ctx) {
  await requireOwner(ctx);
  await requireGrant(ctx);

  // Passkey yang sudah ada dimasukkan ke excludeCredentials agar perangkat
  // yang sama tidak terdaftar dua kali.
  const { data: existing } = await admin.from(T.passkeys)
    .select("credential_id, transports").eq("user_id", ctx.userId);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: ctx.email,
    userID: new TextEncoder().encode(ctx.userId), // v13: wajib Uint8Array
    attestationType: "none",                      // tak perlu bukti merek perangkat
    excludeCredentials: (existing ?? []).map((p: any) => ({
      id: p.credential_id,                        // v13: string base64url
      transports: p.transports?.length ? p.transports : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",      // Samsung Pass / passkey sinkron
      userVerification: "required",  // wajib sidik jari/PIN/wajah
    },
  });

  await saveChallenge(ctx, options.challenge, CH_REGISTER);
  return options;
}

// ---------- /verify-register ----------
async function verifyRegister(ctx: Ctx, body: any) {
  await requireOwner(ctx);
  await requireGrant(ctx); // pemeriksaan awal; penghangusan atomik ada di bawah
  if (!body?.response) throw new HttpError(400, "Field 'response' wajib.");

  const expectedChallenge = await consumeChallenge(ctx, CH_REGISTER);

  // Verifikasi kriptografi pendaftaran: library memeriksa bahwa
  //  - challenge di clientDataJSON == challenge yang kita simpan,
  //  - origin == ORIGIN dan hash RP ID di authenticatorData == hash RP_ID,
  //  - flag User Verification aktif.
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
  } catch (e) {
    throw new HttpError(400, `Verifikasi pendaftaran gagal: ${(e as Error).message}`);
  }
  if (!verification.verified || !verification.registrationInfo) {
    throw new HttpError(400, "Pendaftaran passkey tidak valid.");
  }

  // v13: data kredensial ada di registrationInfo.credential
  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  // GRANT SEKALI PAKAI: hapus baris grant dan cek hasilnya dalam satu perintah
  // atomik. Kalau dua request paralel membawa grant yang sama, hanya satu yang
  // mendapat baris kembali; yang lain ditolak. Dilakukan SESUDAH verifikasi
  // kriptografi lolos, supaya percobaan gagal tidak menghabiskan grant.
  const nowIso = new Date().toISOString();
  const { data: spent, error: gErr } = await admin.from(T.grants).delete()
    .eq("user_id", ctx.userId).gt("expires_at", nowIso).select("expires_at");
  if (gErr) throw new HttpError(500, "Gagal memakai izin passkey.");
  if (!spent || spent.length === 0) {
    throw new HttpError(403, "Izin (grant) sudah terpakai atau kedaluwarsa.");
  }

  // Yang disimpan hanya PUBLIC KEY (aman bocor). Private key tidak pernah
  // keluar dari perangkat. Public key (Uint8Array, format COSE) diubah ke
  // base64url agar muat di kolom text; saat login diubah balik ke Uint8Array.
  const { error } = await admin.from(T.passkeys).insert({
    user_id: ctx.userId,
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],   // kolom NOT NULL
    device_type: credentialDeviceType,         // 'singleDevice' | 'multiDevice'
    backed_up: credentialBackedUp,             // true = passkey sinkron (Samsung Pass)
    name: String(body.name ?? body.deviceName ?? "Passkey").slice(0, 60),
  });
  if (error) {
    // Penyimpanan gagal: kembalikan grant supaya pemilik bisa mencoba lagi.
    await admin.from(T.grants).upsert(
      { user_id: ctx.userId, expires_at: spent[0].expires_at },
      { onConflict: "user_id" },
    );
    if (error.code === "23505") throw new HttpError(409, "Passkey ini sudah terdaftar.");
    throw new HttpError(500, "Gagal menyimpan passkey.");
  }
  return { ok: true };
}

// ---------- /options-login ----------
async function optionsLogin(ctx: Ctx) {
  await requireOwner(ctx);

  const { data: keys, error } = await admin.from(T.passkeys)
    .select("credential_id, transports").eq("user_id", ctx.userId);
  if (error) throw new HttpError(500, "Gagal membaca passkey.");
  if (!keys || keys.length === 0) throw new HttpError(404, "Belum ada passkey terdaftar.");

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
    allowCredentials: keys.map((k: any) => ({
      id: k.credential_id,
      transports: k.transports?.length ? k.transports : undefined,
    })),
  });

  await saveChallenge(ctx, options.challenge, CH_LOGIN);
  return options;
}

// ---------- /verify-login ----------
async function verifyLogin(ctx: Ctx, body: any) {
  await requireOwner(ctx);
  const resp = body?.response;
  if (!resp?.id) throw new HttpError(400, "Field 'response' wajib.");

  // Cari passkey MILIK user ini berdasarkan credential id dari browser.
  // Filter user_id mencegah memakai passkey orang lain.
  const { data: row, error } = await admin.from(T.passkeys)
    .select("id, credential_id, public_key, counter, transports")
    .eq("user_id", ctx.userId).eq("credential_id", resp.id).maybeSingle();
  if (error) throw new HttpError(500, "Gagal membaca passkey.");
  if (!row) throw new HttpError(400, "Passkey tidak dikenali.");

  const expectedChallenge = await consumeChallenge(ctx, CH_LOGIN);

  // Verifikasi kriptografi login: library memeriksa tanda tangan ECDSA/RSA atas
  // (authenticatorData || hash(clientDataJSON)) memakai PUBLIC KEY tersimpan.
  // Hanya pemegang private key yang bisa membuat tanda tangan itu. Challenge,
  // origin, dan RP ID dicocokkan seperti saat pendaftaran.
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: resp,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: row.credential_id,
        publicKey: isoBase64URL.toBuffer(row.public_key), // base64url -> Uint8Array
        counter: Number(row.counter),
        transports: row.transports?.length ? row.transports : undefined,
      },
    });
  } catch (e) {
    throw new HttpError(401, `Verifikasi login gagal: ${(e as Error).message}`);
  }
  if (!verification.verified) throw new HttpError(401, "Passkey ditolak.");

  // Counter anti-clone: library menolak bila counter baru <= lama (jika keduanya
  // bukan 0). Passkey sinkron seperti Samsung Pass sering selalu 0, itu wajar.
  const now = new Date();
  await admin.from(T.passkeys).update({
    counter: verification.authenticationInfo.newCounter,
    backed_up: verification.authenticationInfo.credentialBackedUp,
    last_used_at: now.toISOString(),
  }).eq("id", row.id);

  // Tandai session Supabase ini LOLOS 2FA. passkey_ok() membaca baris ini:
  //   session_id::text = auth.jwt()->>'session_id' AND user_id = auth.uid()
  //   AND expires_at > now()
  // PK tabel ini = session_id, jadi login ulang di sesi yang sama menimpa baris.
  const { error: mErr } = await admin.from(T.mfa).upsert({
    session_id: ctx.sessionId,
    user_id: ctx.userId,
    passkey_id: row.id,
    verified_at: now.toISOString(),
    expires_at: new Date(now.getTime() + MFA_SESSION_TTL_MS).toISOString(),
  }, { onConflict: "session_id" });
  if (mErr) throw new HttpError(500, "Gagal menyimpan sesi 2FA.");

  return { ok: true, expires_in: MFA_SESSION_TTL_MS / 1000 };
}

// ---------- /delete-passkey ----------
async function deletePasskey(ctx: Ctx, body: any) {
  await requireOwner(ctx);
  const id = String(body?.id ?? "");
  if (!id) throw new HttpError(400, "Field 'id' (id baris passkey) wajib.");

  // Syarat: sesi ini harus SUDAH lolos passkey. Kalau tidak, penyerang yang
  // hanya tahu password bisa menghapus passkey lalu menembus 2FA.
  const { data: mfa } = await admin.from(T.mfa).select("session_id")
    .eq("session_id", ctx.sessionId).eq("user_id", ctx.userId)
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!mfa) throw new HttpError(403, "Verifikasi passkey dulu sebelum menghapus.");

  // Anti-terkunci: bila 2FA wajib menyala, passkey TERAKHIR tidak boleh dihapus.
  const { data: sec } = await admin.from(T.security)
    .select("require_owner_passkey").maybeSingle();
  if (sec?.require_owner_passkey) {
    const { count } = await admin.from(T.passkeys)
      .select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
    if ((count ?? 0) <= 1) {
      throw new HttpError(409, "Passkey terakhir tidak bisa dihapus selama 2FA wajib aktif.");
    }
  }

  // Sesi 2FA yang dibuat dengan passkey ini ikut dicabut (passkey_id mengacu ke sini).
  await admin.from(T.mfa).delete().eq("passkey_id", id).eq("user_id", ctx.userId);

  const { data, error } = await admin.from(T.passkeys).delete()
    .eq("id", id).eq("user_id", ctx.userId).select("id");
  if (error) throw new HttpError(500, "Gagal menghapus passkey.");
  if (!data || data.length === 0) throw new HttpError(404, "Passkey tidak ditemukan.");
  return { ok: true };
}

// ============================================================
// 6. ROUTER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Gunakan POST." }, 405);

  try {
    // Path bisa "/admin-passkey/options-login" atau "/options-login": ambil segmen terakhir.
    const route = new URL(req.url).pathname.split("/").filter(Boolean).pop();

    const ctx = await authenticate(req); // JWT dicek SEBELUM logika WebAuthn apa pun
    const body = await req.json().catch(() => ({}));

    switch (route) {
      case "options-register": return json(await optionsRegister(ctx));
      case "verify-register":  return json(await verifyRegister(ctx, body));
      case "options-login":    return json(await optionsLogin(ctx));
      case "verify-login":     return json(await verifyLogin(ctx, body));
      case "delete-passkey":   return json(await deletePasskey(ctx, body));
      default: return json({ error: "Endpoint tidak dikenal." }, 404);
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("admin-passkey error:", e);
    return json({ error: "Kesalahan server." }, 500);
  }
});
