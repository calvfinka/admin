/* Tahap 3 - animasi: stagger saat view dibuka, skeleton loading, toast centang. Tampilan saja. */
(function(){
var $=function(i){return document.getElementById(i)};
window.SKEL='<div class="skl" role="status" aria-label="Memuat"><i></i><i></i><i></i></div>';
var timers=new WeakMap();
/* Kelas mo-in hanya sebentar, supaya daftar yang digambar ulang saat mengetik di pencarian tidak berkedip */
function enter(el){el.classList.add("mo-in");clearTimeout(timers.get(el));timers.set(el,setTimeout(function(){el.classList.remove("mo-in")},500))}
if(window.MutationObserver){
  var mo=new MutationObserver(function(list){list.forEach(function(m){if(!m.target.hidden)enter(m.target)})});
  [].forEach.call(document.querySelectorAll('.adm-main>[id^="v_"]'),function(el){mo.observe(el,{attributes:true,attributeFilter:["hidden"]})});
}
window.ADM_MOTION={
  loading:function(){["soon","items","rev"].forEach(function(i){var el=$(i);if(el)el.innerHTML=SKEL})},
  loaded:function(){var v=document.querySelector('.adm-main>[id^="v_"]:not([hidden])');if(v)enter(v)},
  saved:function(t){if(window.toast)toast(t,null,true)}
};
})();
