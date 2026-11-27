/* Tahap 2 - skor kelengkapan adaptif (dipakai editor dan daftar). Hanya membaca data; tidak menyentuh Supabase/RBAC.
   window.IBC.score(rec, kind, extraCount) -> {items:[{k,l,ok,req}], done, total, pct, reqDone, reqTotal, ready} */
(function(){
var T=function(s){return String(s==null?"":s).trim()};
function pr(s){s=T(s);return !!s&&!/menyusul/i.test(s)&&!/^info/i.test(s)}
function lu(s){s=T(s);return !!s&&!/menyusul/i.test(s)}
window.IBC={score:function(o,kind,ex){
  kind=kind||o.category||o.kind||"konser";var gn=kind==="naikgunung",it=[];
  if(ex==null)ex=o.extra_posters&&o.extra_posters.length||0;
  function add(k,l,ok,req){it.push({k:k,l:l,ok:!!ok,req:!!req})}
  add("title","Judul",T(o.title),1);add("city","Kota",T(o.city_id),1);add("date","Tanggal mulai",T(o.event_date),1);
  add("poster","Poster",T(o.poster_url),1);add("venue",gn?"Basecamp":"Lokasi",T(o.venue),1);add("org","Penyelenggara",T(o.organizer),1);
  if(gn)add("mtn","Nama gunung",T(o.mountain),1);
  if(kind==="konser")add("genre","Genre",T(o.genre),0);
  if(!gn&&kind!=="pameran")add("lineup","Line-up",lu(o.lineup),0);
  if(gn){add("alt","Ketinggian (mdpl)",T(o.altitude_mdpl),0);add("dif","Tingkat kesulitan",T(o.difficulty),0);add("dur","Durasi",T(o.duration),0);add("quota","Kuota",T(o.quota),0);add("wa","Kontak WA",T(o.contact_wa),0)}
  add("price","Harga",pr(o.price_label),0);add("desc","Deskripsi (min. 50 huruf)",T(o.description).length>=50,0);
  add("ticket","Link tiket / daftar",T(o.ticket_url),0);add("ig","Sumber IG",T(o.source_ig),0);
  if(T(o.end_date)&&T(o.event_date)&&o.end_date>o.event_date)add("p2","Poster Hari 2",ex>=1,0);
  var done=it.filter(function(x){return x.ok}).length,rq=it.filter(function(x){return x.req}),rd=rq.filter(function(x){return x.ok}).length;
  return{items:it,done:done,total:it.length,pct:Math.round(done/it.length*100),reqDone:rd,reqTotal:rq.length,ready:done===it.length}
}}})();
