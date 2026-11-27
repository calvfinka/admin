/* Tahap 1 - Akses cepat: FAB "Buat event", kartu "Mulai cepat", "Lanjutkan draft terakhir", pintasan N dan /.
   Semua aksi memakai handler lama (data-new / data-a="edit"); tidak mengubah id f_*, KEYS, tabel Supabase, atau RBAC. */
(function(){
var $=function(i){return document.getElementById(i)},panel=$("panel"),fab=$("fab"),res=$("qRes"),SK="ib_adm_draft";
if(!panel||!fab)return;
var CAT={konser:"Konser",naikgunung:"Naik Gunung",pameran:"Pameran",festival:"Festival",komedi:"Komedi",seminar:"Seminar",meetup:"Meetup",lainnya:"Lainnya"};
function inForm(){var f=$("v_form");return !f||!f.hidden}
function sync(){fab.hidden=panel.hidden||inForm()}
sync();
if(window.MutationObserver){var mo=new MutationObserver(function(){sync();if(!panel.hidden&&$("v_dash")&&!$("v_dash").hidden)resume()});
  mo.observe(panel,{attributes:true,attributeFilter:["hidden"]});
  ["v_form","v_dash"].forEach(function(i){var el=$(i);if(el)mo.observe(el,{attributes:true,attributeFilter:["hidden"]})})}

/* Lanjutkan draft: isian lokal yang belum disimpan lebih dulu, kalau tidak ada pakai draft tersimpan terbaru */
var pick=null;
function show(label,sub,fn){pick=fn;res.querySelector("b").textContent=label;res.querySelector("small").textContent=sub;res.hidden=false}
function resume(){
  var s=null;try{s=JSON.parse(localStorage.getItem(SK))}catch(e){}
  if(s&&(s.title||s.description)&&CAT[s.kind]){
    return show("Lanjutkan draft terakhir",(s.title||"Tanpa judul")+" · belum disimpan",function(){
      var b=document.querySelector('#qStart [data-new="'+s.kind+'"]');if(!b)return;b.click();
      setTimeout(function(){var r=$("bRest");if(r)r.click()},60)})}
  if(!window.sb){res.hidden=true;return}
  sb.from("events").select("id,title,category").eq("status","draft").order("created_at",{ascending:false}).limit(1).then(function(r){
    var d=r&&r.data&&r.data[0];if(!d){res.hidden=true;return}
    show("Lanjutkan draft terakhir",(d.title||"Tanpa judul")+" · "+(CAT[d.category]||"Event"),function(){
      var t=document.createElement("button");t.type="button";t.hidden=true;t.dataset.a="edit";t.dataset.id=d.id;
      document.body.appendChild(t);t.click();t.remove()})
  },function(){res.hidden=true})
}
res.addEventListener("click",function(){if(pick)pick()});
resume();

/* Pilih jenis: FAB dan tombol "Buat" di bar bawah menawarkan Event atau Artikel blog. Memakai handler lama (newPost / bgNew). */
var bypass=false,sheet=null,lastBtn=null;
function closeSheet(){if(!sheet)return;var s=sheet;sheet=null;s.classList.remove("on");setTimeout(function(){s.remove()},180);document.removeEventListener("keydown",onEsc,true);if(lastBtn&&lastBtn.focus)lastBtn.focus()}
function onEsc(e){if(e.key==="Escape"){e.preventDefault();closeSheet()}}
function openSheet(src){
  if(sheet)return;lastBtn=src;
  var s=document.createElement("div");s.className="qsh";
  s.innerHTML='<div class="qsh-bg"></div><div class="qsh-box" role="dialog" aria-modal="true" aria-label="Buat baru"><b>Buat baru</b>'+
   '<button type="button" data-c="event"><span>Event atau pendakian</span><small>Poster, tanggal, lokasi, tiket</small></button>'+
   '<button type="button" data-c="blog"><span>Artikel blog</span><small>Tulisan editorial</small></button>'+
   '<button type="button" data-c="x" class="qsh-x">Batal</button></div>';
  document.body.appendChild(s);sheet=s;
  s.addEventListener("click",function(e){
    var b=e.target.closest("button[data-c]"),c=b&&b.dataset.c;
    if(!b&&!e.target.classList.contains("qsh-bg"))return;
    closeSheet();
    if(c==="event"){bypass=true;try{src.click()}finally{bypass=false}}
    else if(c==="blog"){var t=document.querySelector('#bnav [data-v="blog"],#admSide [data-v="blog"],.seg [data-v="blog"]');
      if(t)t.click();setTimeout(function(){var n=$("bgNew");if(n&&!n.hidden)n.click()},120)}
  });
  document.addEventListener("keydown",onEsc,true);
  requestAnimationFrame(function(){s.classList.add("on");var f=s.querySelector("button[data-c]");if(f)f.focus()});
}
document.addEventListener("click",function(e){
  if(bypass)return;
  var b=e.target.closest("#fab,#bnav button[data-v=\"form\"]");if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();openSheet(b)
},true);

/* Pintasan desktop: N = event baru, / = cari di daftar. Tidak aktif saat mengetik, ada dialog, atau di layar sentuh. */
var desk=window.matchMedia?matchMedia("(min-width:900px) and (pointer:fine)"):null;
document.addEventListener("keydown",function(e){
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||!desk||!desk.matches||panel.hidden)return;
  var t=e.target,tag=t&&t.tagName;if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||(t&&t.isContentEditable))return;
  if(document.querySelector(".adm-dlg"))return;
  if(e.key==="n"||e.key==="N"){if(inForm())return;e.preventDefault();fab.click()}
  else if(e.key==="/"){e.preventDefault();var l=document.querySelector('#bnav [data-v="list"],#admSide [data-v="list"]');
    if(l&&$("v_list")&&$("v_list").hidden)l.click();setTimeout(function(){var q=$("flQ");if(q)q.focus()},30)}
});
})();
