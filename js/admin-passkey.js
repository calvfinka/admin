/* Passkey (WebAuthn) sebagai langkah kedua login panel admin.
   Berbicara dengan Edge Function Supabase "admin-passkey" (5 endpoint) memakai JWT sesi yang sedang login.
   Dimuat SESUDAH pustaka @simplewebauthn/browser (global SimpleWebAuthnBrowser) dan SEBELUM admin-login.js.
   Penegakan sebenarnya ada di database (passkey_ok() + RLS). Berkas ini hanya mengurus alur di browser. */
(function () {
  "use strict";

  var CFG = window.IB_CONFIG || {};
  var BASE = (CFG.SUPABASE_URL || "") + "/functions/v1/admin-passkey";

  /* MODE UJI: true = tombol "Lewati" tampil di layar langkah kedua (aman selama require_owner_passkey = false).
     Ubah ke false SEBELUM 2FA dinyalakan di database. */
  var ALLOW_SKIP = true;

  /* DEBUG: true = tampilkan pesan asli dari server di bawah pesan galat (untuk mencari masalah). Ubah ke false bila sudah beres. */
  var DEBUG = true;

  var OK_KEY = "adm_pk_ok";     // sesi ini sudah lolos passkey (hanya cache tampilan, per tab)
  var SKIP_KEY = "adm_pk_skip"; // sesi ini memilih lewati (hanya saat ALLOW_SKIP)

  /* ---------- Galat berstatus ---------- */
  function PkError(code, message, status) {
    this.name = "PkError";
    this.code = code;
    this.message = message;
    this.status = status || 0;
  }
  PkError.prototype = Object.create(Error.prototype);

  /* ---------- Pustaka & dukungan perangkat ---------- */
  function lib() { return window.SimpleWebAuthnBrowser || null; }
  function deviceSupported() { return !!window.PublicKeyCredential; }
  function libReady() { return !!(lib() && lib().startAuthentication && lib().startRegistration); }

  /* ---------- Sesi Supabase ---------- */
  function sidFromJwt(token) {
    try {
      var p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return String(JSON.parse(atob(p)).session_id || "");
    } catch (e) { return ""; }
  }

  async function session() {
    if (!window.sb) return null;
    var r = await sb.auth.getSession(); // memperbarui token bila sudah kedaluwarsa
    var s = r && r.data && r.data.session;
    if (!s) return null;
    return { token: s.access_token, sid: sidFromJwt(s.access_token) };
  }

  /* ---------- Cache "sudah lolos" (sessionStorage, hanya untuk tampilan) ---------- */
  function store(key, val) { try { sessionStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function load(key) { try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch (e) { return null; } }
  function verifiedFor(sid) { var v = load(OK_KEY); return !!(sid && v && v.sid === sid && v.exp > Date.now()); }
  function skippedFor(sid) { var v = load(SKIP_KEY); return !!(ALLOW_SKIP && sid && v && v.sid === sid); }
  function remember(sid, seconds) { if (sid) store(OK_KEY, { sid: sid, exp: Date.now() + seconds * 1000 }); }
  function forget() { try { sessionStorage.removeItem(OK_KEY); sessionStorage.removeItem(SKIP_KEY); } catch (e) {} }

  /* ---------- Pesan galat dari server -> kode + teks Indonesia ---------- */
  function fromServer(status, raw) {
    var e = fromServer2(status, raw);
    e.detail = status + ": " + String(raw || "(kosong)");
    return e;
  }
  function fromServer2(status, raw) {
    var m = String(raw || "");
    if (status === 401 && /^(Token|Authorization)/i.test(m))
      return new PkError("session", "Sesi berakhir. Silakan masuk lagi.", status);
    if (status === 401)
      return new PkError("rejected", "Passkey ditolak. Coba lagi atau pakai passkey lain.", status);
    if (status === 403 && /owner|pemilik/i.test(m) && !/grant|izin/i.test(m))
      return new PkError("not_owner", "Passkey hanya untuk akun Pemilik.", status);
    if (status === 403)
      return new PkError("no_grant", "Belum ada izin mendaftar passkey, atau izinnya sudah terpakai/kedaluwarsa. Buat izin baru dari database, lalu coba lagi.", status);
    if (status === 404 && /passkey/i.test(m))
      return new PkError("no_passkey", "Belum ada passkey terdaftar untuk akun ini.", status);
    if (status === 400 && /challenge/i.test(m))
      return new PkError("challenge", "Waktu verifikasi habis. Ketuk tombol lagi untuk mengulang.", status);
    if (status === 409)
      return new PkError("duplicate", "Passkey ini sudah terdaftar.", status);
    if (status >= 500)
      return new PkError("server", "Server sedang bermasalah. Coba lagi sebentar lagi.", status);
    return new PkError("bad_request", "Permintaan gagal. Ulangi dari awal.", status);
  }

  /* ---------- Galat dari browser (prompt biometrik) ---------- */
  function fromBrowser(e) {
    var name = e && e.name, code = e && e.code;
    if (name === "NotAllowedError" || name === "AbortError" || code === "ERROR_CEREMONY_ABORTED")
      return new PkError("cancelled", "Verifikasi dibatalkan atau waktunya habis. Ketuk tombol untuk mencoba lagi.");
    if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || name === "InvalidStateError")
      return new PkError("duplicate", "Perangkat ini sudah punya passkey untuk akun ini.");
    if (name === "SecurityError" || /RP_?ID/i.test(String(code)))
      return new PkError("domain", "Passkey hanya bisa dipakai di admin.gowithdme.com (bukan alamat lain).");
    if (name === "NotSupportedError")
      return new PkError("unsupported", "Perangkat ini tidak mendukung jenis passkey yang diminta.");
    return new PkError("browser", "Passkey gagal dijalankan di perangkat ini. Coba lagi.");
  }

  /* ---------- Panggilan ke Edge Function ---------- */
  async function call(endpoint, body) {
    var s = await session();
    if (!s) throw new PkError("session", "Sesi berakhir. Silakan masuk lagi.", 401);
    var res;
    try {
      res = await fetch(BASE + "/" + endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + s.token,
          "apikey": CFG.SUPABASE_ANON_KEY || ""
        },
        body: JSON.stringify(body || {})
      });
    } catch (e) {
      throw new PkError("network", "Tidak bisa terhubung ke server. Periksa internet lalu coba lagi.");
    }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw fromServer(res.status, data && data.error);
    return data;
  }

  /* ---------- Alur ---------- */

  /* Apa yang dibutuhkan akun ini? "verify" (sudah punya passkey), "register" (owner belum punya), "none" (bukan owner). */
  async function probe() {
    try {
      await call("options-login");
      return "verify";
    } catch (e) {
      if (e.code === "not_owner") return "none";
      if (e.code === "no_passkey") return "register";
      throw e;
    }
  }

  /* Dipanggil saat halaman dibuka dan setelah login password. Hasil: {state}
     nosession | ok | verify | register | error (dengan .error) */
  async function check() {
    var s = await session();
    if (!s) return { state: "nosession" };
    if (verifiedFor(s.sid)) return { state: "ok" };
    if (skippedFor(s.sid)) return { state: "ok", skipped: true };
    var need;
    try { need = await probe(); } catch (e) { return { state: "error", error: e }; }
    if (need === "none") { remember(s.sid, 3600); return { state: "ok" }; } // bukan owner: tak ada langkah kedua
    return { state: need };
  }

  /* Login dengan passkey: options-login -> prompt biometrik -> verify-login. */
  async function verify() {
    if (!deviceSupported()) throw new PkError("no_webauthn", "Perangkat atau browser ini tidak mendukung passkey.");
    if (!libReady()) throw new PkError("no_lib", "Pustaka passkey gagal dimuat. Muat ulang halaman.");
    var options = await call("options-login"); // challenge selalu baru (berlaku 5 menit)
    var assertion;
    try { assertion = await lib().startAuthentication({ optionsJSON: options }); }
    catch (e) { throw fromBrowser(e); }
    var r = await call("verify-login", { response: assertion });
    var s = await session();
    if (s) remember(s.sid, r.expires_in || 43200);
    return r;
  }

  /* Daftar passkey baru (owner, butuh grant sekali pakai): options-register -> prompt -> verify-register. */
  async function register(name) {
    if (!deviceSupported()) throw new PkError("no_webauthn", "Perangkat atau browser ini tidak mendukung passkey.");
    if (!libReady()) throw new PkError("no_lib", "Pustaka passkey gagal dimuat. Muat ulang halaman.");
    var options = await call("options-register");
    var attestation;
    try { attestation = await lib().startRegistration({ optionsJSON: options }); }
    catch (e) { throw fromBrowser(e); }
    return call("verify-register", { response: attestation, name: String(name || "").trim() || "Perangkat ini" });
  }

  /* Hapus passkey (id = kolom id baris di admin_passkeys). Server mewajibkan sesi sudah lolos passkey. */
  function remove(id) { return call("delete-passkey", { id: id }); }

  async function skip() {
    var s = await session();
    if (ALLOW_SKIP && s) store(SKIP_KEY, { sid: s.sid });
  }

  window.AdminPasskey = {
    deviceSupported: deviceSupported,
    libReady: libReady,
    canSkip: function () { return ALLOW_SKIP; },
    check: check,
    verify: verify,
    register: register,
    remove: remove,
    skip: skip,
    forget: forget,
    friendly: function (e) {
      var t = (e && e.message) || "Terjadi kesalahan. Coba lagi.";
      return DEBUG && e && e.detail ? t + " [" + e.detail + "]" : t;
    }
  };
})();
