/* Tahap 4 - foto profil: avatar header, Ganti/Hapus, atur posisi (geser + zoom), unggah 256px. */
(function(){
var el=function(i){return document.getElementById(i)},panel=el("panel"),btn=el("avBtn"),menu=el("avMenu"),file=el("avFile"),dlg=el("avDlg"),cv=el("avCv");
if(!panel||!btn||!dlg||!window.sb)return;
var B="profile-photos",SIZE=256,MAX_IN=10*1048576,MAX_OUT=1048576,me=null,img=null,z=1,x=0,y=0,busy=false,armed=false;
function draw(){
  var name=(me&&(me.profile.nickname||me.user.email))||"?",u=me&&me.profile.avatar_url,s=btn.firstElementChild;
  s.textContent=name.trim().charAt(0).toUpperCase();
  if(u){var i=new Image();i.alt="";i.onload=function(){if(me.profile.avatar_url===u){s.textContent="";s.appendChild(i)}};i.src=u}
  el("avDel").hidden=!u}
function start(){if(panel.hidden||me)return;getMe().then(function(m){if(!m)return;me=m;btn.hidden=false;draw()})}
if(window.MutationObserver)new MutationObserver(start).observe(panel,{attributes:true,attributeFilter:["hidden"]});
start();

function closeMenu(){menu.hidden=true;btn.setAttribute("aria-expanded","false");armed=false;el("avDel").textContent="Hapus foto"}
btn.onclick=function(){if(!menu.hidden)return closeMenu();var r=btn.getBoundingClientRect();
  menu.style.top=(r.bottom+4)+"px";menu.style.right=Math.max(8,document.documentElement.clientWidth-r.right)+"px";menu.hidden=false;btn.setAttribute("aria-expanded","true")};
document.addEventListener("click",function(e){if(!menu.hidden&&!menu.contains(e.target)&&!btn.contains(e.target))closeMenu()});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!menu.hidden){closeMenu();btn.focus()}});
el("avPick").onclick=function(){closeMenu();file.value="";file.click()};

function fail(e){var t=(e&&e.message)||"";
  toast(/set_my_avatar|bucket not found|schema cache/i.test(t)?"Jalankan dulu supabase/patch_foto_profil.sql.":"Gagal menyimpan foto. Coba lagi.",5000)}
/* Hapus berkas lama di folder sendiri, kecuali yang baru */
function clean(keep){var f=sb.storage.from(B),id=me.user.id;
  return f.list(id).then(function(r){var old=(r.data||[]).map(function(o){return id+"/"+o.name}).filter(function(p){return p!==keep});if(old.length)return f.remove(old)}).catch(function(){})}
function setUrl(u){return sb.rpc("set_my_avatar",{p_url:u}).then(function(r){if(r.error)throw r.error;me.profile.avatar_url=u;draw()})}
el("avDel").onclick=function(){
  if(!armed){armed=true;this.textContent="Ketuk lagi untuk hapus";return}
  closeMenu();setUrl(null).then(function(){clean();toast("Foto dihapus.",null,true)}).catch(fail)};

/* Posisi foto: x,y = sudut kiri atas gambar pada kanvas 256px; tidak boleh menyisakan celah */
function scale(){return SIZE/Math.min(img.naturalWidth,img.naturalHeight)*z}
function paint(){var s=scale(),w=img.naturalWidth*s,h=img.naturalHeight*s,c=cv.getContext("2d");
  x=Math.min(0,Math.max(SIZE-w,x));y=Math.min(0,Math.max(SIZE-h,y));
  c.fillStyle="#fff";c.fillRect(0,0,SIZE,SIZE);c.imageSmoothingQuality="high";c.drawImage(img,x,y,w,h)}
function zoom(n){var o=scale();z=Math.min(4,Math.max(1,n));var k=scale()/o,m=SIZE/2;x=m-(m-x)*k;y=m-(m-y)*k;el("avZoom").value=z;paint()}
function move(dx,dy){x+=dx;y+=dy;paint()}
file.onchange=function(){var f=file.files[0];if(!f)return;
  if(!/^image\//.test(f.type))return toast("Pilih berkas gambar.");
  if(f.size>MAX_IN)return toast("Foto terlalu besar. Maksimal 10 MB.");
  var u=URL.createObjectURL(f),i=new Image();
  i.onload=function(){URL.revokeObjectURL(u);img=i;z=1;var s=scale();x=(SIZE-i.naturalWidth*s)/2;y=(SIZE-i.naturalHeight*s)/2;el("avZoom").value=1;paint();dlg.showModal()};
  i.onerror=function(){URL.revokeObjectURL(u);toast("Foto tidak bisa dibaca. Coba JPG atau PNG.")};
  i.src=u};
el("avZoom").oninput=function(){zoom(+this.value)};
var pts={},st=el("avStage");
function gap(){var k=Object.keys(pts);return k.length<2?0:Math.hypot(pts[k[0]].x-pts[k[1]].x,pts[k[0]].y-pts[k[1]].y)}
st.onpointerdown=function(e){pts[e.pointerId]={x:e.clientX,y:e.clientY};try{st.setPointerCapture(e.pointerId)}catch(x){}};
st.onpointermove=function(e){var p=pts[e.pointerId];if(!p||busy)return;var before=gap(),dx=e.clientX-p.x,dy=e.clientY-p.y,r=SIZE/st.clientWidth;
  pts[e.pointerId]={x:e.clientX,y:e.clientY};if(before)zoom(z*gap()/before);else move(dx*r,dy*r)};
st.onpointerup=st.onpointercancel=function(e){delete pts[e.pointerId]};
st.onkeydown=function(e){var d={ArrowLeft:[-6,0],ArrowRight:[6,0],ArrowUp:[0,-6],ArrowDown:[0,6]}[e.key];if(d){e.preventDefault();move(d[0],d[1])}};
el("avCancel").onclick=function(){dlg.close()};
dlg.addEventListener("cancel",function(e){if(busy)e.preventDefault()});
dlg.addEventListener("close",function(){pts={}});
function lock(on){busy=on;el("avSave").disabled=el("avCancel").disabled=on;el("avSave").textContent=on?"Menyimpan…":"Simpan foto"}
function blob(type){return new Promise(function(ok){cv.toBlob(ok,type,.88)})}
el("avSave").onclick=function(){if(busy)return;lock(true);
  blob("image/webp").then(function(b){return b&&b.type==="image/webp"?b:blob("image/jpeg")}).then(function(b){
    if(!b||b.size>MAX_OUT)throw new Error("ukuran");
    var path=me.user.id+"/"+Date.now()+(b.type==="image/webp"?".webp":".jpg"),f=sb.storage.from(B);
    return f.upload(path,b,{contentType:b.type,cacheControl:"31536000"}).then(function(r){if(r.error)throw r.error;
      return setUrl(f.getPublicUrl(path).data.publicUrl).then(function(){clean(path)},function(e){f.remove([path]);throw e})})
  }).then(function(){lock(false);dlg.close();toast("Foto profil tersimpan.",null,true)}).catch(function(e){lock(false);dlg.close();fail(e)})};
})();
