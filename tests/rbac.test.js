/* Jalankan: node tests/rbac.test.js [path/ke/schema_rbac.sql]
   Memeriksa logika izin JS dan kecocokan katalog/preset dengan SQL. Tanpa dependensi. */
const fs=require("fs"),path=require("path"),assert=require("assert");
const R=require("../js/rbac-core.js");
let n=0;const t=(name,fn)=>{try{fn();n++;console.log("ok  "+name)}catch(e){console.error("GAGAL "+name+"\n  "+e.message);process.exitCode=1}};

const owner={active:true,owner:true,perms:R.ALL};
const mk=(key)=>({active:true,owner:false,perms:R.presetPerms(key)});

t("katalog tidak duplikat",()=>assert.strictEqual(new Set(R.ALL).size,R.ALL.length));
t("owner boleh semua izin dan semua tampilan",()=>{R.ALL.forEach(p=>assert(R.can(owner,p)));Object.keys(R.VIEW_PERMS).forEach(v=>assert(R.canView(owner,v),v))});
t("akun nonaktif / null ditolak total",()=>{assert(!R.can(null,"events.view"));assert(!R.can({active:false,owner:true,perms:R.ALL},"events.view"));assert(!R.canView({active:false,owner:true},"dash"))});
t("halaman Admin & Akses khusus pemilik",()=>{assert(R.canView(owner,"admins"));Object.keys(R.PRESETS).length;R.PRESETS.forEach(p=>assert(!R.canView(mk(p.key),"admins"),p.key))});
t("Beranda selalu terbuka untuk staff aktif",()=>R.PRESETS.forEach(p=>assert(R.canView(mk(p.key),"dash"))));
t("tampilan tak dikenal ditolak",()=>assert(!R.canView(owner,"nope")));
t("implikasi izin: edit/publish -> view; ban -> moderate; manage -> view",()=>{
  assert.deepStrictEqual(R.expand(["events.edit"]),["events.view","events.edit"]);
  assert(R.expand(["forum.ban"]).includes("forum.moderate"));
  assert(R.expand(["words.manage"]).includes("words.view"));
  assert(R.expand(["sponsor.manage"]).includes("sponsor.view"));
  assert.deepStrictEqual(R.expand(["bukan.izin"]),[])});
t("expand idempoten dan berurutan sesuai katalog",()=>{const a=R.expand(["stats.view","events.edit","blog.manage"]);assert.deepStrictEqual(R.expand(a),a);assert.deepStrictEqual(a,R.ALL.filter(x=>a.includes(x)))});
t("Kontributor: boleh buat/ubah draft, tidak boleh terbit/hapus/sponsor",()=>{const a=mk("kontributor");
  assert(R.can(a,"events.create")&&R.can(a,"events.edit"));assert(!R.can(a,"events.publish")&&!R.can(a,"events.delete")&&!R.can(a,"events.feature"));
  assert(!R.canView(a,"review")&&!R.canView(a,"stats")&&R.canView(a,"form")&&R.canView(a,"list")&&R.canView(a,"blog"))});
t("Editor: boleh terbit, tidak boleh hapus, moderasi, data pengguna",()=>{const a=mk("editor");
  assert(R.can(a,"events.publish")&&!R.can(a,"events.delete")&&!R.can(a,"users.view")&&!R.can(a,"forum.ban"));assert(!R.canView(a,"forum")&&!R.canView(a,"stats"))});
t("Moderator: moderasi ya, buat/ubah event tidak",()=>{const a=mk("moderator");
  assert(R.canView(a,"review")&&R.canView(a,"forum")&&R.canView(a,"words"));assert(!R.can(a,"events.edit")&&!R.can(a,"events.create")&&!R.canView(a,"form")&&!R.canView(a,"blog")&&!R.can(a,"words.manage"))});
t("Analis: hanya statistik, tak ada aksi tulis",()=>{const a=mk("analis");
  assert.deepStrictEqual(R.allowedViews(a).sort(),["dash","stats"]);assert(!R.ALL.filter(p=>!["stats.view","users.view"].includes(p)).some(p=>R.can(a,p)))});
