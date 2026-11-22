const {chromium}=require("/opt/npm-tools/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const root="/home/claude/w/admin/admin-main";
const srv=http.createServer((q,s)=>{let p=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(p.endsWith("/"))p+="index.html";
  if(!fs.existsSync(p)){s.writeHead(404);return s.end()}const ext=path.extname(p);s.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[ext]||"application/octet-stream"});s.end(fs.readFileSync(p))}).listen(0);
const stub=(role)=>`
window.supabase={createClient:function(){
 var perms=${JSON.stringify(role.perms)},me=${JSON.stringify(role)};
 var staff=[{user_id:"u1",nickname:"Sari",email:"sari@x.id",owner:false,role:"moderator",label:"Moderator Komunitas",active:true,effective:true,perms:["events.view","events.review"],custom_perms:[],expires_at:null,note:null,created_at:"2026-11-01"}];
 function R(d){return Promise.resolve({data:d,error:null})}
 function q(){var o=new Proxy({single:()=>R({id:"me",nickname:"Tester",role:me.owner?"admin":"user"}),maybeSingle:()=>R(null),then:(f,g)=>R([]).then(f,g)},{get:(t,k)=>k in t?t[k]:()=>o});return o;var _x={};}
 return{auth:{getSession:()=>R({session:{user:{id:"me",email:"t@x.id"}}}),signOut:()=>R(null),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  from:q,storage:{from:()=>({upload:()=>R(null),getPublicUrl:()=>({data:{publicUrl:""}})})},
  rpc:function(n,a){window.__rpc=(window.__rpc||[]).concat([[n,a]]);
   if(n==="my_admin")return R({active:true,owner:me.owner,role:me.owner?"owner":"moderator",label:me.label,perms:perms});
   if(n==="admin_staff_list")return R(staff);
   if(n==="admin_audit_list")return R([]);
   if(n==="admin_staff_find")return R(a.p_email==="baru@x.id"?{id:"u9",email:"baru@x.id",nickname:"Baru",owner:false,staff:false}:null);
   if(n==="admin_staff_set")return R(null);
   if(n==="admin_search_events")return R({total:1,rows:[{id:"e1",title:"Soundrenaline Bandung",category:"konser",city_id:5,cities:{name:"Bandung"},event_date:"2026-12-01",status:"published"}]});
   return R(n==="admin_stats"?{}:[])}}}};`;
