/* Panel Admin > AI (khusus Pemilik): angka dan pola pemakaian asisten Dea di ai.gowithdme.com.
   Data dari supabase/admin_ai.sql (repo ai.gowithdme.com): admin_ai_stats, admin_ai_review_list/set, admin_ai_runs.
   PRINSIP: hanya ANGKA dan POLA. Tidak ada isi chat, nama, foto, lokasi, atau riwayat per orang di halaman ini.
   Satu-satunya teks yang tampil adalah pasangan tanya-jawab yang SENGAJA dinilai pengguna (👍/👎) dan sudah disamarkan di database.
   Hanya Pemilik (ditegakkan di database lewat is_owner(), bukan cuma disembunyikan di tampilan). Logika murni: js/ai-core.js. */
(function(){
var C=window.AI_CORE,box=document.getElementById("v_ai");
if(!box||!window.sb||!C)return;
var $=function(i){return document.getElementById(i)};
var NF=new Intl.NumberFormat("id-ID"),MON=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
var WORKER=((window.IB_CONFIG&&window.IB_CONFIG.AI_WORKER_URL)||"https://dme-ai.calvfinka.workers.dev").replace(/\/+$/,"");
var S={tab:"ringkas",days:30,stats:null,loading:false,fail:"",rk:"pending",rows:[],total:0,roff:0,rloading:false,rfail:"",open:{},runs:null,rufail:"",health:null,hloading:false,hfail:"",
  price:{i:0,o:0}};
try{var sp=JSON.parse(localStorage.getItem("gwm_ai_price")||"{}");S.price.i=Math.max(0,+sp.i||0);S.price.o=Math.max(0,+sp.o||0)}catch(e){}
function n(x){return NF.format(+x||0)}
function dm(s){var d=new Date(s+"T00:00:00");return d.getDate()+" "+MON[d.getMonth()]}
function dt(ts){try{return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(ts))+" WIB"}catch(e){return""}}
function rpc(fn,args){return window.sb.rpc(fn,args||{}).then(function(r){if(r.error)throw r.error;return r.data})}
function kpi(l,v,sub,hint){return'<div class="kp"><small>'+esc(l)+'</small><b>'+v+'</b>'+(sub||"")+(hint?'<span class="kn">'+esc(hint)+"</span>":"")+"</div>"}
function card(t,body,sub){return'<div class="card sc"><h3>'+esc(t)+"</h3>"+(sub?'<p class="meta">'+esc(sub)+"</p>":"")+body+"</div>"}
function hbars(rows){var mx=Math.max.apply(null,rows.map(function(r){return r.n}).concat([1]));
  return rows.length?'<div class="hb">'+rows.map(function(r){return'<div class="hr"><span class="hl">'+esc(r.label)+'</span><span class="hv"><i style="width:'+Math.max(2,Math.round(r.n/mx*100))+'%"></i></span><b>'+n(r.n)+' <small>'+r.pct+"%</small></b></div>"}).join("")+"</div>":'<p class="meta">Belum ada data.</p>'}
/* diagram batang harian (SVG): terang = permintaan, gelap = chat baru */
function daily(rows){var W=640,H=150,pl=34,pb=20,pt=8,w=W-pl,h=H-pb-pt,mx=Math.max.apply(null,rows.map(function(r){return r.req}).concat([1])),bw=w/Math.max(rows.length,1),g=rows.length>45?0:1,o="";
  [0,.5,1].forEach(function(f){var y=pt+h-h*f;o+='<line x1="'+pl+'" x2="'+W+'" y1="'+y+'" y2="'+y+'" class="gl"/><text x="'+(pl-6)+'" y="'+(y+4)+'" text-anchor="end">'+n(Math.round(mx*f))+"</text>"});
  rows.forEach(function(r,i){var x=pl+i*bw,a=r.req/mx*h,b=r.chats/mx*h;
    o+='<g><title>'+dm(r.d)+': '+n(r.req)+' permintaan, '+n(r.chats)+' chat baru, '+n(r.devices)+' perangkat</title>'+
      '<rect x="'+(x+g/2)+'" y="'+(pt+h-a)+'" width="'+Math.max(1,bw-g)+'" height="'+Math.max(0,a)+'" class="b1"/>'+
      '<rect x="'+(x+g/2)+'" y="'+(pt+h-b)+'" width="'+Math.max(1,bw-g)+'" height="'+Math.max(0,b)+'" class="b2"/></g>'});
  var step=rows.length>45?15:rows.length>14?7:1;
  rows.forEach(function(r,i){if(i%step===0||i===rows.length-1)o+='<text x="'+(pl+i*bw+bw/2)+'" y="'+(H-5)+'" text-anchor="middle">'+dm(r.d)+"</text>"});
  return'<div class="ch"><svg viewBox="0 0 '+W+" "+H+'" role="img" aria-label="Permintaan per hari">'+o+'</svg></div><p class="lg"><i class="b1"></i>permintaan <i class="b2"></i>chat baru</p>'}
function hours(a){var v=a.map(function(x){return x.n}),mx=Math.max.apply(null,v.concat([1])),best=v.indexOf(Math.max.apply(null,v));
  return'<div class="hrs">'+v.map(function(x,i){return'<span title="Jam '+i+": "+n(x)+' permintaan"><i class="'+(i===best&&x?"top":"")+'" style="height:'+Math.max(3,Math.round(x/mx*100))+'%"></i></span>'}).join("")+'</div><div class="hrl"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>'}

function failBox(msg,retry){var miss=C.isMissing(msg),den=C.isDenied(msg);
  return'<div class="card"><h3>'+(miss?"Menu AI belum dipasang di Supabase":den?"Hanya untuk Pemilik":"Data AI gagal dimuat")+"</h3><p>"+
    (miss?"Buka Supabase &gt; SQL Editor, jalankan isi file <code>supabase/admin_ai.sql</code> (repo ai.gowithdme.com), lalu muat ulang halaman ini.":den?"Akun ini tidak punya akses ke data AI.":esc(msg||"Coba lagi sebentar lagi."))+
    '</p><button class="btn" data-retry="'+retry+'" type="button">Coba lagi</button></div>'}

/* ---- Ringkasan ---- */
function summary(){
  if(S.fail)return failBox(S.fail,"stats");
  if(!S.stats)return'<p class="meta">Memuat…</p>';
  var D=S.stats,t=D.totals||{},p=D.perf||{},r=C.ratingSummary(D.rating),pk=C.peakHours(D.hours),wk=C.weekly(D.daily),ep=C.errPct(t),
    cs=C.cost(p.tok_in,p.tok_out,S.price.i,S.price.o);
  var empty=!t.requests?'<div class="msg">Belum ada catatan pemakaian. Pencatatan dimulai setelah Worker terbaru dipasang (butuh secret <code>SUPABASE_URL</code> dan <code>SUPABASE_SERVICE_KEY</code> di Worker).</div>':"";
  var flag=r.topReason&&r.topReason.k==="ngarang"&&r.topReason.n?'<div class="card adm-alert"><div><h3>Ada jawaban yang ditandai ngarang</h3><p class="meta">'+n(r.topReason.n)+' penilaian 👎 beralasan "ngarang". Tinjau dan perbaiki sumber datanya.</p></div><button class="btn pri sm" data-rk-go="down" type="button">Tinjau</button></div>':"";
  return empty+flag+'<div class="kps">'+kpi("Chat baru",n(t.chats),"",n(t.answers)+" jawaban Dea")+kpi("Perangkat unik",n(t.devices),"","Pseudonim, berganti tiap bulan")+
    kpi("Akun login yang chat",n(t.login_users),"","Termasuk yang tidak menilai")+kpi("Permintaan ke Dea",n(t.requests),"",n(t.with_att)+" berlampiran")+
    kpi("Gagal menjawab",ep+"%",'<em class="tr '+(ep>=10?"down":"up")+'">'+n(t.failed)+" dari "+n(t.requests)+"</em>")+kpi("Respons pertama",C.ms(p.ttft_p50),"","Median; 95%: "+C.ms(p.ttft_p95))+"</div>"+
    card("Permintaan per hari",daily(D.daily||[]),"Tanggal menurut WIB.")+
    (wk.length>1?card("Per minggu",'<div class="hb">'+wk.map(function(w){return'<div class="hr"><span class="hl">Minggu '+dm(w.week)+'</span><b>'+n(w.req)+' <small>permintaan · '+n(w.chats)+" chat baru</small></b></div>"}).join("")+"</div>","Senin sampai Minggu. Perangkat unik tidak dijumlahkan per minggu agar tidak terhitung ganda."):"")+
    '<div class="g2s">'+card("Jam ramai",hours(D.hours||[]),pk.length?"Paling ramai: "+pk.map(function(x){return x.text}).join(", ")+" WIB.":"Belum ada data.")+
    card("Perangkat",hbars(C.shares(D.devices,C.DEVICE)),"Dikelompokkan kasar dari jenis browser (HP, tablet, laptop/PC).")+"</div>"+
    '<div class="g2s">'+card("Topik paling sering",hbars(C.shares(D.topics,C.TOPIC)),"Satu label per pesan dari daftar tetap; isi pesannya tidak disimpan. \"Perlu perhatian\" hanya hitungan, tanpa identitas.")+
    card("Mode yang dipakai",hbars(C.shares(D.modes,C.MODE)))+"</div>"+
    card("Kualitas jawaban",'<div class="kps">'+kpi("👍 disukai",n(r.up),'<em class="tr up">'+r.upPct+"% dari yang menilai</em>")+kpi("👎 kurang bagus",n(r.down))+kpi("Menunggu tinjauan",n(r.pending),r.pending?'<button class="btn ghost sm" data-rk-go="pending" type="button">Tinjau</button>':"")+kpi("Sudah disetujui",n(r.approved),"","Dipakai sebagai contoh Dea")+"</div>"+
      (r.reasons.length?"<h4>Alasan 👎</h4>"+hbars(r.reasons):'<p class="meta">Belum ada penilaian 👎 beralasan.</p>'),"Hanya dari pengguna login yang menekan 👍/👎.")+
    card("Performa & biaya",'<div class="kps">'+kpi("Respons pertama",C.ms(p.ttft_p50),"","Median; 95%: "+C.ms(p.ttft_p95))+kpi("Selesai menjawab",C.ms(p.total_p50),"","Median; 95%: "+C.ms(p.total_p95))+
      kpi("Token masuk",C.tok(p.tok_in),"","Perkiraan")+kpi("Token keluar",C.tok(p.tok_out),"","Perkiraan")+kpi("Biaya perkiraan",C.rp(cs),"",S.price.i||S.price.o?"Dari harga di bawah":"Rp0 = model gratis")+"</div>"+
      '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><label class="f" style="margin:0">Rp per 1 juta token masuk<input id="aiPi" type="number" min="0" step="100" inputmode="numeric" value="'+S.price.i+'"></label>'+
      '<label class="f" style="margin:0">Rp per 1 juta token keluar<input id="aiPo" type="number" min="0" step="100" inputmode="numeric" value="'+S.price.o+'"></label></div>'+
      '<p class="meta">Token dihitung kasar (1 token ≈ 4 karakter), cukup untuk melihat tren dan boros-tidaknya, bukan untuk tagihan. Isi harga bila memakai paket berbayar; tersimpan di browser ini saja.</p>'+
      "<h4>Penyebab gagal</h4>"+((p.errors||[]).length?hbars(C.shares(p.errors,C.ERR)):'<p class="meta">Tidak ada kegagalan tercatat.</p>')+
      "<h4>Per model</h4>"+((p.by_model||[]).length?'<div class="hb">'+p.by_model.map(function(m){return'<div class="hr"><span class="hl">'+esc(m.k)+"</span><b>"+n(m.n)+" <small>permintaan · gagal "+n(m.fail)+" · respons pertama "+C.ms(m.ttft_p50)+"</small></b></div>"}).join("")+"</div>":'<p class="meta">Belum ada data.</p>'))+
    '<div class="card sc"><h3>Yang sengaja tidak ada di sini</h3><p class="meta">Isi chat, nama atau foto pengguna, lokasi, dan riwayat per orang. Halaman ini hanya menampilkan angka dan pola. Pencatatan tidak menyimpan isi pesan, alamat IP, maupun ID akun.</p></div>'}

/* ---- Tinjau jawaban ---- */
var RK={pending:"Menunggu 👍",approved:"Disetujui",down:"Ditandai 👎"};
function cut(t,id){t=String(t||"");return S.open[id]||t.length<=500?esc(t):esc(t.slice(0,500))+"… <button class=\"lnk\" data-exp=\""+esc(id)+"\" type=\"button\">selengkapnya</button>"}
function rowHtml(r){
  var acts=S.rk==="pending"?'<button class="btn pri sm" data-act="approve" data-id="'+esc(r.id)+'" type="button">Setujui</button><button class="btn ghost sm" data-act="delete" data-id="'+esc(r.id)+'" type="button">Tolak</button>':
    S.rk==="approved"?'<button class="btn ghost sm" data-act="unapprove" data-id="'+esc(r.id)+'" type="button">Batalkan persetujuan</button>':
    '<button class="btn ghost sm" data-act="delete" data-id="'+esc(r.id)+'" type="button">Selesai (hapus)</button>';
  return'<div class="card sc"><div class="meta"><span class="badge adm">'+esc(C.label(C.MODE,r.mode))+"</span> "+(r.rating===-1?"👎 "+esc(C.label(C.REASON,r.reason||"tanpa")):"👍")+" · "+dt(r.created_at)+"</div>"+
    "<p><b>Pengguna:</b> "+cut(r.prompt,r.id+"p")+"</p><p><b>Dea:</b> "+cut(r.response,r.id+"r")+'</p><div class="row" style="gap:6px;flex-wrap:wrap">'+acts+"</div></div>"}
function review(){
  var seg='<div class="seg" id="aiRk">'+Object.keys(RK).map(function(k){return'<button class="tab'+(k===S.rk?" on":"")+'" data-rk="'+k+'" type="button">'+RK[k]+"</button>"}).join("")+"</div>";
  var note='<p class="meta">Hanya pasangan tanya-jawab yang sengaja dinilai pengguna, nomor telepon/email sudah disamarkan di database. <b>Setujui</b> = Dea memakainya sebagai contoh gaya jawaban; <b>Tolak</b> menghapusnya. Tinjau dulu: tolak yang berisi data pribadi, fakta usang (jadwal/harga), atau jawaban yang sebenarnya kurang bagus.</p>';
  if(S.rfail)return seg+failBox(S.rfail,"review");
  var list=S.rows.length?S.rows.map(rowHtml).join(""):(S.rloading?'<p class="meta">Memuat…</p>':'<p class="meta">Tidak ada data di daftar ini.</p>');
  return seg+note+list+(S.rows.length<S.total?'<div class="row"><button class="btn ghost" data-more="1" type="button">Muat lagi ('+n(S.total-S.rows.length)+" lagi)</button></div>":"")}

/* ---- Pelatihan ---- */
function training(){
  if(S.rufail)return failBox(S.rufail,"runs");
  if(!S.runs)return'<p class="meta">Memuat…</p>';
  var R=S.runs,ST={exported:"Diekspor",training:"Berlatih",done:"Selesai",failed:"Gagal"};
  return'<div class="kps">'+kpi("Siap diekspor",n(R.ready),"","Disetujui dan belum diekspor")+kpi("Sudah diekspor",n(R.exported))+"</div>"+
    card("Riwayat ekspor / fine-tune",(R.runs||[]).length?'<div class="hb">'+R.runs.map(function(x){return'<div class="hr"><span class="hl">'+esc(ST[x.status]||x.status)+(x.model_name?" · "+esc(x.model_name):"")+"<small>"+dt(x.created_at)+"</small></span><b>"+n(x.example_count)+" <small>contoh</small></b></div>"}).join("")+"</div>":'<p class="meta">Belum ada ekspor.</p>',
      "Few-shot (contoh di prompt) langsung aktif begitu jawaban disetujui; ekspor hanya untuk fine-tune.")+
    '<div class="card sc"><h3>Cara ekspor</h3><p class="meta">Dari terminal (kunci <code>TRAINING_ADMIN_KEY</code> ada di Supabase secrets):</p><p><code>curl -H "x-admin-key: $KEY" "https://&lt;ref&gt;.supabase.co/functions/v1/export-training?limit=500" -o train.jsonl</code></p><p class="meta">Panduan lengkap: <code>PEMBELAJARAN.md</code> di repo ai.gowithdme.com.</p></div>'}

/* ---- Status model ---- */
function status(){
  if(S.hloading&&!S.health)return'<p class="meta">Memeriksa…</p>';
  if(S.hfail)return'<div class="card"><h3>Tidak bisa menjangkau Worker</h3><p>'+esc(S.hfail)+'</p><button class="btn" data-retry="health" type="button">Coba lagi</button></div>';
  if(!S.health)return"";
  var h=C.healthRows(S.health);
  return'<div class="card sc"><h3>'+(h.ok?"Semua model hidup":h.bad+" model bermasalah")+'</h3><p class="meta">Diperiksa '+dt(S.health.at)+" (hasil di-cache 5 menit; tidak memakai kuota token). Cron harian 08.00 WIB juga memeriksa dan mengabari lewat webhook bila ada yang mati.</p>"+
    (h.rows.length?'<div class="hb">'+h.rows.map(function(r){return'<div class="hr"><span class="hl">'+esc(r.name)+'</span><b><span class="badge '+(r.ok?"pub":"warn")+'">'+esc(r.label)+"</span></b></div>"}).join("")+"</div>":'<p class="meta">Belum ada model terkonfigurasi di Worker.</p>')+
    '<div class="row"><button class="btn ghost sm" data-retry="health" type="button">Periksa lagi</button></div></div>'+
    '<p class="meta">Ganti model yang dimatikan lewat variabel <code>GEMINI_MODEL</code>, <code>GEMINI_LITE_MODEL</code>, atau <code>GROQ_VISION_MODEL</code> di Cloudflare (tanpa ubah kode).</p>'}

function render(){
  var rb=$("aiRange");if(rb)rb.hidden=S.tab!=="ringkas";
  [].forEach.call(document.querySelectorAll("#aiTabs [data-t]"),function(b){b.classList.toggle("on",b.dataset.t===S.tab)});
  [].forEach.call(document.querySelectorAll("#aiRange [data-d]"),function(b){b.classList.toggle("on",+b.dataset.d===S.days)});
  var h=S.tab==="ringkas"?summary():S.tab==="tinjau"?review():S.tab==="latih"?training():status();
  var b=$("aiBody");if(b)b.innerHTML=h}
function loadStats(){S.loading=true;S.fail="";render();
  return rpc("admin_ai_stats",{p_days:S.days}).then(function(d){S.stats=d}).catch(function(e){S.fail=e&&e.message||"Gagal"}).then(function(){S.loading=false;render()})}
function loadReview(more){if(S.rloading)return;S.rloading=true;S.rfail="";if(!more){S.rows=[];S.total=0;S.roff=0}render();
  return rpc("admin_ai_review_list",{p_kind:S.rk,p_limit:20,p_offset:S.roff}).then(function(d){S.rows=S.rows.concat(d.rows||[]);S.total=d.total||0;S.roff=S.rows.length})
    .catch(function(e){S.rfail=e&&e.message||"Gagal"}).then(function(){S.rloading=false;render()})}
function loadRuns(){S.rufail="";return rpc("admin_ai_runs").then(function(d){S.runs=d}).catch(function(e){S.rufail=e&&e.message||"Gagal"}).then(render)}
function loadHealth(){S.hloading=true;S.hfail="";render();
  var ctl=new AbortController(),tm=setTimeout(function(){ctl.abort()},12000);
  return fetch(WORKER+"/health",{signal:ctl.signal,cache:"no-store"}).then(function(r){return r.json()}).then(function(d){S.health=d}).catch(function(){S.hfail="Worker tidak menjawab. Periksa alamat Worker dan koneksimu."})
    .then(function(){clearTimeout(tm);S.hloading=false;render()})}
function go(t){S.tab=t;
  if(t==="ringkas"&&!S.stats&&!S.loading)loadStats();
  else if(t==="tinjau"&&!S.rows.length&&!S.rloading)loadReview();
  else if(t==="latih"&&!S.runs)loadRuns();
  else if(t==="status"&&!S.hloading)loadHealth();
  render()}

box.addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.dataset.t){go(b.dataset.t);return}
  if(b.dataset.d){S.days=+b.dataset.d;S.stats=null;loadStats();return}
  if(b.dataset.rk){S.rk=b.dataset.rk;loadReview();return}
  if(b.dataset.rkGo){S.rk=b.dataset.rkGo;S.tab="tinjau";loadReview();return}
  if(b.dataset.more){loadReview(true);return}
  if(b.dataset.exp){S.open[b.dataset.exp]=1;render();return}
  if(b.dataset.retry){var k=b.dataset.retry;if(k==="stats")loadStats();else if(k==="review")loadReview();else if(k==="runs")loadRuns();else loadHealth();return}
  if(b.dataset.act){
    var act=b.dataset.act,id=b.dataset.id;
    if(act==="delete"&&!window.confirm(S.rk==="pending"?"Tolak dan hapus contoh ini?":"Hapus baris ini dari daftar?"))return;
    b.disabled=true;
    rpc("admin_ai_review_set",{p_id:id,p_action:act}).then(function(){S.rows=S.rows.filter(function(r){return r.id!==id});S.total=Math.max(0,S.total-1);S.stats=null;S.runs=null;render();if(window.toast)toast("Tersimpan.")})
      .catch(function(er){b.disabled=false;if(window.msg)msg(window.friendlyErr?friendlyErr(er):(er&&er.message)||"Gagal","err")})}
});
box.addEventListener("change",function(e){
  if(e.target.id!=="aiPi"&&e.target.id!=="aiPo")return;
  S.price.i=Math.max(0,+($("aiPi")||{}).value||0);S.price.o=Math.max(0,+($("aiPo")||{}).value||0);
  try{localStorage.setItem("gwm_ai_price",JSON.stringify(S.price))}catch(er){}
  render()});

/* Muat saat halaman dibuka (lazy): tombol menu atau perubahan atribut hidden */
function ensure(){if(!box.hidden&&S.tab==="ringkas"&&!S.stats&&!S.loading&&!S.fail)loadStats();else if(!box.hidden)render()}
new MutationObserver(ensure).observe(box,{attributes:true,attributeFilter:["hidden"]});
render();
})();
