/* Inti hak akses panel admin (murni, tanpa DOM, bisa diuji di Node).
   Sumber kebenaran ada di database (supabase/schema_rbac.sql); berkas ini hanya untuk tampilan.
   Katalog & preset di sini HARUS sama dengan rbac_all_perms() dan tabel admin_roles di SQL (dicek oleh tests/rbac.test.js). */
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();else root.RBAC=factory();
})(typeof self!=="undefined"?self:this,function(){
  /* Kelompok -> daftar izin. Urutan dipakai untuk tampilan form. */
  var GROUPS=[
    {key:"events",label:"Event & Pendakian",perms:[
      ["events.view","Melihat semua event (termasuk draft)"],
      ["events.create","Membuat event baru (draft)"],
      ["events.edit","Mengubah isi event"],
      ["events.publish","Menerbitkan / menarik event"],
      ["events.delete","Menghapus event"],
      ["events.review","Menyetujui / menolak pengajuan publik"],
      ["events.feature","Mengatur event Disorot & boost (sponsor)"]]},
    {key:"posters",label:"Poster",perms:[
      ["posters.upload","Mengunggah poster"],
      ["posters.delete","Menghapus poster"]]},
    {key:"content",label:"Blog & Arsip",perms:[
      ["blog.manage","Mengelola artikel blog, komentar, pemeriksaan"],
      ["arsip.manage","Mengelola arsip blog (impor, hapus koleksi)"]]},
    {key:"community",label:"Komunitas",perms:[
      ["forum.moderate","Moderasi kiriman forum yang dilaporkan"],
      ["forum.ban","Blokir / buka blokir pengguna forum"],
      ["forum.config","Atur kota & grup forum"],
      ["invitations.moderate","Moderasi ajakan (tutup ajakan, lihat laporan)"],
      ["chat.moderate","Melihat laporan pesan"]]},
    {key:"safety",label:"Filter Kata",perms:[
      ["words.view","Melihat log kata terlarang"],
      ["words.manage","Tambah / hapus kata terlarang"]]},
    {key:"biz",label:"Sponsor",perms:[
      ["sponsor.view","Melihat lead sponsor"],
      ["sponsor.manage","Ubah lead & aktifkan sponsor"]]},
    {key:"data",label:"Data & Pengguna",perms:[
      ["stats.view","Melihat statistik situs"],
      ["users.view","Melihat daftar pengguna (email disamarkan)"]]}
  ];
  var ALL=[];GROUPS.forEach(function(g){g.perms.forEach(function(p){ALL.push(p[0])})});
  /* Izin yang otomatis ikut (karena butuh baca data). Sama dengan rbac_expand() di SQL. */
  var IMPLIES={
    "events.create":["events.view"],"events.edit":["events.view"],"events.publish":["events.view"],"events.delete":["events.view"],
    "events.review":["events.view"],"events.feature":["events.view"],
    "forum.ban":["forum.moderate"],"forum.config":["forum.moderate"],
    "words.manage":["words.view"],"sponsor.manage":["sponsor.view"]
  };
  /* Preset peran. "owner" = semua izin + kelola admin; "custom" = daftar izin dipilih sendiri. */
  var PRESETS=[
    {key:"editor",label:"Editor Konten",desc:"Membuat, mengubah, dan menerbitkan event serta blog. Tanpa moderasi dan data pengguna.",
     perms:["events.view","events.create","events.edit","events.publish","posters.upload","posters.delete","blog.manage"]},
    {key:"kontributor",label:"Kontributor",desc:"Hanya membuat dan mengubah draft; tidak bisa menerbitkan atau menghapus.",
     perms:["events.view","events.create","events.edit","posters.upload","blog.manage"]},
    {key:"moderator",label:"Moderator Komunitas",desc:"Memeriksa pengajuan event, laporan forum, blokir, ajakan, dan log kata terlarang.",
     perms:["events.view","events.review","forum.moderate","forum.ban","invitations.moderate","chat.moderate","words.view"]},
    {key:"sponsor",label:"Manajer Sponsor",desc:"Mengelola lead sponsor dan event Disorot.",
     perms:["events.view","events.feature","sponsor.view","sponsor.manage"]},
    {key:"analis",label:"Analis",desc:"Hanya melihat statistik dan daftar pengguna (tanpa mengubah apa pun).",
     perms:["stats.view","users.view"]},
    {key:"custom",label:"Kustom",desc:"Pilih sendiri izin satu per satu.",perms:[]}
  ];
  /* Tampilan panel -> izin yang membukanya (salah satu cukup). null = selalu boleh, "owner" = hanya pemilik. */
  var VIEW_PERMS={
    dash:null,stats:["stats.view"],review:["events.review"],
    forum:["forum.moderate","forum.ban","forum.config"],words:["words.view","words.manage"],
    sponsor:["sponsor.view","sponsor.manage"],iklan:["sponsor.view","sponsor.manage"],list:["events.view"],form:["events.create","events.edit"],
    blog:["blog.manage"],arsip:["arsip.manage"],admins:"owner"
  };
  var ACTION_PERMS={ /* tombol aksi di daftar event: data-a -> izin */
    edit:"events.edit",ok:"events.review",no:"events.review",tog:"events.publish",dup:"events.create",del:"events.delete"
  };

  function expand(perms){
    var out={};(perms||[]).forEach(function(p){
      if(ALL.indexOf(p)<0)return;out[p]=1;(IMPLIES[p]||[]).forEach(function(q){out[q]=1})});
    return ALL.filter(function(p){return out[p]});
  }
  function presetPerms(key){
    for(var i=0;i<PRESETS.length;i++)if(PRESETS[i].key===key)return expand(PRESETS[i].perms);
    return [];
  }
  /* admin = hasil my_admin(): {owner,active,perms[]} */
  function can(admin,perm){
    if(!admin||!admin.active)return false;
    if(admin.owner)return true;
    return (admin.perms||[]).indexOf(perm)>-1;
  }
  function canView(admin,view){
    if(!admin||!admin.active)return false;
    var need=VIEW_PERMS[view];
    if(need===undefined)return false;
    if(need==="owner")return !!admin.owner;
    if(need===null)return true;
    return need.some(function(p){return can(admin,p)});
  }
  function allowedViews(admin){return Object.keys(VIEW_PERMS).filter(function(v){return canView(admin,v)})}
  function missing(admin){return ALL.filter(function(p){return !can(admin,p)})}
  /* Preset yang cocok persis dengan daftar izin; kalau tidak ada -> "custom" */
  function detectPreset(perms){
    var a=expand(perms).join("|");
    for(var i=0;i<PRESETS.length;i++){if(PRESETS[i].key==="custom")continue;if(presetPerms(PRESETS[i].key).join("|")===a)return PRESETS[i].key}
    return "custom";
  }
  return{GROUPS:GROUPS,ALL:ALL,IMPLIES:IMPLIES,PRESETS:PRESETS,VIEW_PERMS:VIEW_PERMS,ACTION_PERMS:ACTION_PERMS,
    expand:expand,presetPerms:presetPerms,can:can,canView:canView,allowedViews:allowedViews,missing:missing,detectPreset:detectPreset};
});
