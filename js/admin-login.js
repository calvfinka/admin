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
  say("Memeriksa…");
  sb.auth.signInWithPassword({email:em,password:pw}).then(function(r){
    if(r.error)return say("Email atau kata sandi salah.",true);
    location.reload()
  },function(){say("Tidak bisa terhubung. Coba lagi.",true)})});
$("lgMagic").addEventListener("click",function(){
  if(!ready())return;var em=$("lgEmail").value.trim();
  if(!em)return say("Isi email dulu, lalu klik lagi.",true);
  sb.auth.signInWithOtp({email:em,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:false}}).then(function(r){
    say(r.error?"Tautan tidak bisa dikirim. Periksa email atau coba lagi nanti.":"Tautan masuk dikirim. Buka email-mu di perangkat ini.",!!r.error)
  },function(){say("Tidak bisa terhubung. Coba lagi.",true)})});
/* Lupa kata sandi: tautan reset kembali ke halaman ini (tanpa hash/query), lalu form "Buat kata sandi baru" tampil. */
var cool=null;
$("lgForgot").addEventListener("click",function(){
  if(!ready())return;var em=$("lgEmail").value.trim(),b=this;
  if(!em)return say("Isi email dulu, lalu klik lagi.",true);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em))return say("Alamat email belum benar.",true);
  b.disabled=true;say("Mengirim tautan reset…");
  sb.auth.resetPasswordForEmail(em,{redirectTo:location.origin+location.pathname}).then(function(r){
    if(r.error){b.disabled=false;return say("Tautan reset tidak bisa dikirim. Coba lagi nanti.",true)}
    say("Jika email terdaftar, tautan reset sudah dikirim. Cek kotak masuk dan spam, lalu buka tautannya di perangkat ini.");
    var n=60,t0="Lupa kata sandi?";b.textContent="Tunggu "+n+" dtk";clearInterval(cool);
    cool=setInterval(function(){n--;if(n<=0){clearInterval(cool);b.disabled=false;b.textContent=t0}else b.textContent="Tunggu "+n+" dtk"},1000)
  },function(){b.disabled=false;say("Tidak bisa terhubung. Coba lagi.",true)})});
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
