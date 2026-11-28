/* Panel Admin > Kelola Template. Login, 2FA, dan guard memakai milik panel; tulis data dijaga RLS (supabase/schema_template.sql). */
(function(){
  var box=document.getElementById("v_template");
  if(!box||!window.sb)return;
  var $=function(i){return document.getElementById(i)},esc=window.esc,SLUG="gwm-majalah";
  var rows=[],editing=null,busy=false;
  function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date())}
  function say(t,bad){var e=$("tpMsg");e.textContent=t||"";e.style.color=bad?"var(--err)":""}
  function need(r){if(r.error)throw r.error;return r.data}
  function why(e){var m=e&&e.message||String(e);return /tpl_versions|schema cache/i.test(m)&&/exist|find|cache/i.test(m)?"Jalankan supabase/schema_template.sql di SQL Editor dulu.":m}
  function cmp(a,b){return String(b.release_date).localeCompare(a.release_date)||b.version.localeCompare(a.version,undefined,{numeric:true})}
  function draw(){
    $("tpList").innerHTML=rows.length?rows.map(function(r){var v=esc(r.version);
      return'<div class="tp-item"><b>v'+v+'</b> '+(r.is_latest?'<span class="badge pub">Latest</span>':'')+'<div class="meta">'+esc(r.release_date)+' · '+esc(r.file_path)+'</div><p>'+esc(r.changelog)+'</p><div class="row"><button class="btn ghost sm" type="button" data-t="edit" data-ver="'+v+'">Edit</button>'+(r.is_latest?'':'<button class="btn sm" type="button" data-t="latest" data-ver="'+v+'">Set sebagai Latest</button>')+'<button class="btn ghost sm" type="button" data-t="del" data-ver="'+v+'">Hapus</button></div></div>'}).join(""):'<p class="meta">Belum ada versi. Isi formulir di atas untuk merilis yang pertama.</p>';
  }
  function load(){
    $("tpList").innerHTML='<p class="meta">Memuat…</p>';
    return sb.from("tpl_versions").select("*").eq("slug",SLUG).then(function(r){rows=need(r).sort(cmp);draw()}).catch(function(e){$("tpList").innerHTML='<p class="meta">'+esc(why(e))+'</p>'});
  }
  function reset(){editing=null;$("tpForm").reset();$("tpDate").value=today();$("tpVer").disabled=false;$("tpLatest").disabled=false;$("tpCancel").hidden=true;$("tpTitle").textContent="Rilis baru";$("tpSave").textContent="Terbitkan";$("tpFileLbl").textContent="File template (.xml, maks 5 MB)";say("")}
  function edit(r){reset();editing=r;$("tpVer").value="v"+r.version;$("tpVer").disabled=true;$("tpDate").value=r.release_date;$("tpLog").value=r.changelog;$("tpLatest").checked=r.is_latest;$("tpLatest").disabled=r.is_latest;$("tpCancel").hidden=false;$("tpTitle").textContent="Edit v"+r.version;$("tpSave").textContent="Simpan perubahan";$("tpFileLbl").textContent="Ganti file .xml (opsional, maks 5 MB)";$("tpForm").scrollIntoView()}
  $("tpForm").addEventListener("submit",function(ev){
    ev.preventDefault();if(busy)return;
    var ver=$("tpVer").value.trim().toLowerCase().replace(/^v/,""),f=$("tpFile").files[0],old=editing;
    var row={release_date:$("tpDate").value,changelog:$("tpLog").value.trim(),is_latest:$("tpLatest").checked};
    if(!/^\d+(\.\d+){0,3}(-[a-z0-9.]+)?$/.test(ver))return say("Format versi: v10.3",true);
    if(!old&&rows.some(function(r){return r.version===ver}))return say("Versi v"+ver+" sudah ada. Pakai tombol Edit.",true);
    if(!old&&!f)return say("Pilih file .xml dulu.",true);
    if(f&&!/\.xml$/i.test(f.name))return say("File harus berakhiran .xml.",true);
    if(f&&(!f.size||f.size>5242880))return say("File kosong atau lebih dari 5 MB.",true);
    var path=old?old.file_path:SLUG+"/v"+ver+".xml";
    busy=true;$("tpSave").disabled=true;say("Menyimpan…");
    (f?sb.storage.from("templates").upload(path,f,{upsert:true,contentType:"application/xml"}).then(need):Promise.resolve())
    .then(function(){
      var q=sb.from("tpl_versions");
      if(old)return q.update(row).eq("slug",SLUG).eq("version",ver).select().then(need).then(function(d){if(!d.length)throw new Error("Tidak tersimpan. Hanya Pemilik yang boleh mengubah.")});
      row.slug=SLUG;row.version=ver;row.file_path=path;return q.insert(row).then(need);
    }).then(function(){reset();say(old?"Perubahan disimpan.":"v"+ver+" diterbitkan.");return load()})
    .catch(function(e){say(why(e),true)}).then(function(){busy=false;$("tpSave").disabled=false});
  });
  $("tpList").addEventListener("click",function(ev){
    var b=ev.target.closest("[data-t]");if(!b||busy)return;
    var r=rows.filter(function(x){return x.version===b.dataset.ver})[0],t=b.dataset.t;if(!r)return;
    if(t==="edit")return edit(r);
    if(t==="del"&&r.is_latest&&rows.length>1)return say("Pindahkan status Latest ke versi lain sebelum menghapus.",true),$("tpMsg").scrollIntoView({block:"center"});
    window.admAsk({title:(t==="del"?"Hapus v":"Jadikan terbaru: v")+r.version+"?",ok:t==="del"?"Hapus":"Lanjutkan"}).then(function(ok){
      if(ok===null)return;
      busy=true;
      var q=sb.from("tpl_versions"),p=(t==="del"?q.delete():q.update({is_latest:true})).eq("slug",SLUG).eq("version",r.version).select().then(need).then(function(d){
        if(!d.length)throw new Error("Ditolak. Hanya Pemilik yang boleh mengubah.");
        if(t==="del")return sb.storage.from("templates").remove([r.file_path]).then(need);
      });
      p.then(function(){reset();return load()}).catch(function(e){say(why(e),true)}).then(function(){busy=false});
    });
  });
  $("tpCancel").addEventListener("click",reset);
  $("tpRefresh").addEventListener("click",load);
  reset();
  new MutationObserver(function(){if(!box.hidden&&window.IB_ADMIN&&IB_ADMIN.owner)load()}).observe(box,{attributes:true,attributeFilter:["hidden"]});
})();
