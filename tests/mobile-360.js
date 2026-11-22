/* Uji tampilan HP: node tests/mobile-360.js  (butuh Playwright; ubah PW bila lokasinya beda)
   Mengecek laci menu, lebar konten, grid statistik, tombol Kelola, RBAC, dan desktop tidak berubah. Tangkapan layar -> tests/shots/ */
const PW=process.env.PW||"/opt/npm-tools/node_modules/playwright";
const {chromium}=require(PW);
const http=require("http"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");const R=require(root+"/js/rbac-core.js");
fs.mkdirSync(path.join(__dirname,"shots"),{recursive:true});
const srv=http.createServer((q,s)=>{let p=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(p.endsWith("/"))p+="index.html";
  if(!fs.existsSync(p)){s.writeHead(404);return s.end()}const ext=path.extname(p);
  s.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml"}[ext]||"application/octet-stream"});s.end(fs.readFileSync(p))}).listen(0);

const EV=[1,2,3].map(i=>({id:"e"+i,title:["Soundrenaline Bandung Festival 2026 Hari Pertama","Pendakian Gunung Prau via Patak Banteng","Stand Up Comedy Night"][i-1],category:["konser","naikgunung","komedi"][i-1],
  city_id:5,cities:{name:"Bandung"},event_date:"2027-0"+i+"-15",status:"published",poster_url:"",genre:"Rock",mountain:"Prau",altitude_mdpl:2565,event_submissions:null,created_at:"2026-11-01"}));
const stub=(role)=>`
window.supabase={createClient:function(){
 var perms=${JSON.stringify(role.perms)},me=${JSON.stringify(role)},EV=${JSON.stringify(EV)};
 function R(d){return Promise.resolve({data:d,error:null})}
 function q(t){var d=t==="events"?EV:[];var o=new Proxy({single:()=>R({id:"me",nickname:"Kalfin",role:me.owner?"admin":"user"}),maybeSingle:()=>R(null),then:(f,g)=>R(d).then(f,g)},{get:(x,k)=>k in x?x[k]:()=>o});return o}
 return{auth:{getSession:()=>R({session:{user:{id:"me",email:"t@x.id"}}}),signOut:()=>R(null),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  from:q,storage:{from:()=>({upload:()=>R(null),getPublicUrl:()=>({data:{publicUrl:""}})})},
  rpc:function(n,a){
   if(n==="my_admin")return R({active:true,owner:me.owner,role:me.owner?"owner":"moderator",label:me.label,perms:perms});
   if(n==="admin_stats")return R({days:30,traffic:{views:653,prev_views:500,visitors:135,prev_visitors:120},users:{total:6,new:2}});
   if(n==="admin_staff_list")return R([]);
   if(n==="admin_search_events")return R({total:0,rows:[]});
   return R([])}}}};`;

(async()=>{
 let fail=0;const ok=(c,m)=>{console.log((c?"ok   ":"GAGAL ")+m);if(!c)fail=1};
 const b=await chromium.launch();const url="http://localhost:"+srv.address().port+"/";
 async function open(role,vp,opt){
  const ctx=await b.newContext(Object.assign({viewport:vp,deviceScaleFactor:2,locale:"id-ID"},opt||{}));const pg=await ctx.newPage();
  pg.errs=[];pg.on("pageerror",e=>pg.errs.push(e.message));
  await pg.route("**/*",r=>{const u=r.request().url();
   if(/supabase\.js|supabase-js/.test(u))return r.fulfill({contentType:"text/javascript",body:stub(role)});
   if(u.startsWith(url))return r.continue();return r.fulfill({status:200,body:""})});
  await pg.goto(url);await pg.waitForTimeout(1200);return pg}
 const rect=(pg,sel)=>pg.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,disp:c.display,vis:c.visibility}},sel);
 const owner={owner:true,label:"Pemilik",perms:R.ALL};
 const HP={viewport:{width:360,height:800}};

 /* ===== HP 360px, Pemilik ===== */
 let pg=await open(owner,{width:360,height:800},{isMobile:true,hasTouch:true});
 ok(await pg.evaluate(()=>!document.getElementById("panel").hidden),"HP: panel terbuka");
 let sd=await rect(pg,"#admSide");ok(sd.x<=-sd.w+1||sd.vis==="hidden","HP: sidebar terlipat (di luar layar / tersembunyi) secara default");
 let bg=await rect(pg,"#admBurger");ok(bg&&bg.disp!=="none"&&bg.w>=44&&bg.h>=44&&bg.x<24&&bg.y<60,"HP: hamburger tampil di kiri atas, ukuran >=44px ("+Math.round(bg.w)+"x"+Math.round(bg.h)+")");
 ok(await pg.evaluate(()=>innerWidth===360&&document.documentElement.scrollWidth<=360),"HP: halaman persis 360px, tidak melebar / tidak ada geser horizontal / browser tidak zoom-out otomatis");
 const mn=await rect(pg,".adm-main");ok(mn.x<=1&&mn.w>=359,"HP: konten utama selebar layar ("+Math.round(mn.w)+"px, mulai x="+Math.round(mn.x)+")");
 const kp=await pg.evaluate(()=>[].map.call(document.querySelectorAll("#kpiDash .kp"),e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.x),r:Math.round(r.right),y:Math.round(r.y),clip:e.scrollWidth>e.clientWidth+1,t:e.textContent.replace(/\s+/g," ").trim()}}));
 console.log("     KPI:",JSON.stringify(kp));
 ok(kp.length===3&&kp.every(k=>k.x>=0&&k.r<=360&&!k.clip),"HP: 3 kartu statistik tidak kepotong");
 ok(kp[0].y===kp[1].y&&kp[2].y>kp[0].y&&kp[2].x===kp[0].x,"HP: statistik 2 kolom (kartu ke-3 turun, selebar baris)");
 ok(kp.map(k=>k.t).join("|").includes("653")&&kp[1].t.includes("135")&&kp[2].t.includes("6"),"HP: data statistik utuh (653 / 135 / 6)");
 const s5=await pg.evaluate(()=>{const c=[].slice.call(document.querySelectorAll("#v_dash .st5>div")).map(e=>{const r=e.getBoundingClientRect();return[Math.round(r.x),Math.round(r.y),Math.round(r.right)]});return c});
 ok(s5.length===6&&new Set(s5.map(c=>c[0])).size===2&&s5.every(c=>c[2]<=360),"HP: ringkasan inventaris 2 kolom, tidak kepotong");
 const cards=await pg.evaluate(()=>[].map.call(document.querySelectorAll("#v_dash .card:not([hidden])"),e=>{const r=e.getBoundingClientRect();return{y:r.y,b:r.bottom}}));
 const gap=await pg.evaluate(()=>{const a=document.querySelector("#v_dash .qa"),c=document.getElementById("soon").closest(".card");return Math.round(c.getBoundingClientRect().top-a.getBoundingClientRect().bottom)});
 ok(gap>=16,"HP: jarak antar blok lega ("+gap+"px antara Aksi cepat dan kartu Event terdekat)");
 await pg.screenshot({path:path.join(__dirname,"shots/hp360-beranda-atas.png")});
 await pg.evaluate(()=>scrollTo(0,document.body.scrollHeight));await pg.waitForTimeout(200);
 await pg.screenshot({path:path.join(__dirname,"shots/hp360-beranda-bawah.png")});
 await pg.evaluate(()=>document.getElementById("soon").scrollIntoView({block:"start"}));await pg.evaluate(()=>scrollBy(0,-70));await pg.waitForTimeout(150);

 /* Kelola */
 const items=await pg.evaluate(()=>[].map.call(document.querySelectorAll("#soon .it"),e=>{const m=e.querySelector(".mng"),r=e.querySelector(".row"),mr=m.getBoundingClientRect();return{mng:getComputedStyle(m).display!=="none",h:Math.round(mr.height),w:Math.round(mr.width),row:getComputedStyle(r).display!=="none"}}));
 ok(items.length===3&&items.every(i=>i.mng&&!i.row),"HP: tiap event hanya 1 tombol 'Kelola'; Edit/Tarik/Duplikat/Hapus tersembunyi");
 ok(items.every(i=>i.h>=44),"HP: tombol Kelola tinggi >=44px ("+items[0].h+"px)");
 await pg.click("#soon .it:nth-child(1) .mng");await pg.waitForTimeout(150);
 const act=await pg.evaluate(()=>[].map.call(document.querySelectorAll("#soon .it:nth-child(1) .row .btn"),b=>{const r=b.getBoundingClientRect();return{t:b.textContent,a:b.dataset.a,h:Math.round(r.height),w:Math.round(r.width),x:Math.round(r.x),r:Math.round(r.right),vis:getComputedStyle(b).display!=="none"}}));
 console.log("     aksi:",JSON.stringify(act.map(a=>a.t+" "+a.w+"x"+a.h)));
 ok(act.map(a=>a.t).join(",")==="Edit,Tarik,Duplikat,Hapus"&&act.every(a=>a.vis),"HP: klik Kelola memunculkan Edit / Tarik / Duplikat / Hapus");
 ok(act.every(a=>a.h>=44&&a.w>=90&&a.x>=0&&a.r<=360),"HP: tombol aksi besar (>=44px) dan tidak keluar layar");
 ok(await pg.evaluate(()=>document.querySelector("#soon .it:nth-child(1) .mng").getAttribute("aria-expanded")==="true"),"HP: aria-expanded=true saat terbuka");
 await pg.click("#soon .it:nth-child(2) .mng");await pg.waitForTimeout(100);
 ok(await pg.evaluate(()=>document.querySelectorAll("#soon .it.open").length===1),"HP: membuka event lain menutup yang sebelumnya");
 await pg.screenshot({path:path.join(__dirname,"shots/hp360-kelola-terbuka.png")});
 /* aksi lama tetap jalan */
 await pg.click('#soon .it:nth-child(2) [data-a="del"]');await pg.waitForTimeout(250);
 ok(await pg.evaluate(()=>{const d=document.querySelector("dialog");return !!d&&d.open&&/Hapus/.test(d.textContent)}),"HP: tombol Hapus tetap memanggil dialog konfirmasi (logika lama utuh)");
 await pg.screenshot({path:path.join(__dirname,"shots/hp360-hapus-konfirmasi.png")});
 await pg.evaluate(()=>{const d=document.querySelector("dialog");if(d)d.close("cancel")});await pg.waitForTimeout(100);
 await pg.click('#soon .it:nth-child(2) [data-a="edit"]');await pg.waitForTimeout(250);
 ok(await pg.evaluate(()=>!document.getElementById("v_form").hidden&&document.getElementById("f_title").value.includes("Gunung Prau")),"HP: tombol Edit tetap membuka form berisi data event");
 await pg.click("#bnav button[data-v=dash]");await pg.waitForTimeout(150);

 /* Laci menu */
 await pg.evaluate(()=>scrollTo(0,0));
 await pg.click("#admBurger");await pg.waitForTimeout(450);
 sd=await rect(pg,"#admSide");ok(sd.x>=0&&sd.r<=360&&sd.vis==="visible"&&sd.h>=799,"HP: hamburger membuka laci dari kiri (lebar "+Math.round(sd.w)+"px, tinggi penuh)");
 ok(await pg.evaluate(()=>document.getElementById("admBurger").getAttribute("aria-expanded")==="true"),"HP: aria-expanded hamburger=true");
 const sc=await rect(pg,"#admScrim");ok(sc.vis==="visible"&&sc.w>=359,"HP: latar gelap (scrim) muncul");
 await pg.screenshot({path:path.join(__dirname,"shots/hp360-laci-terbuka.png")});
 await pg.evaluate(()=>{document.getElementById("admSide").scrollTop=99999});await pg.waitForTimeout(150);await pg.screenshot({path:path.join(__dirname,"shots/hp360-laci-bawah.png")});await pg.evaluate(()=>{document.getElementById("admSide").scrollTop=0});
 const menu=await pg.evaluate(()=>[].filter.call(document.querySelectorAll("#admSide button"),b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return{v:b.dataset.v,h:Math.round(r.height),inView:r.right<=360&&r.x>=0}}));
 ok(await pg.evaluate(()=>{const w=document.getElementById("admWhoM"),a=[].slice.call(document.querySelectorAll("#admSFoot a"));return !w.hidden&&/Kalfin/.test(w.textContent)&&/Pemilik/.test(w.textContent)&&a.length===2&&a.every(x=>x.getBoundingClientRect().height>=44)}),"HP: laci memuat nama+peran, Lihat situs, dan Profil (dipindah dari header)");
 ok(menu.length===11&&menu.every(m=>m.h>=44&&m.inView),"HP: 11 menu pemilik tampil, tiap baris >=44px ("+menu.map(m=>m.v).join(",")+")");
 await pg.keyboard.press("Escape");await pg.waitForTimeout(450);
 sd=await rect(pg,"#admSide");ok(sd.vis==="hidden"||sd.r<=0,"HP: Esc menutup laci");
 await pg.click("#admBurger");await pg.waitForTimeout(400);await pg.mouse.click(345,300);await pg.waitForTimeout(450);
 sd=await rect(pg,"#admSide");ok(sd.vis==="hidden"||sd.r<=0,"HP: ketuk area gelap menutup laci");
 await pg.click("#admBurger");await pg.waitForTimeout(400);await pg.click('#admSide button[data-v="list"]');await pg.waitForTimeout(450);
 sd=await rect(pg,"#admSide");ok((sd.vis==="hidden"||sd.r<=0)&&await pg.evaluate(()=>!document.getElementById("v_list").hidden),"HP: memilih menu pindah halaman sekaligus menutup laci");
 ok(await pg.evaluate(()=>document.querySelector('#admSide button[data-v="list"]').classList.contains("on")),"HP: menu aktif tersorot");
 await pg.click('#admBurger');await pg.waitForTimeout(400);await pg.click('#admSide button[data-v="dash"]');await pg.waitForTimeout(400);
 ok(pg.errs.length===0,"HP: tanpa galat JS "+pg.errs.join("|"));
 await pg.context().close();

 /* ===== HP 320px (sempit) ===== */
 pg=await open(owner,{width:320,height:700},{isMobile:true,hasTouch:true});
 ok(await pg.evaluate(()=>innerWidth===320&&document.documentElement.scrollWidth<=320),"HP 320px: halaman persis 320px, tidak melebar");
 const k3=await pg.evaluate(()=>[].map.call(document.querySelectorAll("#kpiDash .kp"),e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=320&&e.scrollWidth<=e.clientWidth+1}));
 ok(k3.length===3&&k3.every(Boolean),"HP 320px: kartu statistik tidak kepotong");
 await pg.screenshot({path:path.join(__dirname,"shots/hp320-beranda.png")});
 await pg.context().close();

 /* ===== RBAC: moderator (tanpa izin edit/terbit/duplikat/hapus) ===== */
 const mod={owner:false,label:"Moderator Komunitas",perms:R.presetPerms("moderator")};
 pg=await open(mod,{width:360,height:800},{isMobile:true,hasTouch:true});
 const hasAct=["events.edit","events.publish","events.create","events.delete"].filter(p=>R.can({active:true,owner:false,perms:mod.perms},p));
 console.log("     moderator punya izin aksi event:",hasAct.join(",")||"(tidak ada)");
 const vis=await pg.evaluate(()=>{const s=document.getElementById("soon");if(!s)return null;const card=s.closest(".card");return{cardHidden:card.hidden||getComputedStyle(card).display==="none",mng:[].map.call(s.querySelectorAll(".mng"),m=>getComputedStyle(m).display!=="none").some(Boolean)}});
 ok(vis&&(vis.cardHidden||!vis.mng||hasAct.length>0),"RBAC: tombol Kelola tidak muncul bila semua aksi disembunyikan izin");
 const menuM=await pg.evaluate(()=>[].filter.call(document.querySelectorAll("#admSide button"),b=>!b.hidden).map(b=>b.dataset.v));
 ok(menuM.every(v=>R.canView({active:true,owner:false,perms:mod.perms},v)),"RBAC: menu laci hanya yang diizinkan ("+menuM.join(",")+")");
 await pg.context().close();
 /* izin sebagian: hanya edit -> Kelola tampil, hanya Edit yang terlihat */
 const part={owner:false,label:"Editor",perms:R.expand?R.expand(["events.view","events.edit"]):["events.view","events.edit"]};
 pg=await open(part,{width:360,height:800},{isMobile:true,hasTouch:true});
 await pg.click("#soon .it:nth-child(1) .mng");await pg.waitForTimeout(150);
 const vb=await pg.evaluate(()=>[].filter.call(document.querySelectorAll("#soon .it:nth-child(1) .row .btn"),b=>getComputedStyle(b).display!=="none").map(b=>b.textContent));
 ok(vb.join(",")==="Edit","RBAC: izin sebagian -> hanya tombol yang diizinkan muncul di dalam Kelola ("+vb.join(",")+")");
 await pg.context().close();

 /* ===== Desktop tidak berubah ===== */
 pg=await open(owner,{width:1280,height:800});
 sd=await rect(pg,"#admSide");bg=await rect(pg,"#admBurger");
 ok(sd.x>=0&&sd.vis==="visible"&&sd.w>200&&sd.w<300,"Desktop: sidebar tetap terlihat di kiri ("+Math.round(sd.w)+"px)");
 ok(bg.disp==="none","Desktop: hamburger tidak muncul");
 const dm=await pg.evaluate(()=>({m:getComputedStyle(document.querySelector("#soon .mng")).display,row:getComputedStyle(document.querySelector("#soon .row")).display,sc:getComputedStyle(document.getElementById("admScrim")).display,pos:getComputedStyle(document.getElementById("admSide")).position}));
 ok(dm.m==="none"&&dm.row!=="none"&&dm.sc==="none"&&dm.pos==="sticky","Desktop: tombol aksi lama tampil, Kelola/scrim tersembunyi, sidebar tetap sticky");
 await pg.screenshot({path:path.join(__dirname,"shots/desktop-1280.png")});
 ok(pg.errs.length===0,"Desktop: tanpa galat JS");
 await pg.context().close();

 /* ===== HP membuka "Situs desktop" (viewport 980px, layar sentuh) ===== */
 pg=await open(owner,{width:980,height:800},{isMobile:true,hasTouch:true});
 sd=await rect(pg,"#admSide");bg=await rect(pg,"#admBurger");
 ok(bg.disp!=="none"&&(sd.vis==="hidden"||sd.r<=0),"Mode 'Situs desktop' di HP (980px): sidebar terlipat + hamburger muncul");
 await pg.screenshot({path:path.join(__dirname,"shots/hp-desktopmode-980.png")});
 await pg.context().close();

 /* ===== Tema gelap di HP ===== */
 pg=await open(owner,{width:360,height:800},{isMobile:true,hasTouch:true,colorScheme:"dark"});
 await pg.click("#admBurger");await pg.waitForTimeout(450);
 await pg.screenshot({path:path.join(__dirname,"shots/hp360-laci-gelap.png")});
 await pg.keyboard.press("Escape");await pg.waitForTimeout(400);await pg.screenshot({path:path.join(__dirname,"shots/hp360-beranda-gelap.png")});
 await pg.context().close();

 await b.close();srv.close();console.log(fail?"\nADA YANG GAGAL":"\nSEMUA LULUS");process.exit(fail);
})();
