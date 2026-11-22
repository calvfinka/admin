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
$("lgOut").addEventListener("click",function(){if(!window.sb)return;sb.auth.signOut().then(function(){location.reload()},function(){location.reload()})});
if(window.sb)sb.auth.getSession().then(function(r){if(r&&r.data&&r.data.session)$("lgOut").hidden=false},function(){});
})();
