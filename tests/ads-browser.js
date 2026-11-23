/* Uji browser tab Iklan & Lencana (Playwright, Supabase palsu dengan data dalam memori).
   Jalankan: node tests/ads-browser.js   (PW=/jalur/playwright; SHOTS=1 simpan tangkapan ke tests/shots/) */
const {chromium}=require(process.env.PW||"/opt/npm-tools/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const root=path.join(__dirname,"..");const R=require("../js/rbac-core.js");
const srv=http.createServer((q,s)=>{let p=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(p.endsWith("/"))p+="index.html";
  if(!fs.existsSync(p)){s.writeHead(404);return s.end()}s.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml"}[path.extname(p)]||"application/octet-stream"});s.end(fs.readFileSync(p))}).listen(0);
const stub=(role,missing)=>`
window.__ads=[{id:"a1",slot:"home_rail",title:"Festival Kopi",body:"Tiket early bird",label:"sponsor",url:"https://kopi.id",tone:"brand",city:null,weight:5,starts_on:null,ends_on:null,active:true,clicks:12,updated_at:"2026-11-20T00:00:00Z"},
 {id:"a2",slot:"event_list",title:"Sudah lewat",body:null,label:"ad",url:"https://x.id",tone:"sky",city:"Bandung",weight:3,starts_on:null,ends_on:"2020-01-01",active:true,clicks:0,updated_at:"2026-11-20T00:00:00Z"}];
window.__leads=[{id:"L1",organizer_name:"EO Kopi",event_title:"Kopi Fest",package:"city_spotlight",city:"Bandung",weeks:2,status:"won",order_code:"X",est_total_idr:100}];
window.supabase={createClient:function(){var me=${JSON.stringify(role)};function R(d){return Promise.resolve({data:d,error:null})}
 function q(){var o=new Proxy({single:()=>R({id:"me",nickname:"T",role:me.owner?"admin":"user"}),maybeSingle:()=>R(null),then:(f,g)=>R([]).then(f,g)},{get:(t,k)=>k in t?t[k]:()=>o});return o}
 return{auth:{getSession:()=>R({session:{user:{id:"me",email:"t@x.id"}}}),signOut:()=>R(null),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:q,storage:{from:()=>({upload:()=>R(null),getPublicUrl:()=>({data:{publicUrl:""}})})},
 rpc:function(n,a){window.__rpc=(window.__rpc||[]).concat([[n,a]]);
  if(n==="my_admin")return R({active:true,owner:me.owner,role:me.owner?"owner":"x",label:me.label,perms:me.perms});
  ${missing?'if(n==="admin_list_ads")return Promise.resolve({data:null,error:{message:"Could not find the function public.admin_list_ads",code:"PGRST202"}});':''}
  if(n==="admin_list_ads")return R(window.__ads.slice());
  if(n==="admin_list_sponsor_leads")return R(window.__leads);
  if(n==="admin_save_ad"){var id=a.p_id||"n"+Date.now();var row={id:id,slot:a.p_slot,title:a.p_title,body:a.p_body,label:a.p_label,url:a.p_url,tone:a.p_tone,city:a.p_city,weight:a.p_weight,starts_on:a.p_starts,ends_on:a.p_ends,active:a.p_active,clicks:0,lead_id:a.p_lead,updated_at:"2026-11-23T00:00:00Z"};
    var i=window.__ads.findIndex(x=>x.id===id);if(i<0)window.__ads.push(row);else window.__ads[i]=Object.assign(window.__ads[i],row);return R(id)}
  if(n==="admin_toggle_ad"){window.__ads.forEach(x=>{if(x.id===a.p_id)x.active=a.p_active});return R(null)}
  if(n==="admin_delete_ad"){window.__ads=window.__ads.filter(x=>x.id!==a.p_id);return R(null)}
  return R(n==="admin_stats"?{}:[])}}}};`;
(async()=>{let fail=0;const ok=(c,m)=>{console.log((c?"ok   ":"GAGAL ")+m);if(!c)fail=1};
 const b=await chromium.launch();const url="http://localhost:"+srv.address().port+"/";
 const shots=process.env.SHOTS;if(shots)fs.mkdirSync(path.join(__dirname,"shots"),{recursive:true});
 async function open(role,o){o=o||{};const pg=await b.newPage({viewport:o.vp||{width:1200,height:1000}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
  await pg.route("**/*",r=>{const u=r.request().url();if(/supabase\.js|supabase-js/.test(u))return r.fulfill({contentType:"text/javascript",body:stub(role,o.missing)});if(u.startsWith(url))return r.continue();return r.fulfill({status:200,body:""})});
  await pg.goto(url);await pg.waitForTimeout(1200);return{pg,errs}}
 const vis=(pg,s)=>pg.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&e.offsetParent!==null},s);
 const owner={owner:true,label:"Pemilik",perms:R.ALL};
 // pemilik
 let {pg,errs}=await open(owner);
 ok(await vis(pg,'#admSide button[data-v="iklan"]'),"pemilik: menu Iklan & Lencana terlihat");
 await pg.click('#admSide button[data-v="iklan"]');await pg.waitForTimeout(400);
 ok(await vis(pg,"#v_iklan"),"tab Iklan terbuka");
 ok((await pg.locator(".wf-z").count())===5,"peta punya 5 tempat bernomor");
 ok((await pg.locator(".wf-grid figcaption").allTextContents()).length===4,"peta menampilkan 4 halaman");
 ok((await pg.textContent("#adList")).includes("Festival Kopi"),"daftar lencana termuat");
 ok((await pg.textContent('.wf-z[data-slot="home_rail"]')).includes("1 tayang"),"kotak kolom kanan menunjukkan 1 tayang");
 ok((await pg.textContent('.wf-z[data-slot="event_list"]')).includes("kosong"),"lencana kedaluwarsa tidak dihitung tayang");
 ok((await pg.textContent("#adStats")).includes("12"),"total klik tampil");
 if(shots)await pg.screenshot({path:path.join(__dirname,"shots","iklan-desktop.png"),fullPage:true});
 await pg.click('.wf-z[data-slot="home_top"]');await pg.waitForTimeout(150);
 ok((await pg.textContent("#adSlotInfo")).includes("Atas daftar event"),"ketuk kotak: penjelasan tempat tampil");
 ok((await pg.textContent("#adList")).includes("Tidak ada"),"filter tempat tanpa lencana: daftar kosong");
 await pg.click('[data-adnew="home_top"]');await pg.waitForTimeout(150);
 ok(await pg.evaluate(()=>document.getElementById("adDlg").open&&document.getElementById("adSlot").value==="home_top"),"tombol + Lencana di sini membuka form dengan tempat terisi");
 // validasi
 await pg.fill("#adTitle","Diskon Kereta");await pg.fill("#adUrl","http://tidak-aman.id");await pg.click("#adSave");
 ok((await pg.textContent("#adErr")).includes("https://")&&await pg.evaluate(()=>!window.__rpc.some(x=>x[0]==="admin_save_ad")),"tautan http ditolak, RPC tidak dipanggil");
 await pg.fill("#adUrl","https://kereta.id/promo");await pg.fill("#adBody","Hemat 20%");
 ok((await pg.textContent("#adPv")).includes("Diskon Kereta")&&(await pg.textContent("#adPv")).includes("Iklan"),"pratinjau hidup memakai markup situs");
 await pg.click('[data-tone="accent"]');
 ok(await pg.evaluate(()=>!!document.querySelector("#adPv .ad-t-accent.ad-b--strip")),"pratinjau mengikuti warna dan bentuk tempat (strip)");
 if(shots)await pg.screenshot({path:path.join(__dirname,"shots","iklan-form.png")});
 await pg.click("#adSave");await pg.waitForTimeout(400);
 const call=await pg.evaluate(()=>window.__rpc.filter(x=>x[0]==="admin_save_ad").pop());
 ok(call&&call[1].p_slot==="home_top"&&call[1].p_tone==="accent"&&call[1].p_title==="Diskon Kereta"&&call[1].p_id===null&&call[1].p_weight===5,"simpan memanggil admin_save_ad dengan argumen benar");
 ok(!(await pg.evaluate(()=>document.getElementById("adDlg").open))&&(await pg.textContent("#adList")).includes("Diskon Kereta"),"form menutup dan daftar menyegar");
 // ubah, nonaktif, hapus
 await pg.click('[data-slot=""]');await pg.waitForTimeout(100);
 await pg.click('[data-adedit="a1"]');await pg.fill("#adTitle","Festival Kopi 2");await pg.click("#adSave");await pg.waitForTimeout(400);
 ok(await pg.evaluate(()=>window.__rpc.filter(x=>x[0]==="admin_save_ad").pop()[1].p_id==="a1")&&(await pg.textContent("#adList")).includes("Festival Kopi 2"),"ubah memakai id yang ada");
 await pg.click('[data-adtog="a1"]');await pg.waitForTimeout(400);
 ok((await pg.textContent('.ad-card[data-id="a1"] .badge')).includes("Nonaktif"),"nonaktifkan mengubah status");
 await pg.click('[data-addel="a2"]');await pg.waitForTimeout(250);await pg.click("dialog.adm-dlg button[value=ok]");await pg.waitForTimeout(400);
 ok(!(await pg.textContent("#adList")).includes("Sudah lewat"),"hapus (dengan konfirmasi) menghilangkan kartu");
 // dari lead sponsor
 await pg.click('#admSide button[data-v="sponsor"]');await pg.waitForTimeout(500);
 ok(await vis(pg,'[data-ad-lead="L1"]'),"kartu Lead Sponsor punya tombol Buat lencana iklan");
 await pg.click('[data-ad-lead="L1"]');await pg.waitForTimeout(300);
 const pre=await pg.evaluate(()=>({o:document.getElementById("adDlg").open,s:document.getElementById("adSlot").value,t:document.getElementById("adTitle").value,c:document.getElementById("adCity").value,e:document.getElementById("adEnd").value,l:document.getElementById("adLabel").value,v:document.getElementById("v_iklan").hidden}));
 ok(pre.o&&!pre.v&&pre.s==="home_top"&&pre.t==="Kopi Fest"&&pre.c==="Bandung"&&pre.l==="sponsor"&&!!pre.e,"dari lead: pindah ke tab Iklan, form terisi sesuai paket City Spotlight");
 await pg.fill("#adUrl","https://kopi.id/fest");await pg.click("#adSave");await pg.waitForTimeout(400);
 ok(await pg.evaluate(()=>window.__rpc.filter(x=>x[0]==="admin_save_ad").pop()[1].p_lead==="L1"),"lencana dari lead menyimpan p_lead");
 ok(errs.length===0,"tanpa galat JS "+errs.join("|"));await pg.close();
 // HP
 ({pg,errs}=await open(owner,{vp:{width:360,height:780}}));
 await pg.evaluate(()=>document.querySelector('#admSide button[data-v="iklan"]').click());await pg.waitForTimeout(500);
 const ov=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
 ok(ov.sw<=ov.cw+1,"HP 360px: tanpa luapan horizontal ("+ov.sw+"/"+ov.cw+")");
 if(shots)await pg.screenshot({path:path.join(__dirname,"shots","iklan-hp.png")});
 await pg.click('[data-adnew],#adNew').catch(()=>{});await pg.waitForTimeout(200);
 const dw=await pg.evaluate(()=>{const d=document.getElementById("adDlg");const r=d.getBoundingClientRect();return{open:d.open,w:r.width,ov:d.scrollWidth>d.clientWidth+1}});
 ok(dw.open&&dw.w<=360&&!dw.ov,"HP: form muat di layar");await pg.close();
 // fungsi belum ada di database
 ({pg}=await open(owner,{missing:true}));await pg.evaluate(()=>document.querySelector('#admSide button[data-v="iklan"]').click());await pg.waitForTimeout(400);
 ok((await pg.textContent("#adList")).includes("schema_iklan.sql"),"SQL belum dipasang: petunjuk jelas, bukan galat");await pg.close();
 // izin: Manajer Sponsor boleh, Editor tidak
 const mgr={owner:false,label:"Manajer Sponsor",perms:R.presetPerms("sponsor")};
 ({pg}=await open(mgr));ok(await vis(pg,'#admSide button[data-v="iklan"]'),"Manajer Sponsor: menu Iklan terlihat");await pg.close();
 const ed={owner:false,label:"Editor",perms:R.presetPerms("editor")};
 ({pg}=await open(ed));ok(!(await vis(pg,'#admSide button[data-v="iklan"]')),"Editor: menu Iklan tersembunyi");await pg.close();
 const view={owner:false,label:"Lihat",perms:["sponsor.view"]};
 ({pg}=await open(view));await pg.evaluate(()=>document.querySelector('#admSide button[data-v="iklan"]').click());await pg.waitForTimeout(400);
 ok(!(await vis(pg,"#adNew"))&&!(await vis(pg,"[data-adedit]")),"hanya sponsor.view: tombol tambah/ubah/hapus tersembunyi");await pg.close();
 await b.close();srv.close();console.log(fail?"ADA YANG GAGAL":"SEMUA LOLOS");process.exit(fail)})().catch(e=>{console.error(e);process.exit(1)});
