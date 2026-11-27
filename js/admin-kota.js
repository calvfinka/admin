/* Tambah kota baru langsung dari form event (RPC admin_add_city). */
(function(){
var $=function(i){return document.getElementById(i)};
function say(t,k){if(window.msg)window.msg(t,k)}
var esc=window.esc;
function init(){
  var sel=$("f_city_id");if(!sel||$("kotaBaru"))return;
  var lab=sel.closest("label");
  var wrap=document.createElement("div");wrap.id="kotaBaru";wrap.style.cssText="grid-column:1/-1;margin:-2px 0 6px";
  wrap.innerHTML='<button type="button" class="lnk" id="kbOpen">Kota belum ada? + Tambah kota baru</button>'
   +'<div id="kbForm" hidden style="display:none;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:6px">'
   +'<label class="f" style="flex:1 1 140px">Nama kota<input id="kbName" type="text" maxlength="60" placeholder="contoh: Purwokerto"></label>'
   +'<label class="f" style="flex:1 1 140px">Provinsi<select id="kbProv"><option value="">Memuat…</option></select></label>'
   +'<button type="button" class="btn pri sm" id="kbSave">Simpan kota</button>'
   +'<button type="button" class="btn sm" id="kbCancel">Batal</button></div>';
  lab.parentNode.insertBefore(wrap,lab.nextSibling);
  var f=$("kbForm"),loaded=false;
  function show(on){f.style.display=on?"flex":"none";f.hidden=!on}
  $("kbOpen").onclick=function(){show(true);if(loaded)return;loaded=true;
    sb.from("provinces").select("name").order("name").then(function(r){
      var a=(r.data||[]);$("kbProv").innerHTML='<option value="">Pilih provinsi</option>'+a.map(function(p){return'<option>'+esc(p.name)+'</option>'}).join("");
      if(r.error||!a.length)say("Daftar provinsi tidak bisa dimuat. Tambahkan kota lewat SQL.","err")})};
  $("kbCancel").onclick=function(){show(false)};
  $("kbSave").onclick=function(){
    var n=$("kbName").value.trim(),p=$("kbProv").value;
    if(!n||!p)return say("Isi nama kota dan pilih provinsi.","err");
    sb.rpc("admin_add_city",{p_name:n,p_province:p}).then(function(r){
      if(r.error)return say(r.error.message,"err");
      var id=String(r.data);
      Promise.all([window.loadCities($("f_city_id"),true),window.loadCities($("flCity"),true).then(function(){$("flCity").options[0].text="Semua kota"})]).then(function(){
        $("f_city_id").value=id;show(false);$("kbName").value="";say("Kota \""+n+"\" siap dipakai.","ok")})})};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
