(function(){
var F=["title","city_id","event_date","end_date","price_label","venue","genre","lineup","mountain","altitude_mdpl","difficulty","duration","quota","organizer","contact_wa","description","poster_url","ticket_url","source_ig"],SK="ib_adm_draft";
var kind=function(){var b=document.querySelector(".kind button.on");return b?b.dataset.kind:"konser"};
var v=function(k){return $("f_"+k).value.trim()};
function card(){var t=v("title")||"Judul event",d=v("event_date"),dp=d?new Date(d+"T00:00:00"):null,M=["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"],u=v("poster_url");
  var ex=kind()==="konser"?v("genre"):kind()==="naikgunung"?[v("mountain"),v("altitude_mdpl")?v("altitude_mdpl")+" mdpl":""].filter(Boolean).join(" · "):"";
  $("pvCard").innerHTML='<div class="ev" style="cursor:default"><div class="poster" style="background:'+(u?"url('"+esc(u).replace(/'/g,"%27")+"') center/cover,":"")+'linear-gradient(160deg,#14532d,#ff5a1f)"><span class="tag">'+({konser:"Konser",naikgunung:"Naik Gunung",pameran:"Pameran",festival:"Festival",komedi:"Komedi",seminar:"Seminar",meetup:"Meetup",lainnya:"Lainnya"}[kind()]||"Event")+'</span>'+(dp?'<div class="dt">'+("0"+dp.getDate()).slice(-2)+'<small>'+M[dp.getMonth()]+'</small></div>':'')+'</div><div class="eb"><h3>'+esc(t)+'</h3><div class="meta">📍 '+esc(v("venue")||"Lokasi belum diisi")+'</div>'+(ex?'<div class="meta">'+esc(ex)+'</div>':'')+'<div class="price">'+esc(v("price_label")||"Info menyusul")+'</div></div></div>'}
var prevOk={},wasReady=false,CK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function head(){var h=$("ckHead");if(h)return h;h=document.createElement("div");h.id="ckHead";h.className="ckh";
  h.innerHTML='<svg class="ckr" viewBox="0 0 36 36" aria-hidden="true"><circle class="t" cx="18" cy="18" r="15.9155"/><circle class="p" cx="18" cy="18" r="15.9155" stroke-dasharray="0 100"/></svg><div><b id="ckReq"></b><small id="ckSub"></small><span class="ckrdy" id="ckRdy">Siap terbit</span></div>';
  $("ck").parentNode.insertBefore(h,$("ck"));return h}
function check(){var o=snap();o.end_date=v("end_date");var r=IBC.score(o,kind(),window.EXP&&EXP.get?EXP.get().length:0),h=head();
  $("pvPct").textContent="("+r.pct+"%)";h.querySelector(".p").setAttribute("stroke-dasharray",r.pct+" 100");
  $("ckReq").textContent=r.pct+"% lengkap";$("ckSub").textContent="Wajib terisi "+r.reqDone+"/"+r.reqTotal;
  h.classList.toggle("rdy",r.ready);h.classList.toggle("pop",r.ready&&!wasReady);wasReady=r.ready;
  var cur={},li=function(c){cur[c.k]=c.ok;return'<li class="i '+(c.ok?"ok":"no")+(c.req?" rq":"")+(c.ok&&prevOk[c.k]===false?" new":"")+'"><span class="cm">'+CK+'</span>'+c.l+'</li>'};
  $("ck").innerHTML='<li class="hd">Wajib</li>'+r.items.filter(function(c){return c.req}).map(li).join("")+'<li class="hd">Opsional</li>'+r.items.filter(function(c){return !c.req}).map(li).join("");
  prevOk=cur;$("ccDesc").textContent=v("description").length}
function snap(){var o={kind:kind()};F.forEach(function(k){o[k]=v(k)});return o}
function refresh(){card();check()}
function save(){var o=snap();if(!o.title&&!o.description)return;try{localStorage.setItem(SK,JSON.stringify(o))}catch(e){}}
$("fEv").addEventListener("click",function(){setTimeout(refresh,60)});$("fEv").addEventListener("input",function(){refresh();save()});$("fEv").addEventListener("change",function(){refresh();save()});
/* Pulihkan isian yang belum tersimpan (hanya untuk postingan baru) */
document.addEventListener("click",function(ev){var b=ev.target.closest("button");if(!b||!(b.dataset.new||b.dataset.v==="form"||b.dataset.kind))return;
  setTimeout(function(){var s=null;try{s=JSON.parse(localStorage.getItem(SK))}catch(e){}$("rest").hidden=!(s&&!v("title")&&!b.dataset.kind);refresh()},0)});
$("bRest").onclick=function(){var s=JSON.parse(localStorage.getItem(SK));[].forEach.call(document.querySelectorAll(".kind button"),function(x){if(x.dataset.kind===s.kind)x.click()});F.forEach(function(k){$("f_"+k).value=s[k]||""});$("rest").hidden=true;refresh();msg("Isian dipulihkan.","ok")};
$("bDrop").onclick=function(){try{localStorage.removeItem(SK)}catch(e){}$("rest").hidden=true};
$("fEv").addEventListener("submit",function(){setTimeout(function(){if($("v_form").hidden)try{localStorage.removeItem(SK)}catch(e){}},1800)});
/* Poster: kecilkan ke maks 1280px (JPEG) sebelum unggah, dukung drag & drop */
function shrink(f){return new Promise(function(res){if(f.size<250*1024||!/^image\/(jpeg|png|webp)$/.test(f.type))return res(f);var i=new Image();i.onload=function(){var s=Math.min(1,1280/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*s;c.height=i.height*s;c.getContext("2d").drawImage(i,0,0,c.width,c.height);c.toBlob(function(b){res(b&&b.size<f.size?new File([b],f.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}):f)},"image/jpeg",.85)};i.onerror=function(){res(f)};i.src=URL.createObjectURL(f)})}
function up(f){if(!f)return;if(!/^image\//.test(f.type))return msg("File harus berupa gambar.","err");
  msg("Memproses poster…");shrink(f).then(function(g){if(g.size>2*1024*1024)return msg("Poster masih di atas 2 MB. Pilih gambar lain.","err");
    var p=Date.now()+"-"+g.name.replace(/[^a-zA-Z0-9.]+/g,"-");
    sb.storage.from("posters").upload(p,g,{cacheControl:"31536000"}).then(function(r){if(r.error)return msg(r.error.message,"err");
      var u=sb.storage.from("posters").getPublicUrl(p).data.publicUrl;$("f_poster_url").value=u;$("f_poster_url").dispatchEvent(new Event("input",{bubbles:true}));msg("Poster terunggah ("+Math.round(g.size/1024)+" KB).","ok")})})}
$("f_file").onchange=function(){up(this.files[0])};
var dz=$("pv");["dragenter","dragover"].forEach(function(n){dz.addEventListener(n,function(e){e.preventDefault();dz.classList.add("over")})});
["dragleave","drop"].forEach(function(n){dz.addEventListener(n,function(e){e.preventDefault();dz.classList.remove("over")})});
dz.addEventListener("drop",function(e){up(e.dataTransfer.files[0])});
$("f_poster_url").addEventListener("input",function(){$("pv").textContent=this.value?"":"Tarik poster ke sini atau ketuk untuk memilih (JPG/PNG, otomatis dikecilkan)"});
refresh();
})();
