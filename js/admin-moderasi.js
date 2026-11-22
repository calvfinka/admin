/* Panel Admin > Statistik > Moderasi: kelola daftar blokir/peringatan host dan tindak lanjuti laporan pengguna browser.
   Data dari supabase/schema_moderasi.sql (repo browser): admin_moderation_stats, admin_blocklist_list/set/remove,
   admin_reports_list/resolve/purge. Membaca: izin stats.view. Mengubah: khusus Pemilik (ditegakkan di database).
   Dihubungkan dari admin-stats.js lewat window.ADM_MOD (view, ensure, reset). */
(function(){
if(!window.sb||!$("v_stats"))return;
var S={loaded:false,busy:false,fail:"",st:null,list:[],reps:[],cb:null};
var NF=new Intl.NumberFormat("id-ID");
var RS={berbahaya:"Berbahaya / malware",penipuan:"Penipuan / phishing",dewasa:"Konten dewasa",lainnya:"Lainnya"};
function n(x){return NF.format(+x||0)}
function days(){var a=document.querySelector("#stRange .tab.on");return a&&+a.dataset.d||30}
function dt(ts){try{return new Date(ts).toLocaleDateString("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"short",year:"numeric"})}catch(e){return""}}
function kpi(l,v,s){return'<div class="kp"><small>'+esc(l)+'</small><b>'+n(v)+'</b>'+(s?'<span class="kn">'+esc(s)+"</span>":"")+"</div>"}
function badge(a){return'<span class="badge adm">'+(a==="block"?"Blokir":"Peringatan")+"</span>"}
function bars(items){var mx=Math.max.apply(null,items.map(function(i){return i.n}).concat([1]));
  return items.length?'<div class="hb">'+items.map(function(i){return'<div class="hr"><span class="hl">'+esc(i.k)+'</span><span class="hv"><i style="width:'+Math.max(2,Math.round(i.n/mx*100))+'%"></i></span><b>'+n(i.n)+"</b></div>"}).join("")+"</div>":'<p class="meta">Belum ada data.</p>'}

function view(){
  if(S.fail){var miss=/admin_moderation|admin_blocklist|admin_reports|schema cache|does not exist|Could not find/i.test(S.fail);
    return'<div class="card"><h3>'+(miss?"Moderasi belum dipasang di Supabase":"Data moderasi gagal dimuat")+"</h3><p>"+
      (miss?"Buka Supabase &gt; SQL Editor, jalankan isi file <code>supabase/schema_moderasi.sql</code> (repo browser), lalu muat ulang halaman ini.":esc(S.fail))+'</p><button class="btn" id="mdRetry" type="button">Coba lagi</button></div>'}
  if(!S.loaded)return'<p class="meta">Memuat…</p>';
  var st=S.st||{};
  var list=S.list.length?S.list.map(function(r){return'<div class="us"><span class="ua">'+(r.action==="block"?"B":"W")+'</span><div class="ub"><b>'+esc(r.host)+"</b> "+badge(r.action)+
    '<div class="meta">'+[r.reason||"Tanpa alasan",dt(r.updated_at)].map(esc).join(" · ")+'</div></div><button class="btn ghost sm" data-mdrm="'+esc(r.host)+'" type="button">Hapus</button></div>'}).join(""):'<p class="meta">Daftar masih kosong.</p>';
  var reps=S.reps.length?S.reps.map(function(r){var h=esc(r.host);return'<div class="us"><span class="ua">!</span><div class="ub"><b>'+h+"</b>"+(r.listed?" "+badge(r.listed):"")+
    '<div class="meta">'+[n(r.n)+" laporan",n(r.u)+" kunjungan","teratas: "+(RS[r.top_reason]||r.top_reason),"terakhir "+dt(r.last_at)].map(esc).join(" · ")+'</div>'+
    '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn sm" data-mdblock="'+h+'" data-why="'+esc(r.top_reason)+'" type="button">Blokir</button>'+
    '<button class="btn ghost sm" data-mdwarn="'+h+'" data-why="'+esc(r.top_reason)+'" type="button">Beri peringatan</button>'+
    '<button class="btn ghost sm" data-mdskip="'+h+'" type="button">Abaikan</button></div></div></div>'}).join(""):'<p class="meta">Tidak ada laporan terbuka.</p>';
  return'<div class="kps">'+kpi("Diblokir",st.blocked,"permintaan ditolak proxy")+kpi("Diperingatkan",st.warned,"halaman peringatan tampil")+kpi("Dibatasi",st.limited,"batas pemakaian (disampel 10%)")+kpi("Laporan terbuka",st.reports_open,n(st.listed)+" situs di daftar")+"</div>"+
  '<div class="card sc"><h3>Tambah ke daftar</h3><p class="meta">Tulis nama situs saja (mis. <code>contoh.com</code>); subdomain ikut tercakup. Blokir berlaku penuh di mode Proxy. Di mode Langsung hanya dicegah di halaman browser dan bisa dilewati. Hanya Pemilik yang dapat mengubah daftar.</p>'+
    '<div class="bar"><input id="mdHost" type="text" inputmode="url" autocapitalize="none" spellcheck="false" maxlength="120" placeholder="contoh.com">'+
    '<select id="mdAct"><option value="block">Blokir</option><option value="warn">Beri peringatan</option></select></div>'+
    '<div class="bar"><input id="mdWhy" type="text" maxlength="200" placeholder="Alasan (tampil di halaman blokir/peringatan, opsional)"><button class="btn sm" id="mdAdd" type="button">Simpan</button></div></div>'+
  '<div class="card sc"><h3>Laporan pengguna</h3><p class="meta">Dikelompokkan per situs. Tidak ada isi halaman atau identitas; hanya situs, path tanpa query, alasan, dan kode kunjungan acak.</p>'+reps+
    '<div class="row"><button class="btn ghost sm" id="mdPurge" type="button">Hapus laporan lebih dari 90 hari</button></div></div>'+
  '<div class="card sc"><h3>Daftar aturan ('+n(S.list.length)+')</h3>'+list+"</div>"+
  '<div class="card sc"><h3>Paling sering diblokir</h3>'+bars(st.top_blocked||[])+'<p class="meta">Dalam '+days()+" hari terakhir. Proxy memuat ulang daftar tiap sekitar 60 detik, jadi perubahan berlaku dalam semenit.</p></div>"}

function load(){
  if(S.busy)return;S.busy=true;S.fail="";
  return Promise.all([sb.rpc("admin_moderation_stats",{p_days:days()}),sb.rpc("admin_blocklist_list"),sb.rpc("admin_reports_list",{p_limit:50})]).then(function(r){
    S.busy=false;var e=r[0].error||r[1].error||r[2].error;
    if(e)S.fail=e.message||"Gagal";else{S.st=r[0].data;S.list=(r[1].data&&r[1].data.rows)||[];S.reps=(r[2].data&&r[2].data.rows)||[];S.loaded=true}
    if(S.cb)S.cb()},function(){S.busy=false;S.fail="Koneksi bermasalah. Coba lagi.";if(S.cb)S.cb()})}
function again(){S.loaded=false;if(S.cb)S.cb()}   /* render menampilkan "Memuat…" lalu memanggil ensure -> load */
function done(r,ok){if(r.error)return msg(friendlyErr(r.error),"err");msg(ok,"ok");again()}

window.ADM_MOD={view:view,ensure:function(cb){S.cb=cb;if(!S.loaded&&!S.busy&&!S.fail)load()},reset:function(){S.loaded=false;S.fail=""}};

document.addEventListener("click",function(ev){var b=ev.target.closest("button");if(!b||!$("stBody").contains(b))return;
  if(b.id==="mdRetry"){S.fail="";again()}
  if(b.id==="mdAdd"){var h=($("mdHost").value||"").trim();if(!h)return msg("Isi nama situs dulu.","err");
    sb.rpc("admin_blocklist_set",{p_host:h,p_action:$("mdAct").value,p_reason:($("mdWhy").value||"").trim()||null}).then(function(r){done(r,"Disimpan. Proxy menerapkannya dalam sekitar semenit.")})}
  if(b.dataset.mdrm){if(!confirm("Hapus "+b.dataset.mdrm+" dari daftar?"))return;
    sb.rpc("admin_blocklist_remove",{p_host:b.dataset.mdrm}).then(function(r){done(r,"Dihapus dari daftar.")})}
  if(b.dataset.mdblock||b.dataset.mdwarn){var host=b.dataset.mdblock||b.dataset.mdwarn,act=b.dataset.mdblock?"block":"warn";
    sb.rpc("admin_blocklist_set",{p_host:host,p_action:act,p_reason:"Dilaporkan pengguna: "+(RS[b.dataset.why]||b.dataset.why)}).then(function(r){
      if(r.error)return msg(friendlyErr(r.error),"err");
      return sb.rpc("admin_reports_resolve",{p_host:host}).then(function(r2){done(r2,host+(act==="block"?" diblokir.":" diberi peringatan."))})})}
  if(b.dataset.mdskip)sb.rpc("admin_reports_resolve",{p_host:b.dataset.mdskip}).then(function(r){done(r,"Laporan ditutup.")});
  if(b.id==="mdPurge"){if(!confirm("Hapus semua laporan yang lebih tua dari 90 hari? Tindakan ini tidak bisa dibatalkan."))return;
    sb.rpc("admin_reports_purge",{p_days:90}).then(function(r){done(r,n(r.data)+" laporan dihapus.")})}
});
document.addEventListener("keydown",function(e){if(e.key==="Enter"&&(e.target.id==="mdHost"||e.target.id==="mdWhy")){e.preventDefault();var a=$("mdAdd");if(a)a.click()}});
})();