t("Manajer Sponsor",()=>{const a=mk("sponsor");assert(R.canView(a,"sponsor")&&R.can(a,"events.feature")&&!R.can(a,"events.edit")&&!R.canView(a,"forum"))});
t("detectPreset: cocok persis -> preset, diubah -> custom",()=>{
  assert.strictEqual(R.detectPreset(R.presetPerms("editor")),"editor");
  assert.strictEqual(R.detectPreset(R.presetPerms("editor").concat(["stats.view"])),"custom");
  assert.strictEqual(R.detectPreset([]),"custom")});
t("setiap izin di preset ada di katalog",()=>R.PRESETS.forEach(p=>p.perms.forEach(x=>assert(R.ALL.includes(x),x))));
t("setiap izin di VIEW_PERMS & ACTION_PERMS ada di katalog",()=>{
  Object.values(R.VIEW_PERMS).forEach(v=>{if(Array.isArray(v))v.forEach(x=>assert(R.ALL.includes(x),x))});
  Object.values(R.ACTION_PERMS).forEach(x=>assert(R.ALL.includes(x),x))});
t("setiap izin bisa diberikan lewat salah satu preset atau kustom, dan tiap izin punya label",()=>{
  R.GROUPS.forEach(g=>g.perms.forEach(p=>{assert(p[1]&&p[1].length>5,p[0])}))});

