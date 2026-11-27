/* Inti menu AI di panel admin (murni, tanpa DOM, bisa diuji di Node: tests/ai-core.test.js).
   Mengolah hasil rpc admin_ai_* (repo ai.gowithdme.com: supabase/admin_ai.sql) menjadi angka dan label yang siap ditampilkan.
   Fungsi statistik hanya memegang agregat; fungsi person dan isMissingChat hanya membentuk label dari hasil rpc admin_ai_people/admin_ai_person (supabase/admin_ai_chat.sql). */
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();else root.AI_CORE=factory();
})(typeof self!=="undefined"?self:this,function(){
  var TOPIC={krisis:"Perlu perhatian (hanya hitungan)",curhat:"Curhat",sapaan:"Sapaan / terima kasih",cari_teman:"Cari teman jalan",cafe_makan:"Cafe & makan",
    gunung:"Gunung",konser:"Konser & festival",trip:"Trip & liburan",pencarian:"Pencarian situs",lainnya:"Lainnya"};
  var DEVICE={mobile:"HP",tablet:"Tablet",desktop:"Laptop / PC","?":"Tidak diketahui"};
  var MODE={ngobrol:"Ngobrol",gunung:"Gunung",konser:"Konser",trip:"Trip",search:"Pencarian situs"};
  var ERR={busy:"Lagi ramai / gagal",kuota:"Kuota penyedia penuh",down:"Model dimatikan penyedia",auth:"Key ditolak"};
  var REASON={ngarang:"Ngarang",salah:"Info salah",kurang:"Kurang membantu",tanpa:"Tanpa alasan"};
  var HEALTH={ok:"Hidup",gone:"Dimatikan penyedia",auth:"Key ditolak",down:"Tidak terjangkau"};

  function label(map,k){return map[k]||String(k==null?"?":k)}
  function num(x){x=+x;return isFinite(x)?x:0}
  function pct(n,total){n=num(n);total=num(total);return total>0?Math.round(n/total*100):0}
  /* "1,2 dtk" / "850 md" / "—" */
  function ms(v){if(v==null||!isFinite(+v))return"—";v=+v;return v<1000?Math.round(v)+" md":(Math.round(v/100)/10).toString().replace(".",",")+" dtk"}
  /* 1.250.000 -> "1,3 jt"; 12.500 -> "12,5 rb" */
  function tok(v){v=num(v);if(v>=1e6)return(Math.round(v/1e5)/10).toString().replace(".",",")+" jt";if(v>=1e3)return(Math.round(v/100)/10).toString().replace(".",",")+" rb";return String(Math.round(v))}
  function rp(v){return"Rp"+Math.round(num(v)).toLocaleString("id-ID")}
  /* Biaya perkiraan dari token (harga per 1 juta token). Token itu sendiri sudah perkiraan (1 token ≈ 4 karakter). */
  function cost(tin,tout,priceIn,priceOut){return num(tin)/1e6*Math.max(0,num(priceIn))+num(tout)/1e6*Math.max(0,num(priceOut))}

  /* Jam ramai: tiga jam dengan permintaan terbanyak (hanya yang > 0), urut dari yang paling ramai. */
  function peakHours(hours){
    return (hours||[]).filter(function(x){return num(x.n)>0}).slice().sort(function(a,b){return num(b.n)-num(a.n)||num(a.h)-num(b.h)}).slice(0,3)
      .map(function(x){var h=num(x.h);return{h:h,n:num(x.n),text:("0"+h).slice(-2)+".00–"+("0"+((h+1)%24)).slice(-2)+".00"}});
  }
  /* Jumlah per minggu (Senin–Minggu) dari baris harian {d:'YYYY-MM-DD',req,chats}. Perangkat unik TIDAK dijumlahkan (akan terhitung ganda). */
  function weekly(daily){
    var out=[],cur=null;
    (daily||[]).forEach(function(r){
      var d=new Date(r.d+"T00:00:00Z"),dow=(d.getUTCDay()+6)%7;
      var mon=new Date(d.getTime()-dow*86400000).toISOString().slice(0,10);
      if(!cur||cur.week!==mon){cur={week:mon,req:0,chats:0,days:0};out.push(cur)}
      cur.req+=num(r.req);cur.chats+=num(r.chats);cur.days++;
    });
    return out;
  }
  /* Bagi menjadi baris {k,label,n,pct} untuk diagram batang horizontal. */
  function shares(items,map){
    var tot=(items||[]).reduce(function(s,i){return s+num(i.n)},0);
    return (items||[]).map(function(i){return{k:i.k,label:label(map||{},i.k),n:num(i.n),pct:pct(i.n,tot)}});
  }
  /* Ringkasan rating: share 👍, dan apakah kolom "ngarang" mendominasi alasan 👎. */
  function ratingSummary(r){
    r=r||{};var up=num(r.up),down=num(r.down),tot=up+down;
    var reasons=shares(r.reasons,REASON),top=reasons.length?reasons[0]:null;
    return{up:up,down:down,total:tot,upPct:pct(up,tot),pending:num(r.pending),approved:num(r.approved),reasons:reasons,
      topReason:top&&top.k!=="tanpa"?top:null};
  }
  /* Persentase gagal dari totals {requests, failed}. */
  function errPct(t){t=t||{};return pct(t.failed,t.requests)}
  /* Status /health Worker: kembalikan daftar {name,status,label,ok} dan ringkasan. */
  function healthRows(h){
    var m=(h&&h.models)||{},rows=Object.keys(m).sort().map(function(k){return{name:k,status:m[k],label:label(HEALTH,m[k]),ok:m[k]==="ok"}});
    return{rows:rows,ok:!!(h&&h.ok),bad:rows.filter(function(r){return!r.ok}).length};
  }
  /* Apakah galat rpc berarti SQL admin_ai.sql belum dijalankan? */
  function isMissing(msg){return /admin_ai_|ai_usage|schema cache|does not exist|Could not find/i.test(String(msg||""))}
  function isDenied(msg){return /hanya pemilik|42501|permission denied/i.test(String(msg||""))}

  /* Percakapan per orang: nama tampil, inisial avatar, kunci unik (akun login atau perangkat tamu), label kota. */
  function personName(p){p=p||{};var n=String(p.name||"").trim();return n||(p.user_id?"(tanpa nama)":"Tamu (belum login)")}
  function personInitial(p){p=p||{};var n=String(p.name||"").trim();return n?n.charAt(0).toUpperCase():(p.user_id?"?":"T")}
  function personKey(p){p=p||{};return p.user_id?String(p.user_id):(p.device?"d:"+p.device:"")}
  function placeLabel(p){p=p||{};var a=[p.city,p.region].filter(Boolean);return a.length?a.join(", "):"Lokasi tidak diketahui"}
  function isMissingChat(msg){return /admin_ai_people|admin_ai_person|admin_ai_sessions|ai_chat_|schema cache|does not exist|Could not find/i.test(String(msg||""))}

  /* Riwayat per obrolan (meniru bilah samping ai.gowithdme.com): judul, suasana Dea, "3 jam lalu". */
  var PERSONA={ceria:"Ceria",galak:"Galak",manja:"Manja"};
  function sessionTitle(s){var t=String((s&&s.title)||"").replace(/\s+/g," ").trim();return t||"Obrolan tanpa judul"}
  function ago(ts,now){var t=new Date(ts).getTime(),n=now==null?Date.now():+now;if(!isFinite(t))return"—";
    var d=Math.max(0,Math.round((n-t)/1000));
    if(d<60)return"baru saja";if(d<3600)return Math.floor(d/60)+" mnt lalu";if(d<86400)return Math.floor(d/3600)+" jam lalu";
    if(d<2592000)return Math.floor(d/86400)+" hari lalu";return Math.floor(d/2592000)+" bln lalu"}
  function sessionMeta(s){s=s||{};return[PERSONA[s.persona],s.mode?label(MODE,s.mode):null,(+s.messages||0)+" pesan"].filter(Boolean).join(" · ")}

  return{PERSONA:PERSONA,sessionTitle:sessionTitle,ago:ago,sessionMeta:sessionMeta,personName:personName,personInitial:personInitial,personKey:personKey,placeLabel:placeLabel,isMissingChat:isMissingChat,TOPIC:TOPIC,DEVICE:DEVICE,MODE:MODE,ERR:ERR,REASON:REASON,HEALTH:HEALTH,label:label,pct:pct,ms:ms,tok:tok,rp:rp,cost:cost,
    peakHours:peakHours,weekly:weekly,shares:shares,ratingSummary:ratingSummary,errPct:errPct,healthRows:healthRows,isMissing:isMissing,isDenied:isDenied};
});
