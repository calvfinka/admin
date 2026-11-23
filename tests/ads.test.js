/* Jalankan: node tests/ads.test.js [path/ke/ads-core.js situs]. Memeriksa inti iklan dan kecocokan dengan SQL (tests/schema_iklan.sql, salin dari repo situs). */
const fs=require("fs"),path=require("path"),assert=require("assert");
const A=require("../js/ads-core.js");let n=0;
const t=(name,fn)=>{try{fn();n++;console.log("ok  "+name)}catch(e){console.error("GAGAL "+name+"\n  "+e.message);process.exitCode=1}};
const sql=fs.readFileSync(path.join(__dirname,"schema_iklan.sql"),"utf8").split("\n").filter(l=>!/^\s*--/.test(l)).join("\n");
const list=s=>[...s.matchAll(/'([a-z_]+)'/g)].map(m=>m[1]);
t("katalog tempat/label/warna sama dengan SQL",()=>{
  const f=sql.match(/function admin_save_ad[\s\S]*?end \$\$;/)[0];
  assert.deepStrictEqual(list(f.match(/p_slot not in \(([^)]*)\)/)[1]),A.SLOTS.map(s=>s.key));
  assert.deepStrictEqual(list(f.match(/p_label not in \(([^)]*)\)/)[1]),Object.keys(A.LABELS));
  assert.deepStrictEqual(list(f.match(/p_tone not in \(([^)]*)\)/)[1]),A.TONES.map(x=>x.key))});
t("argumen RPC sama dengan tanda tangan admin_save_ad",()=>{
  const sig=sql.match(/function admin_save_ad\(([^)]*)\)/)[1].split(",").map(x=>x.trim().split(/\s+/)[0]);
  const a=A.buildSaveArgs({slot:"home_rail",title:"Hai",label:"ad",url:"https://a.id",tone:"brand",weight:5});
  assert.deepStrictEqual(Object.keys(a),sig)});
t("izin: hanya sponsor.view / sponsor.manage",()=>{
  const used=new Set([...sql.matchAll(/_ad_can\('([a-z_.]+)'\)/g)].map(m=>m[1]));
  assert.deepStrictEqual([...used].sort(),["sponsor.manage","sponsor.view"]);
  const R=require("../js/rbac-core.js");used.forEach(p=>assert(R.ALL.includes(p),p));
  assert.deepStrictEqual(R.VIEW_PERMS.iklan,["sponsor.view","sponsor.manage"])});
t("Manajer Sponsor boleh membuka Iklan; Editor/Analis tidak",()=>{
  const R=require("../js/rbac-core.js"),mk=k=>({active:true,owner:false,perms:R.presetPerms(k)});
  assert(R.canView(mk("sponsor"),"iklan"));assert(!R.canView(mk("editor"),"iklan"));assert(!R.canView(mk("analis"),"iklan"))});
t("validate/safeUrl/pick dasar",()=>{
  assert.strictEqual(A.validate({slot:"home_rail",title:"Hai",label:"ad",url:"http://a.id",tone:"brand",weight:5}).field,"url");
  assert.strictEqual(A.safeUrl("javascript:alert(1)"),"");
  assert.strictEqual(A.pick([{id:"1",slot:"home_top",title:"x",url:"https://a.id",weight:5,active:true}],"home_rail",{}),null)});
const site=process.argv[2]||path.join(__dirname,"..","..","gowithdme-main","js","ads-core.js");
if(fs.existsSync(site))t("ads-core.js identik dengan salinan di repo situs",()=>assert.strictEqual(fs.readFileSync(site,"utf8"),fs.readFileSync(path.join(__dirname,"..","js","ads-core.js"),"utf8")));
else console.log("(salinan situs tidak ditemukan; pemeriksaan identik dilewati)");
console.log("\n"+n+" uji lulus");
