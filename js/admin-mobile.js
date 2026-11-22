/* Tampilan HP: laci menu (hamburger) dan tombol "Kelola" di Event Terdekat.
   Hanya mengatur tampil/sembunyi. Tidak menyentuh data, izin (RBAC), atau aksi tombol; klik Edit/Tarik/Duplikat/Hapus
   tetap ditangani admin.js seperti biasa. */
(function(){
var body=document.body,side=document.getElementById("admSide"),btn=document.getElementById("admBurger"),
    scrim=document.getElementById("admScrim"),panel=document.getElementById("panel"),soon=document.getElementById("soon");
var mq=window.matchMedia?matchMedia("(max-width:899px),(min-width:900px) and (max-width:1023px) and (pointer:coarse)"):null;

function isOpen(){return body.classList.contains("nav-open")}
function openNav(){
  if(!mq||!mq.matches||isOpen())return;
  body.classList.add("nav-open");btn.setAttribute("aria-expanded","true");btn.setAttribute("aria-label","Tutup menu navigasi");
  var f=side.querySelector("button.on:not([hidden])")||side.querySelector("button:not([hidden])");
  if(f)setTimeout(function(){try{f.focus({preventScroll:true})}catch(e){}},30);
}
function closeNav(refocus){
  if(!isOpen())return;
  body.classList.remove("nav-open");btn.setAttribute("aria-expanded","false");btn.setAttribute("aria-label","Buka menu navigasi");
  if(refocus)try{btn.focus({preventScroll:true})}catch(e){}
}

if(side&&btn&&scrim&&panel){
  /* tombol hamburger baru ada setelah panel terbuka (setelah login) */
  var sync=function(){btn.hidden=panel.hidden;if(panel.hidden)closeNav()};
  sync();
  if(window.MutationObserver)new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:["hidden"]});

  /* nama + peran di laci (header HP tidak muat lagi) */
  var wm=document.getElementById("admWhoM"),who=document.getElementById("who"),role=document.getElementById("rbRole");
  var fillWho=function(){if(!wm)return;var n=who?(who.textContent||"").trim():"",r=role&&!role.hidden?(role.textContent||"").trim():"";
    wm.hidden=!n&&!r;wm.firstChild.textContent=n;wm.lastChild.textContent=r};
  fillWho();
  if(window.MutationObserver)[who,role].forEach(function(el){if(el)new MutationObserver(fillWho).observe(el,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["hidden"]})});

  btn.addEventListener("click",function(){isOpen()?closeNav(true):openNav()});
  scrim.addEventListener("click",function(){closeNav(true)});
  /* memilih menu menutup laci (halaman berpindah lewat handler lama di admin.js) */
  side.addEventListener("click",function(e){if(e.target.closest("button[data-v],a[href]"))closeNav(false)});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&isOpen()){e.preventDefault();closeNav(true)}});
  /* layar diputar / jendela melebar ke desktop: pastikan laci tidak tertinggal terbuka */
  if(mq){var onchg=function(){if(!mq.matches)closeNav(false)};mq.addEventListener?mq.addEventListener("change",onchg):mq.addListener(onchg)}
}

/* "Kelola": buka/tutup baris aksi pada satu event; yang lain menutup otomatis */
if(soon)soon.addEventListener("click",function(e){
  var m=e.target.closest(".mng");if(!m||!soon.contains(m))return;
  var it=m.closest(".it"),open=!it.classList.contains("open");
  [].forEach.call(soon.querySelectorAll(".it.open"),function(x){x.classList.remove("open");var b=x.querySelector(".mng");if(b)b.setAttribute("aria-expanded","false")});
  if(open){it.classList.add("open");m.setAttribute("aria-expanded","true")}
});
})();
