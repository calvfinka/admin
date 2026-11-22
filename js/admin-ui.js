/* Sapaan di Beranda: "Selamat sore, Kalfin" + tanggal hari ini. Hanya teks; tidak menyentuh data atau tombol. */
(function(){
var hd=document.querySelector("#v_dash .adm-hd h2"),who=document.getElementById("who");
if(!hd||!who)return;
var p=hd.parentNode,date=document.createElement("span");date.className="adm-date";p.insertBefore(date,hd);
function part(h){return h<4?"Selamat malam":h<11?"Selamat pagi":h<15?"Selamat siang":h<19?"Selamat sore":"Selamat malam"}
function draw(){
  var n=new Date(),nm=(who.textContent||"").trim().split(/[\s@]/)[0];
  hd.textContent=part(n.getHours())+(nm?", "+nm:"");
  try{date.textContent=n.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}catch(e){date.textContent=""}
}
draw();
if(window.MutationObserver)new MutationObserver(draw).observe(who,{childList:true,characterData:true,subtree:true});
})();
