/* Form masuk khusus panel admin. Sesi login situs utama (gowithdme.com) tidak ikut ke domain ini, jadi panel punya form sendiri.
   Hanya akun berperan admin yang bisa membuka panel; aturannya dijaga oleh admin.js dan Row Level Security di Supabase. */
(function(){
var $=function(i){return document.getElementById(i)};
function say(t,bad){var e=$("lgMsg");if(!e)return;e.textContent=t||"";e.style.color=bad?"var(--err)":""}
function ready(){if(window.sb)return true;say("Koneksi ke server belum siap. Muat ulang halaman.",true);return false}
var f=$("lgForm");if(!f)return;
f.addEventListener("submit",function(e){e.preventDefault();
  if(!ready())return;var em=$("lgEmail").value.trim(),pw=$("lgPass").value;
  if(!em||!pw)return say("Isi email dan kata sandi.",true);
  var go=$("lgGo"),t0=go.textContent;go.disabled=true;go.textContent="Memeriksa…";say("");
  var back=function(){go.disabled=false;go.textContent=t0};
  sb.auth.signInWithPassword({email:em,password:pw}).then(function(r){
    if(r.error){back();return say("Email atau kata sandi salah.",true)}
    /* Password benar. Cek dulu apakah akun ini butuh langkah kedua (passkey) sebelum panel dibuka. */
    go.textContent="Memeriksa keamanan…";
    return gate(true).then(back)
  },function(){back();say("Tidak bisa terhubung. Coba lagi.",true)})});
/* Tampilkan/sembunyikan kata sandi */
$("lgEye").addEventListener("click",function(){
  var p=$("lgPass"),show=p.type==="password";p.type=show?"text":"password";
  this.setAttribute("aria-pressed",show?"true":"false");this.setAttribute("aria-label",show?"Sembunyikan kata sandi":"Tampilkan kata sandi");p.focus()});
/* Fokus ke email saat kartu masuk tampil */
(function(){var l=$("lock");if(!l)return;
  function foc(){if(!l.hidden&&!$("lgEmail").value)try{$("lgEmail").focus({preventScroll:true})}catch(e){}}
  try{new MutationObserver(foc).observe(l,{attributes:true,attributeFilter:["hidden"]})}catch(e){}
  setTimeout(foc,400)})();
/* Tautan reset terbuka: tampilkan form kata sandi baru (panel disembunyikan sampai selesai). */
(function(){
  var A=window.IB_ARRIVAL||{},h=String(A.hash||"")+"&"+String(A.search||"").replace(/^\?/,"");
  if(!/(^|[#&])type=recovery(&|$)/.test(h)||!(/access_token=/.test(h)||/(^|&)code=/.test(h)||/token_hash=/.test(h)))return;
  var rm=function(t,bad){var e=$("recMsg");e.textContent=t||"";e.style.color=bad?"var(--err)":""};
  document.body.classList.add("recovering");$("recCard").hidden=false;
  setTimeout(function(){try{$("recPass").focus()}catch(e){}},80);
  var fail=function(){rm("Tautan reset tidak valid, kedaluwarsa, atau sudah dipakai. Kembali ke halaman masuk, isi email, lalu klik Lupa kata sandi?.",true);$("recGo").disabled=true;
    $("recGo").insertAdjacentHTML("afterend",'<a class="btn ghost" href="'+location.pathname+'">Ke halaman masuk</a>')};
  $("recForm").addEventListener("submit",function(e){e.preventDefault();
    if(!ready())return;var p=$("recPass").value,p2=$("recPass2").value;
    if(p.length<8)return rm("Kata sandi minimal 8 karakter.",true);
    if(p!==p2)return rm("Kedua kata sandi tidak sama.",true);
    $("recGo").disabled=true;rm("Menyimpan…");
    sb.auth.getSession().then(function(r){
      if(!(r&&r.data&&r.data.session)){fail();return}
      return sb.auth.updateUser({password:p}).then(function(x){
        if(x.error){$("recGo").disabled=false;
          var raw=String(x.error.message||"").toLowerCase();
          return rm(/different from the old|same as the old/.test(raw)?"Kata sandi baru harus berbeda dari yang lama.":/weak|at least|short|known/.test(raw)?"Kata sandi terlalu lemah. Campur huruf, angka, atau simbol.":/session missing/.test(raw)?"Sesi reset habis. Minta tautan baru.":"Gagal menyimpan. Coba lagi.",true)}
        rm("Kata sandi diperbarui. Membuka panel…");setTimeout(function(){location.replace(location.pathname)},900)})
    }).catch(function(){$("recGo").disabled=false;rm("Tidak bisa terhubung. Coba lagi.",true)})});
  setTimeout(function(){if($("recGo").disabled)return;sb.auth.getSession().then(function(r){if(!(r&&r.data&&r.data.session))fail()},function(){})},8000);
})();

/* ===== Langkah kedua: passkey (logika di js/admin-passkey.js) =====
   gate(): tentukan apakah panel boleh dibuka. Dipanggil sekali saat halaman dibuka (jika sudah ada sesi)
   dan sekali setelah login password berhasil. Selama belum jelas, body memakai kelas "pk-pending"
   (panel disembunyikan lewat CSS). Hanya tampilan: penegakan sebenarnya ada di database. */
var P=window.AdminPasskey,pkMode="verify";
function release(){document.body.classList.remove("pk-pending")}
function pkSay(t,kind){var e=$("pkMsg");if(!e)return;e.textContent=t||"";e.className=kind||""}
function gate(fromPassword){
  if(!P){if(fromPassword)location.reload();else release();return Promise.resolve()}
  return P.check().then(function(c){
    if(c.state==="nosession"){release();return}
    if(c.state==="ok"){if(fromPassword)location.reload();else release();return}
    showStep2(c)
  })
}
function showStep2(c){
  document.body.classList.add("pk-pending");
  $("lock").hidden=true;$("pkCard").hidden=false;
  pkSet(c.state,c.error)
}
/* Atur isi kartu sesuai keadaan: verify | register | error */
function pkSet(mode,err){
  pkMode=mode;
  var ok=P.deviceSupported(),lib=P.libReady(),v=$("pkVerify"),reg=$("pkRegBox");
  v.disabled=false;$("pkReg").disabled=false;
  v.hidden=false;reg.hidden=true;$("pkSkip").hidden=!P.canSkip();
  $("pkRegToggle").hidden=false;$("pkRegForm").hidden=true;
  if(mode==="verify"){
    $("pkTitle").textContent="Langkah Kedua: Verifikasi Passkey";
    $("pkText").textContent="Akun ini dilindungi passkey. Gunakan sidik jari, wajah, atau PIN perangkat untuk melanjutkan.";
    v.textContent="Gunakan Samsung Pass / Perangkat Ini";reg.hidden=false
  }else if(mode==="register"){
    $("pkTitle").textContent="Langkah Kedua: Daftarkan Passkey";
    $("pkText").textContent="Akun Pemilik ini belum punya passkey. Daftarkan dulu (perlu izin sekali pakai dari database).";
    v.hidden=true;reg.hidden=false;$("pkRegToggle").hidden=true;$("pkRegForm").hidden=false
  }else{
    $("pkTitle").textContent="Verifikasi belum bisa dilakukan";
    $("pkText").textContent="";
    v.textContent="Coba lagi";$("pkSkip").hidden=!P.canSkip();
    pkSay(P.friendly(err),"bad");
    if(err&&err.code==="session"){v.hidden=true;$("pkSkip").hidden=true}
    return
  }
  if(!ok){v.disabled=true;$("pkReg").disabled=true;pkSay("Perangkat atau browser ini tidak mendukung passkey (WebAuthn). Buka dengan Chrome atau Samsung Internet versi terbaru.","bad")}
  else if(!lib){v.disabled=true;$("pkReg").disabled=true;pkSay("Pustaka passkey gagal dimuat dari CDN. Cek koneksi atau pemblokir iklan, lalu muat ulang halaman.","bad")}
  else pkSay("")
}
/* Jalankan satu aksi pada tombol: tombol dikunci selama proses, galat ditampilkan, batal biometrik dianggap biasa. */
function pkAct(btn,busy,job,done){
  var t0=btn.textContent;btn.disabled=true;btn.textContent=busy;pkSay("");
  job().then(function(r){btn.disabled=false;btn.textContent=t0;done(r,btn)},function(e){
    btn.disabled=false;btn.textContent=t0;
    pkSay(P.friendly(e),e&&e.code==="cancelled"?"":"bad");
    if(e&&e.code==="session")setTimeout(function(){P.forget();sb.auth.signOut().then(function(){location.reload()},function(){location.reload()})},1800)})
}
if(P&&$("pkCard")){
  $("pkVerify").addEventListener("click",function(){
    if(pkMode==="error"){return pkAct(this,"Memeriksa…",P.check,function(c){
      if(c.state==="ok")location.reload();else pkSet(c.state,c.error)})}
    pkAct(this,"Menunggu perangkat…",P.verify,function(_,b){b.disabled=true;pkSay("Berhasil. Membuka panel…","ok");location.reload()})});
  $("pkRegToggle").addEventListener("click",function(){this.hidden=true;$("pkRegForm").hidden=false;try{$("pkName").focus()}catch(e){}});
  $("pkReg").addEventListener("click",function(){
    pkAct(this,"Mendaftarkan…",function(){return P.register($("pkName").value)},function(){
      pkSet("verify");pkSay("Passkey terdaftar. Sekarang verifikasi sekali untuk masuk.","ok")})});
  $("pkSkip").addEventListener("click",function(){P.skip().then(function(){location.reload()})});
  $("pkOut").addEventListener("click",function(){P.forget();sb.auth.signOut().then(function(){location.reload()},function(){location.reload()})});
  /* Saat halaman dibuka: sembunyikan panel dulu, lalu putuskan. Lewati saat mode reset kata sandi. */
  if(window.sb&&!document.body.classList.contains("recovering")){
    document.body.classList.add("pk-pending");
    sb.auth.getSession().then(function(r){
      if(!(r&&r.data&&r.data.session)){release();return}
      return gate(false)
    }).catch(release)
  }
}
$("lgOut").addEventListener("click",function(){if(!window.sb)return;sb.auth.signOut().then(function(){location.reload()},function(){location.reload()})});
if(window.sb)sb.auth.getSession().then(function(r){if(r&&r.data&&r.data.session)$("lgOut").hidden=false},function(){});
})();
