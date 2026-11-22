/* Hak akses panel: membuka/menyembunyikan menu sesuai izin akun, dan halaman "Admin & Akses" (khusus pemilik).
   Penegakan sebenarnya ada di database (schema_rbac.sql); berkas ini hanya mengatur tampilan. Dimuat SEBELUM admin.js. */
(function(){
var R=window.RBAC;
if(!R||!window.sb){window.IB_ADMIN_P=Promise.resolve({m:null,a:null});return}
var cssName=function(p){return"rb-no-"+p.replace(/\./g,"-")};
var ADMIN=null,staff=[],editing=null,found=null;

/* 1) Status akses. Bila fungsi my_admin belum ada di database (SQL belum dijalankan), admin lama tetap jadi pemilik. */
window.IB_ADMIN_P=getMe().then(function(m){
  if(!m)return{m:null,a:null};
  return sb.rpc("my_admin").then(function(r){
    var a=r&&!r.error?r.data:null,legacy=false;
    if(!a&&m.profile&&m.profile.role==="admin"){a={active:true,owner:true,role:"owner",label:"Pemilik",perms:R.ALL.slice()};legacy=true}
    if(a)a.legacy=legacy;
    return{m:m,a:a&&a.active?a:null,why:a&&!a.active?a.reason:null}
  },function(){
    var ok=m.profile&&m.profile.role==="admin";
    return{m:m,a:ok?{active:true,owner:true,role:"owner",label:"Pemilik",perms:R.ALL.slice(),legacy:true}:null}
  });
});

/* 2) Terapkan pembatasan tampilan setelah verifikasi */
IB_ADMIN_P.then(function(x){
  ADMIN=x.a;window.IB_ADMIN=ADMIN;if(!ADMIN)return;
  var b=document.body;
  R.missing(ADMIN).forEach(function(p){b.classList.add(cssName(p))});
  if(!ADMIN.owner)b.classList.add("rb-staff");
  /* Pesan "tidak punya izin" saat startup (modul yang memuat data di luar izin) tidak perlu ditampilkan */
  var t0=Date.now(),om=window.msg;
  window.msg=function(t,type){if(type==="err"&&Date.now()-t0<6000&&/izin/i.test(String(t||"")))return;return om.apply(this,arguments)};
  /* Menu samping, seg, tombol cepat */
  [].forEach.call(document.querySelectorAll("#admSide [data-v],.seg [data-v],.qa [data-v],.adm-alert [data-v],.adm-quick-new,[data-v].lnk"),function(el){
    var v=el.dataset.v;if(v&&!R.canView(ADMIN,v))el.hidden=true;
  });
  [].forEach.call(document.querySelectorAll("#bnav button"),function(el){
    var vs=[el.dataset.v].concat((el.dataset.g||"").split(",")).filter(Boolean),ok=vs.filter(function(v){return R.canView(ADMIN,v)});
    if(!ok.length){el.hidden=true;return}
    if(!R.canView(ADMIN,el.dataset.v))el.dataset.v=ok[0];
  });
  [].forEach.call(document.querySelectorAll("[data-new]"),function(el){if(!R.can(ADMIN,"events.create"))el.hidden=true});
  var hide=function(el){if(el)el.hidden=true};
  if(!R.can(ADMIN,"stats.view")){var kd=$("kpiDash");if(kd){hide(kd.previousElementSibling);hide(kd.nextElementSibling);hide(kd)}}
  if(!R.can(ADMIN,"events.view")){hide($("soon")&&$("soon").closest(".card"));var s5=document.querySelector("#v_dash .st5");if(s5){hide(s5.previousElementSibling);hide(s5)}}
  var ng=document.getElementById("admNavAdmins");if(ng)ng.hidden=!R.canView(ADMIN,"admins");
  var chip=document.getElementById("rbRole");if(chip){chip.textContent=ADMIN.label||"Admin";chip.hidden=false;chip.title=ADMIN.owner?"Akses penuh":(ADMIN.perms||[]).length+" izin"+(ADMIN.expires_at?" · berlaku sampai "+new Date(ADMIN.expires_at).toLocaleDateString("id-ID"):"")}
  /* Sembunyikan grup sidebar yang kosong */
  [].forEach.call(document.querySelectorAll("#admSide .adm-sgrp"),function(g){
    if(!g.querySelector("button:not([hidden])"))g.hidden=true});
  if(ADMIN.owner)loadStaff();
});

/* 3) Halaman kelola admin (pemilik) */
var $=function(i){return document.getElementById(i)};
function dt(s){try{return new Date(s).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}catch(e){return""}}
function say(t,bad){var e=$("stMsg");if(!e)return;e.textContent=t||"";e.style.color=bad?"var(--err)":"var(--ok,inherit)"}
function permLabel(p){for(var i=0;i<R.GROUPS.length;i++)for(var j=0;j<R.GROUPS[i].perms.length;j++)if(R.GROUPS[i].perms[j][0]===p)return R.GROUPS[i].perms[j][1];return p}

function drawChecks(sel){
  var set={};(sel||[]).forEach(function(p){set[p]=1});
  $("stPerms").innerHTML=R.GROUPS.map(function(g){
    return'<fieldset class="st-g"><legend>'+esc(g.label)+'</legend>'+g.perms.map(function(p){
      return'<label class="st-p"><input type="checkbox" data-perm="'+p[0]+'"'+(set[p[0]]?" checked":"")+'><span>'+esc(p[1])+'<small>'+esc(p[0])+'</small></span></label>'}).join("")+'</fieldset>'}).join("");
}
function checked(){return[].map.call($("stPerms").querySelectorAll("input:checked"),function(i){return i.dataset.perm})}
function setRole(key){$("stRole").value=key;var p=R.PRESETS.filter(function(x){return x.key===key})[0];$("stRoleDesc").textContent=p?p.desc:""}
function resetForm(){
  editing=null;found=null;$("stEmail").value="";$("stEmail").disabled=false;$("stFind").disabled=false;$("stFound").textContent="";
  $("stBox").hidden=true;$("stExp").value="";$("stNote").value="";$("stActive").checked=true;
  setRole("editor");drawChecks(R.presetPerms("editor"));say("");$("stFormT").textContent="Tambah admin baru";
}
function openBox(target,cur){
  $("stBox").hidden=false;
  $("stWho").textContent=target.nickname?target.nickname+" · "+target.email:target.email;
  var perms=cur?cur.perms:R.presetPerms("editor");
  setRole(cur?cur.role:"editor");drawChecks(perms);
  $("stExp").value=cur&&cur.expires_at?String(cur.expires_at).slice(0,10):"";
  $("stNote").value=cur&&cur.note||"";$("stActive").checked=cur?cur.active:true;
  $("stBox").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function onPerm(e){
  var i=e.target.closest("input[data-perm]");if(!i)return;
  var perms=R.expand(checked());drawChecks(perms);setRole(R.detectPreset(perms));
}
function onRole(){
  var k=$("stRole").value;setRole(k);
  if(k!=="custom")drawChecks(R.presetPerms(k));
}
function find(){
  var em=$("stEmail").value.trim();if(!em)return say("Isi email akun yang sudah terdaftar di GoWithDME.",true);
  say("Mencari…");
  sb.rpc("admin_staff_find",{p_email:em}).then(function(r){
    if(r.error)return say(friendlyErr(r.error),true);
    if(!r.data){found=null;$("stBox").hidden=true;return say("Akun dengan email itu belum terdaftar. Minta orangnya daftar dulu di gowithdme.com/login, lalu cari lagi.",true)}
    if(r.data.owner){found=null;$("stBox").hidden=true;return say("Akun ini sudah Pemilik (akses penuh).",true)}
    found=r.data;say("");
    var cur=staff.filter(function(s){return s.user_id===found.id})[0];
    $("stFound").textContent=cur?"Akun ini sudah admin; mengubah pengaturannya.":"Akun ditemukan.";
    editing=cur?found.id:null;openBox(found,cur);
  });
}
function save(){
  if(!found)return;
  var role=$("stRole").value,perms=R.expand(checked());
  if(role==="custom"&&!perms.length)return say("Pilih minimal satu izin.",true);
  var exp=$("stExp").value,pe=exp?exp+"T23:59:59+07:00":null;
  if(pe&&new Date(pe)<=new Date())return say("Tanggal berakhir harus di masa depan.",true);
  var b=$("stSave");b.disabled=true;say("Menyimpan…");
  sb.rpc("admin_staff_set",{p_user:found.id,p_role:role,p_perms:role==="custom"?perms:[],p_active:$("stActive").checked,p_expires:pe,p_note:$("stNote").value.trim()||null}).then(function(r){
    b.disabled=false;if(r.error)return say(friendlyErr(r.error),true);
    resetForm();say("Tersimpan. Perubahan berlaku pada muatan berikutnya akun tersebut.");loadStaff();
  });
}
function status(s){
  if(s.owner)return'<span class="badge pub">Pemilik</span>';
  if(!s.active)return'<span class="badge">Nonaktif</span>';
  if(s.effective===false)return'<span class="badge">Kedaluwarsa</span>';
  return'<span class="badge pub">Aktif</span>';
}
function row(s){
  var nm=s.nickname||s.email||"(tanpa nama)";
  var meta=[s.email,s.owner?"Akses penuh":(s.perms||[]).length+" izin",s.expires_at?"berlaku sampai "+dt(s.expires_at):"",s.last_sign_in?"terakhir masuk "+dt(s.last_sign_in):""].filter(Boolean).join(" · ");
  var acts=s.owner?'<span class="meta">Hanya bisa diubah lewat SQL.</span>':
    '<button class="btn ghost sm" data-st="edit" data-id="'+s.user_id+'" type="button">Ubah</button>'+
    '<button class="btn ghost sm" data-st="tog" data-id="'+s.user_id+'" type="button">'+(s.active?"Nonaktifkan":"Aktifkan")+'</button>'+
    '<button class="btn ghost sm" data-st="del" data-id="'+s.user_id+'" type="button">Cabut akses</button>';
  var tags=s.owner?"":'<div class="st-tags">'+(s.perms||[]).map(function(p){return'<span title="'+esc(permLabel(p))+'">'+esc(p)+'</span>'}).join("")+'</div>';
  return'<div class="it st-row"><div class="ib"><b>'+esc(nm)+'</b> '+status(s)+' <span class="badge adm">'+esc(s.label||s.role)+'</span>'+
    '<div class="meta">'+esc(meta)+'</div>'+(s.note?'<div class="meta">Catatan: '+esc(s.note)+'</div>':'')+tags+
    '<div class="row" style="margin-top:6px">'+acts+'</div></div></div>';
}
function loadStaff(){
  if(!$("stList"))return;
  sb.rpc("admin_staff_list").then(function(r){
    if(r.error){
      $("stList").innerHTML='<div class="empty">'+(/function|schema cache|not exist/i.test(r.error.message||"")?
        "Fitur admin tambahan belum aktif. Jalankan supabase/schema_rbac.sql di Supabase SQL Editor, lalu muat ulang.":esc(friendlyErr(r.error)))+'</div>';
      $("stAdd").hidden=true;return}
    staff=r.data||[];$("stAdd").hidden=false;
    $("stList").innerHTML=staff.map(row).join("")||'<div class="empty">Belum ada admin.</div>';
  });
  sb.rpc("admin_audit_list",{p_limit:30}).then(function(r){
    var L=r.data||[],A={staff_add:"menambah admin",staff_update:"mengubah akses",staff_remove:"mencabut akses"};
    $("stAudit").innerHTML=L.length?L.map(function(a){return'<div class="meta">'+esc(dt(a.at))+" · "+esc(a.actor||"?")+" "+esc(A[a.action]||a.action)+" "+esc(a.target||"")+(a.detail&&a.detail.role?" ("+esc(a.detail.role)+")":"")+'</div>'}).join(""):'<div class="meta">Belum ada riwayat.</div>';
  });
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest("button[data-st]");if(!b)return;
  var s=staff.filter(function(x){return x.user_id===b.dataset.id})[0];if(!s)return;
  if(b.dataset.st==="edit"){found={id:s.user_id,email:s.email,nickname:s.nickname};editing=s.user_id;$("stEmail").value=s.email||"";$("stFormT").textContent="Ubah akses admin";openBox(found,s)}
  if(b.dataset.st==="tog"){
    sb.rpc("admin_staff_set",{p_user:s.user_id,p_role:s.role,p_perms:s.role==="custom"?s.custom_perms:[],p_active:!s.active,p_expires:s.expires_at||null,p_note:s.note||null}).then(function(r){
      say(r.error?friendlyErr(r.error):(s.active?"Dinonaktifkan.":"Diaktifkan."),!!r.error);loadStaff()});
  }
  if(b.dataset.st==="del"){
    admAsk({title:"Cabut akses admin",text:"Cabut seluruh akses admin untuk "+(s.nickname||s.email)+"? Akunnya tetap ada sebagai pengguna biasa.",ok:"Cabut akses"}).then(function(ok){
      if(!ok)return;sb.rpc("admin_staff_remove",{p_user:s.user_id}).then(function(r){say(r.error?friendlyErr(r.error):"Akses dicabut.",!!r.error);loadStaff()})});
  }
});
function boot(){
  if(!$("stRole"))return;
  $("stRole").innerHTML=R.PRESETS.map(function(p){return'<option value="'+p.key+'">'+esc(p.label)+'</option>'}).join("");
  $("stRole").addEventListener("change",onRole);$("stPerms").addEventListener("change",onPerm);
  $("stFind").addEventListener("click",find);$("stSave").addEventListener("click",save);$("stCancel").addEventListener("click",resetForm);
  $("stEmail").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();find()}});
  resetForm();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