(async()=>{
 const R=require(root+"/js/rbac-core.js");let fail=0;const ok=(c,m)=>{console.log((c?"ok   ":"GAGAL ")+m);if(!c)fail=1};
 const b=await chromium.launch();const url="http://localhost:"+srv.address().port+"/";
 for(const role of [{owner:true,label:"Pemilik",perms:R.ALL},{owner:false,label:"Moderator Komunitas",perms:R.presetPerms("moderator")},{owner:false,label:"Analis",perms:R.presetPerms("analis")}]){
  const pg=await b.newPage({viewport:{width:1200,height:900}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
  await pg.route("**/*",r=>{const u=r.request().url();
    if(/supabase\.js|supabase-js/.test(u))return r.fulfill({contentType:"text/javascript",body:stub(role)});
    if(u.startsWith(url))return r.continue();return r.fulfill({status:200,body:""})});
  await pg.goto(url);await pg.waitForTimeout(1200);
  const vis=async(sel)=>pg.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&e.offsetParent!==null},sel);
  const panel=await vis("#panel");ok(panel,role.label+": panel terbuka");
  const side=await pg.evaluate(()=>[].filter.call(document.querySelectorAll("#admSide button"),b=>!b.hidden).map(b=>b.dataset.v));
  const exp=R.allowedViews({active:true,owner:role.owner,perms:role.perms}).filter(v=>v!=="admins"||role.owner);
  console.log("     menu terlihat:",side.join(","));
  ok(side.every(v=>R.canView({active:true,owner:role.owner,perms:role.perms},v)),role.label+": menu hanya yang diizinkan");
  ok(await vis("#rbRole"),role.label+": label peran tampil");
  ok(errs.length===0,role.label+": tanpa galat JS "+errs.join("|"));

  if(role.owner){
   await pg.click('#admSide button[data-v="list"]');await pg.waitForTimeout(200);
   ok((await pg.textContent("#items")).includes("Tidak ada"),"daftar kosong sebelum mencari");
   await pg.evaluate(()=>{var o=document.createElement("option");o.value="5";o.text="Bandung";document.getElementById("flCity").appendChild(o)});
   await pg.fill("#flQ","Soundrenalin Bandng");await pg.waitForTimeout(700);
   let call=await pg.evaluate(()=>window.__rpc.filter(x=>x[0]==="admin_search_events").pop());
   ok(call&&call[1].p_q==="Soundrenalin Bandng","typo dikirim apa adanya ke database");
   ok((await pg.textContent("#items")).includes("Soundrenaline Bandung"),"hasil typo tampil dari respons database (bukan filter klien)");
   await pg.selectOption("#flCity","5");await pg.selectOption("#flCat","konser");await pg.fill("#flFrom","2026-12-01");await pg.fill("#flTo","2026-12-31");await pg.selectOption("#flStatus","published");
   await pg.waitForTimeout(500);
   call=await pg.evaluate(()=>window.__rpc.filter(x=>x[0]==="admin_search_events").pop());
   ok(call&&call[1].p_city===5&&call[1].p_category==="konser"&&call[1].p_from==="2026-12-01"&&call[1].p_to==="2026-12-31"&&call[1].p_status==="published"&&call[1].p_q==="Soundrenalin Bandng","kota+kategori+tanggal+status+kata kunci semua dikirim ke database");
   ok((await pg.textContent("#flCount")).includes("1 hasil"),"jumlah hasil dari database tampil");
   await pg.fill("#flQ","");await pg.selectOption("#flCity","");await pg.selectOption("#flCat","");await pg.fill("#flFrom","");await pg.fill("#flTo","");await pg.selectOption("#flStatus","");await pg.waitForTimeout(500);
   ok((await pg.textContent("#items")).includes("Tidak ada"),"semua filter dikosongkan -> kembali ke daftar biasa");
  }
  if(role.owner){
   await pg.click('#admSide button[data-v="admins"]');await pg.waitForTimeout(300);
   ok(await vis("#v_admins"),"pemilik: halaman Admin & Akses terbuka");
   ok((await pg.textContent("#stList")).includes("Sari"),"pemilik: daftar admin termuat");
   await pg.fill("#stEmail","baru@x.id");await pg.click("#stFind");await pg.waitForTimeout(300);
   ok(await vis("#stBox"),"pemilik: akun ditemukan, form terbuka");
   await pg.selectOption("#stRole","moderator");
   let c=await pg.$$eval("#stPerms input:checked",i=>i.map(x=>x.dataset.perm));ok(c.includes("forum.ban")&&!c.includes("events.edit"),"preset moderator mengisi centang");
   await pg.check('#stPerms input[data-perm="events.edit"]');
   ok(await pg.inputValue("#stRole")==="custom","ubah centang -> peran jadi Kustom");
   c=await pg.$$eval("#stPerms input:checked",i=>i.map(x=>x.dataset.perm));ok(c.includes("events.view"),"events.edit otomatis menyalakan events.view");
   await pg.click("#stSave");await pg.waitForTimeout(300);
   const call=await pg.evaluate(()=>window.__rpc.filter(x=>x[0]==="admin_staff_set").pop());
   ok(call&&call[1].p_role==="custom"&&call[1].p_user==="u9"&&call[1].p_perms.includes("events.edit"),"simpan memanggil admin_staff_set dengan izin kustom");
  }else{
   ok(!(await pg.evaluate(()=>{const e=document.getElementById("admNavAdmins");return e&&!e.hidden})),role.label+": menu Admin & Akses tersembunyi");
   ok(await pg.evaluate(()=>document.body.classList.contains("rb-no-events-delete")),role.label+": kelas pembatas terpasang");
  }
  await pg.close();
 }
 await b.close();srv.close();process.exit(fail);
})();
