/* Uji: halaman admin tidak boleh terindeks. Jalankan: node tests/noindex.test.js */
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
var fail = 0;
function ok(c, m) { console.log((c ? "ok     " : "GAGAL  ") + m); if (!c) fail++; }
function read(f) { return fs.readFileSync(path.join(root, f), "utf8"); }

["index.html", "404.html"].forEach(function (f) {
  if (!fs.existsSync(path.join(root, f))) { ok(false, f + " ada"); return; }
  var h = read(f);
  var m = h.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  ok(!!m && /noindex/i.test(m[0]) && /nofollow/i.test(m[0]), f + " punya meta robots noindex,nofollow");
  ok(/<meta[^>]+name=["']googlebot["'][^>]*noindex/i.test(h), f + " punya meta googlebot noindex");
  ok(!/rel=["'][^"']*canonical/i.test(h), f + " tanpa link canonical");
  ok(!/<link[^>]+rel=["']sitemap/i.test(h), f + " tanpa link sitemap");
});
var r = read("robots.txt");
ok(/User-agent:\s*\*\s*\r?\nDisallow:\s*\/\s*(\r?\n|$)/i.test(r), "robots.txt: semua perayap Disallow: /");
["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "PerplexityBot"].forEach(function (b) {
  ok(new RegExp("User-agent:\\s*" + b + "\\s*\\r?\\nDisallow:\\s*/", "i").test(r), "robots.txt memblokir " + b);
});
ok(!/^\s*Allow:/im.test(r), "robots.txt tanpa baris Allow");
ok(!/sitemap:/i.test(r), "robots.txt tanpa Sitemap");
ok(!fs.existsSync(path.join(root, "sitemap.xml")), "tidak ada sitemap.xml");
console.log(fail ? "\n" + fail + " pemeriksaan GAGAL" : "\nsemua lulus");
process.exit(fail ? 1 : 0);
