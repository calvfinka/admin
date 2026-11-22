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
    go.textContent="Membuka panel…";location.reload()
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
$("lgOut").addEventListener("click",function(){if(!window.sb)return;sb.auth.signOut().then(function(){location.reload()},function(){location.reload()})});
if(window.sb)sb.auth.getSession().then(function(r){if(r&&r.data&&r.data.session)$("lgOut").hidden=false},function(){});
})();
