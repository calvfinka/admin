/* Poster tambahan (Hari 2, lineup, dll) untuk event multi-hari. Data: events.extra_posters (text[]). */
(function(){
var $=function(i){return document.getElementById(i)};
var list=[],box,grid,hint;
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function days(){var a=$("f_event_date").value,b=$("f_end_date").value;if(!a||!b||b<=a)return 1;return Math.round((new Date(b)-new Date(a))/864e5)+1}
function draw(){
  grid.innerHTML=list.map(function(u,i){
    return'<div style="position:relative;border:1px solid rgba(128,128,128,.35);border-radius:10px;overflow:hidden">'
     +'<div style="aspect-ratio:1/1;background:#8884 center/cover no-repeat url(\''+esc(u).replace(/'/g,"%27")+'\')"></div>'
     +'<div class="meta" style="padding:4px 6px;display:flex;justify-content:space-between;align-items:center;gap:4px"><b>Poster '+(i+2)+'</b><span>'
     +(i>0?'<button type="button" class="lnk" data-m="'+i+'" data-d="-1" aria-label="Geser ke kiri">◀</button>':'')
     +(i<list.length-1?'<button type="button" class="lnk" data-m="'+i+'" data-d="1" aria-label="Geser ke kanan">▶</button>':'')
     +'<button type="button" class="lnk" data-x="'+i+'" aria-label="Hapus">✕</button></span></div></div>'}).join("");
  var n=days();
  hint.textContent=list.length?("Total "+(list.length+1)+" poster (utama + "+list.length+" tambahan)."):(n>1?"Event ini "+n+" hari. Tambahkan poster untuk hari berikutnya.":"Opsional. Untuk event 2 hari atau lebih, tambahkan poster Hari 2 dan seterusnya.");
}
function shrink(f){return new Promise(function(res){if(f.size<250*1024||!/^image\/(jpeg|png|webp)$/.test(f.type))return res(f);var i=new Image();i.onload=function(){var s=Math.min(1,1280/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*s;c.height=i.height*s;c.getContext("2d").drawImage(i,0,0,c.width,c.height);c.toBlob(function(b){res(b&&b.size<f.size?new File([b],f.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}):f)},"image/jpeg",.85)};i.onerror=function(){res(f)};i.src=URL.createObjectURL(f)})}
function say(t,k){if(window.msg)window.msg(t,k)}
function upOne(f){
  if(!/^image\//.test(f.type)){say("File harus berupa gambar.","err");return Promise.resolve()}
  return shrink(f).then(function(g){
    if(g.size>2*1024*1024){say("Poster "+f.name+" di atas 2 MB, dilewati.","err");return}
    var p=Date.now()+"-"+Math.random().toString(36).slice(2,6)+"-"+g.name.replace(/[^a-zA-Z0-9.]+/g,"-");
    return sb.storage.from("posters").upload(p,g,{cacheControl:"31536000"}).then(function(r){
      if(r.error){say(r.error.message,"err");return}
      list.push(sb.storage.from("posters").getPublicUrl(p).data.publicUrl)})})}
function init(){
  var fs=$("f_poster_url").closest("fieldset");if(!fs||$("exp"))return;
  box=document.createElement("div");box.id="exp";box.style.marginTop="14px";
  box.innerHTML='<div style="font-weight:600;margin-bottom:4px">Poster tambahan (Hari 2, line-up, dll)</div>'
   +'<div class="meta" id="expHint"></div>'
   +'<div id="expGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin:8px 0"></div>'
   +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
   +'<label class="btn sm" for="expFile" style="cursor:pointer">+ Tambah poster</label>'
   +'<input class="sr" id="expFile" type="file" accept="image/*" multiple></div>'
   +'<label class="f" style="margin-top:8px">atau tempel URL poster tambahan<input id="expUrl" type="url" placeholder="https://contoh.com/poster-hari-2.jpg"></label>';
  fs.appendChild(box);grid=$("expGrid");hint=$("expHint");
  $("expFile").onchange=function(){var fl=[].slice.call(this.files),el=this;say("Mengunggah "+fl.length+" poster…");
    fl.reduce(function(p,f){return p.then(function(){return upOne(f)})},Promise.resolve()).then(function(){el.value="";draw();say("Poster tambahan diperbarui. Jangan lupa simpan.","ok")})};
  $("expUrl").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();addUrl()}});
  $("expUrl").addEventListener("change",addUrl);
  function addUrl(){var v=$("expUrl").value.trim();if(!v)return;if(!/^https:\/\//i.test(v)){say("URL poster harus diawali https://","err");return}list.push(v);$("expUrl").value="";draw()}
  grid.addEventListener("click",function(ev){var b=ev.target.closest("button");if(!b)return;
    if(b.dataset.x!==undefined)list.splice(+b.dataset.x,1);
    if(b.dataset.m!==undefined){var i=+b.dataset.m,j=i+ +b.dataset.d,t=list[i];list[i]=list[j];list[j]=t}
    draw()});
  ["f_event_date","f_end_date"].forEach(function(i){$(i).addEventListener("change",draw)});
  draw();
}
window.EXP={get:function(){return list.slice()},set:function(a){list=(a||[]).filter(Boolean);if(grid)draw()}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
