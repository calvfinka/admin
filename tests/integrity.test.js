/* Pagar pengaman deploy: jalankan  node tests/integrity.test.js  sebelum commit/push.
   Menangkap kesalahan seperti js/admin.js tertimpa berkas dari proyek lain. Tanpa dependensi. */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("GAGAL  " + m); } else console.log("ok     " + m); };

const html = read("index.html");
const srcs = [...html.matchAll(/<script[^>]+src="(js\/[^"?]+)/g)].map((m) => m[1]);
ok(srcs.length > 10, "index.html memuat " + srcs.length + " skrip lokal");
srcs.forEach((s) => ok(fs.existsSync(path.join(root, s)), "berkas ada: " + s));

const admin = fs.existsSync(path.join(root, "js/admin.js")) ? read("js/admin.js") : "";
ok(/window\.admAsk\s*=/.test(admin), "js/admin.js mendefinisikan window.admAsk (dipakai modul lain)");
ok(/VIEW_TITLES/.test(admin) && /function go\(/.test(admin), "js/admin.js memuat VIEW_TITLES dan go() (navigasi panel)");
ok(!/deaSupabase|DEA_ENV|js\/env\.js/.test(admin), "js/admin.js bukan panel pelatihan Dea (tanpa deaSupabase/DEA_ENV)");
ok(admin.length > 12000, "js/admin.js berukuran panel penuh (" + admin.length + " byte, " + admin.split("\n").length + " baris)");

// id elemen yang diminta admin.js harus ada di index.html
const ids = [...new Set([...admin.matchAll(/\$\("([A-Za-z][\w-]*)"\)/g)].map((m) => m[1]))];
const missing = ids.filter((i) => !html.includes('id="' + i + '"'));
ok(!ids.length || missing.length <= ids.length * 0.2, "id yang dicari admin.js ada di index.html (hilang: " + (missing.slice(0, 6).join(", ") || "-") + ")");

const cfg = read("js/config.js");
["SUPABASE_URL", "SUPABASE_ANON_KEY", "ADS_ENABLED"].forEach((k) => ok(new RegExp("(^|[^A-Z_])" + k + "\\s*:").test(cfg), "config.js memuat " + k));
ok(!/GROK_API_KEY\s*[:=]\s*["'][^"']+/.test(html + cfg), "tidak ada kunci rahasia di frontend");
console.log(bad ? "\n" + bad + " pemeriksaan GAGAL, jangan deploy dulu." : "\nSemua pemeriksaan lolos.");
process.exit(bad ? 1 : 0);