/* ---- kecocokan dengan SQL ---- */
const sqlPath=process.argv[2]||[path.join(__dirname,"..","..","..","site","gowithdme-main","supabase","schema_rbac.sql"),path.join(__dirname,"schema_rbac.sql")].find(fs.existsSync);
if(!sqlPath){console.log("(SQL tidak ditemukan; pemeriksaan silang dilewati)")}else{
  const sql=fs.readFileSync(sqlPath,"utf8").split("\n").filter(l=>!/^\s*--/.test(l)).join("\n"); /* abaikan baris komentar */
  const arr=(s)=>[...s.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map(m=>m[1]);
  const catSql=arr(sql.match(/function rbac_all_perms\(\)[\s\S]*?select array\[([\s\S]*?)\]::text\[\]/)[1]);
  t("katalog SQL == katalog JS (isi dan urutan)",()=>assert.deepStrictEqual(catSql,R.ALL));
  const impSql=[...sql.match(/imp\(a,b\) as \(values([\s\S]*?)\),\s*allp/)[1].matchAll(/\('([a-z_.]+)','([a-z_.]+)'\)/g)].map(m=>[m[1],m[2]]);
  t("implikasi SQL == implikasi JS",()=>{const js=[];Object.entries(R.IMPLIES).forEach(([a,bs])=>bs.forEach(b=>js.push(a+">"+b)));assert.deepStrictEqual(impSql.map(x=>x.join(">")).sort(),js.sort())});
  const rolesBlock=sql.match(/insert into admin_roles[\s\S]*?on conflict/)[0];
  const rows=[...rolesBlock.matchAll(/\('([a-z]+)','([^']*)','([^']*)',\s*(?:rbac_expand\(array\[([\s\S]*?)\]\)|'\{\}'),(\d+)\)/g)];
  t("preset SQL == preset JS (kunci, label, izin)",()=>{
    assert.deepStrictEqual(rows.map(r=>r[1]),R.PRESETS.map(p=>p.key));
    rows.forEach((r,i)=>{const p=R.PRESETS[i];assert.strictEqual(r[2],p.label,p.key);assert.strictEqual(r[3],p.desc,p.key);
      assert.deepStrictEqual(R.expand(arr(r[4]||"")),R.expand(p.perms),p.key)})});
  const used=new Set([...sql.matchAll(/has_perm\('([a-z_.]+)'\)/g)].map(m=>m[1]));
  [...sql.matchAll(/\('(?:public|storage)','[a-z_]+','(?:SELECT|INSERT|UPDATE|DELETE|ALL)','([a-z_.]+)'\)/g)].forEach(m=>used.add(m[1]));
  [...sql.matchAll(/\('(?:admin|arsip)_[a-z_]+','([a-z_.]+)'\)/g)].forEach(m=>used.add(m[1]));
  t("semua izin yang dipakai di SQL ada di katalog",()=>{used.forEach(p=>assert(R.ALL.includes(p),"tidak ada di katalog: "+p))});
  t("setiap izin di katalog dipakai/ditegakkan di SQL (kecuali yang tertegak lewat trigger)",()=>{
    const trig=new Set(["events.publish","events.feature"]);
    const enforced=new Set([...used,...trig]);const unused=R.ALL.filter(p=>!enforced.has(p));assert.deepStrictEqual(unused,[],"izin tak ditegakkan: "+unused)});
  t("is_admin() didefinisikan hanya-pemilik (gagal-aman)",()=>assert(/function is_admin\(\)[\s\S]*?select is_owner\(\)/.test(sql)));
  t("tabel staff/audit tertutup untuk tulis langsung dari klien",()=>{assert(/revoke all on admin_roles, admin_staff, admin_audit from anon, authenticated/.test(sql));assert(!/grant (insert|update|delete)[^;]*admin_(staff|audit|roles)/i.test(sql))});
  t("semua RPC kelola admin memeriksa is_owner()",()=>{["admin_staff_find","admin_staff_list","admin_staff_set","admin_staff_remove","admin_audit_list"].forEach(fn=>{
    const b=sql.match(new RegExp("function "+fn+"\\([\\s\\S]*?end \\$\\$;"))[0];assert(/is_owner\(\)/.test(b),fn)})});
  /* ---- tiga syarat Dea ---- */
  t("audit: trigger tolak UPDATE/DELETE/TRUNCATE, tanpa hak tulis, baca hanya pemilik",()=>{
    assert(/create trigger admin_audit_no_change before update or delete on admin_audit/.test(sql));
    assert(/create trigger admin_audit_no_truncate before truncate on admin_audit/.test(sql));
    assert(/_admin_audit_immutable\(\)[\s\S]*?raise exception/.test(sql));
    assert(/create policy "audit: pemilik" on admin_audit for select to authenticated using \(is_owner\(\)\)/.test(sql));
    assert(!/create policy[^;]*on admin_audit for (insert|update|delete|all)/i.test(sql))});
  t("Users/Statistik/Admin&Akses di backend: fungsi dipetakan ke izin, kelola admin hanya pemilik",()=>{
    assert(/\('admin_users','users\.view'\)/.test(sql)&&/\('admin_stats','stats\.view'\)/.test(sql));
    ["editor","kontributor","moderator","sponsor","analis"].forEach(k=>{const a=mk(k);
      assert(!R.can(a,"users.view")||k==="analis","users.view bocor ke "+k);assert(!R.canView(a,"admins"),"admins bocor ke "+k)});
    ["editor","kontributor"].forEach(k=>{assert(!R.can(mk(k),"users.view")&&!R.can(mk(k),"stats.view"),k)})});
  t("pencarian: fuzzy (pg_trgm), filter kota/kategori/tanggal/status di SQL, wajib events.view",()=>{
    const b=sql.match(/function admin_search_events[\s\S]*?end \$\$;/)[0];
    ["similarity(","word_similarity(","e.city_id=p_city","e.category=p_category","e.status=p_status","coalesce(e.end_date,e.event_date)>=p_from","e.event_date<=p_to","has_perm('events.view')"].forEach(x=>assert(b.includes(x),x));
    assert(/create extension if not exists pg_trgm/.test(sql)&&/gin_trgm_ops/.test(sql))});
  t("admin_staff_set menolak: ubah pemilik, ubah diri sendiri, izin tak dikenal, tanggal lampau",()=>{
    const b=sql.match(/function admin_staff_set[\s\S]*?end \$\$;/)[0];
    ["sudah pemilik","akun sendiri","Izin tidak dikenal","di masa depan"].forEach(s=>assert(b.includes(s),s))});
}
console.log("\n"+n+" uji lulus"+(process.exitCode?" (ADA YANG GAGAL)":""));
