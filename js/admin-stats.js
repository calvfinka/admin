/* Statistik Panel Admin: pengunjung situs, pengguna terdaftar, dan konten. Data dari supabase/schema_statistik.sql (admin_stats, admin_users).
   Juga mengurus penanda "perlu tindakan" di Beranda dan menu bawah/samping. Tanpa pustaka grafik: semua diagram dibuat dari SVG/CSS. */
(function(){
if(!window.sb||!$("v_stats"))return;
var settled=false,days=30,tab="visit",D=null,loading=false,UQ="",UOFF=0,UTOT=0,UROWS=[];
var BD=null,BLOAD=false,BREC=[],BREC_ERR="",BFAIL="",BHOST="",BSRC="";
var NF=new Intl.NumberFormat("id-ID"),MON=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
var PAGE={beranda:"Beranda",event:"Semua event",gunung:"Naik gunung",komunitas:"Komunitas",ajukan:"Ajukan event",bantuan:"Bantuan",login:"Masuk / daftar",profil:"Profil",pesan:"Pesan",privacy:"Kebijakan privasi",terms:"Syarat & ketentuan"};
var DEV={mobile:"Ponsel",tablet:"Tablet",desktop:"Komputer","?":"Tidak diketahui"},LNG={id:"Indonesia",en:"English","?":"Tidak diketahui"};
var CATN={konser:"Konser",naikgunung:"Naik gunung",pameran:"Pameran",festival:"Festival",komedi:"Komedi",seminar:"Seminar",meetup:"Meetup",lainnya:"Lainnya"};
var STN={published:"Terbit",draft:"Draft",pending:"Menunggu",rejected:"Ditolak"};
function n(x){return NF.format(+x||0)}
function dm(s){var d=new Date(s+"T00:00:00");return d.getDate()+" "+MON[d.getMonth()]}
function ago(ts){if(!ts)return"belum pernah";var s=(new Date(ts).getTime()-Date.now())/1000,a=Math.abs(s),r;
  try{r=new Intl.RelativeTimeFormat("id",{numeric:"auto"})}catch(e){return""}
  if(a<3600)return"baru saja";if(a<86400)return r.format(Math.round(s/3600),"hour");if(a<86400*45)return r.format(Math.round(s/86400),"day");return r.format(Math.round(s/86400/30),"month")}
function pname(p){if(PAGE[p])return PAGE[p];if(p.indexOf("blog")===0)return"Blog"+(p.length>4?" · "+p.slice(5):"");return"/"+p}
function trend(cur,prev){if(!prev)return cur?'<em class="tr up">baru</em>':"";var p=Math.round((cur-prev)/prev*100);if(!p)return'<em class="tr">sama seperti periode lalu</em>';
  return'<em class="tr '+(p>0?"up":"down")+'">'+(p>0?"▲ ":"▼ ")+Math.abs(p)+"% dari "+days+" hari sebelumnya</em>"}
function kpi(label,val,sub,hint){return'<div class="kp"><small>'+esc(label)+'</small><b>'+n(val)+'</b>'+(sub||"")+(hint?'<span class="kn">'+esc(hint)+"</span>":"")+"</div>"}
function hbars(items,lab,key,total){var mx=Math.max.apply(null,items.map(function(i){return i[key]}).concat([1]));
  return items.length?'<div class="hb">'+items.map(function(i){var v=i[key],w=Math.max(2,Math.round(v/mx*100));
    return'<div class="hr"><span class="hl">'+esc(lab(i))+'</span><span class="hv"><i style="width:'+w+'%"></i></span><b>'+n(v)+(total?' <small>'+Math.round(v/total*100)+"%</small>":"")+"</b></div>"}).join("")+"</div>":'<p class="meta">Belum ada data.</p>'}
/* diagram batang harian: batang terang = tayangan, batang gelap = pengunjung unik */
function daily(rows,k1,k2,l1,l2){var W=640,H=150,pl=34,pb=20,pt=8,w=W-pl,h=H-pb-pt,mx=Math.max.apply(null,rows.map(function(r){return r[k1]}).concat([1]));
  var bw=w/rows.length,g=rows.length>45?0:1,o="";
  [0,.5,1].forEach(function(f){var y=pt+h-h*f;o+='<line x1="'+pl+'" x2="'+W+'" y1="'+y+'" y2="'+y+'" class="gl"/><text x="'+(pl-6)+'" y="'+(y+4)+'" text-anchor="end">'+n(Math.round(mx*f))+"</text>"});
  rows.forEach(function(r,i){var x=pl+i*bw,a=r[k1]/mx*h,b=k2?r[k2]/mx*h:0;
    o+='<g><title>'+dm(r.d)+": "+n(r[k1])+" "+l1+(k2?", "+n(r[k2])+" "+l2:"")+'</title><rect x="'+(x+g/2)+'" y="'+(pt+h-a)+'" width="'+Math.max(1,bw-g)+'" height="'+Math.max(0,a)+'" class="b1"/>'+
      (k2?'<rect x="'+(x+g/2)+'" y="'+(pt+h-b)+'" width="'+Math.max(1,bw-g)+'" height="'+Math.max(0,b)+'" class="b2"/>':"")+"</g>"});
  var step=rows.length>45?15:rows.length>14?7:1;
  rows.forEach(function(r,i){if((i%step===0&&(rows.length-1-i>=step/2||i===rows.length-1))||i===rows.length-1)o+='<text x="'+(pl+i*bw+bw/2)+'" y="'+(H-5)+'" text-anchor="middle">'+dm(r.d)+"</text>"});
  var tot=rows.reduce(function(s,r){return s+r[k1]},0);
  return'<div class="ch"><svg viewBox="0 0 '+W+" "+H+'" role="img" aria-label="Diagram harian '+esc(l1)+": total "+tot+'">'+o+'</svg></div><p class="lg"><i class="b1"></i>'+esc(l1)+(k2?' <i class="b2"></i>'+esc(l2):"")+"</p>"}
function hours(a,unit,tip){unit=unit||"tayangan";var mx=Math.max.apply(null,a.concat([1])),best=a.indexOf(Math.max.apply(null,a));
  return'<div class="hrs">'+a.map(function(v,i){return'<span title="Jam '+i+": "+n(v)+' '+unit+'"><i class="'+(i===best&&v?"top":"")+'" style="height:'+Math.max(3,Math.round(v/mx*100))+'%"></i></span>'}).join("")+'</div><div class="hrl"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>'+
    (Math.max.apply(null,a)?'<p class="meta">Paling ramai sekitar pukul '+("0"+best).slice(-2)+".00 WIB."+(tip===undefined?" Cocok untuk jadwal unggah event.":tip)+"</p>":"")}
function card(t,body,sub){return'<div class="card sc"><h3>'+esc(t)+"</h3>"+(sub?'<p class="meta">'+esc(sub)+"</p>":"")+body+"</div>"}
function fail(e){var m=e&&e.message||"";$("stBody").innerHTML='<div class="card"><h3>'+(/admin_stats|schema cache|does not exist|Could not find/i.test(m)?"Statistik belum dipasang di Supabase":"Statistik gagal dimuat")+"</h3><p>"+
  (/admin_stats|schema cache|does not exist|Could not find/i.test(m)?"Buka Supabase &gt; SQL Editor, jalankan isi file <code>supabase/schema_statistik.sql</code>, lalu muat ulang halaman ini.":esc(m||"Coba lagi sebentar lagi."))+'</p><button class="btn" id="stRetry" type="button">Coba lagi</button></div>'}

/* ---- Pengunjung ---- */
function visit(){var t=D.traffic||{},off=false;try{off=localStorage.getItem("gwm_notrack")==="1"}catch(e){}
  t.devices=t.devices||[];t.langs=t.langs||[];t.daily=t.daily||[];t.pages=t.pages||[];t.events=t.events||[];t.refs=t.refs||[];t.hours=t.hours||[];
  var tot=t.devices.reduce(function(s,x){return s+x.n},0),ltot=t.langs.reduce(function(s,x){return s+x.n},0);
  var empty=!t.first_hit?'<div class="msg">Belum ada data kunjungan. Data mulai terkumpul setelah situs yang sudah berisi <code>js/track.js</code> dibuka pengunjung (kunjunganmu sendiri juga terhitung, kecuali kamu mematikannya di bawah).</div>':"";
  return empty+'<div class="kps">'+kpi("Tayangan halaman",t.views,trend(t.views,t.prev_views),"Jumlah halaman yang dibuka")+kpi("Pengunjung unik",t.visitors,trend(t.visitors,t.prev_visitors),"Perkiraan jumlah browser berbeda")+
    kpi("Pengunjung baru",t.new_visitors,'<em class="tr">'+(t.visitors?Math.round(t.new_visitors/t.visitors*100):0)+"% dari pengunjung</em>","Belum pernah terlihat sebelum periode ini")+kpi("Hari ini",t.today_views,'<em class="tr">'+n(t.today_visitors)+" pengunjung</em>","Menurut WIB")+"</div>"+
    card("Kunjungan per hari",daily(t.daily,"views","visitors","tayangan","pengunjung"),"Batang gelap = pengunjung unik, terang = total tayangan.")+
    '<div class="g2s">'+card("Halaman terpopuler",hbars(t.pages,function(i){return pname(i.path)},"views"))+
    card("Event paling banyak dibuka",t.events.length?'<div class="hb">'+t.events.map(function(e){return'<div class="hr ev"><span class="hl">'+esc(e.title)+'<small>'+esc(e.city||"")+" · "+dm(e.date)+'</small></span><b>'+n(e.opens)+'<small> dibuka</small>'+(e.tickets?'<small> · '+n(e.tickets)+" klik tiket</small>":"")+"</b></div>"}).join("")+"</div>":'<p class="meta">Belum ada event yang dibuka dalam periode ini.</p>')+"</div>"+
    '<div class="g2s">'+card("Dari mana pengunjung datang",hbars((t.direct?[{k:"Langsung / tidak diketahui",n:t.direct}]:[]).concat(t.refs),function(i){return i.k},"n",t.visitors),"Situs yang mengarahkan ke GoWithDME.")+
    card("Jam ramai",hours(t.hours),"Tayangan per jam (WIB).")+"</div>"+
    '<div class="g2s">'+card("Perangkat",hbars(t.devices,function(i){return DEV[i.k]||i.k},"n",tot))+card("Bahasa",hbars(t.langs,function(i){return LNG[i.k]||i.k},"n",ltot))+"</div>"+
    '<div class="card sc"><h3>Cara membaca angka ini</h3><p class="meta">Pengunjung unik dihitung dari kode acak di browser, jadi satu orang dengan dua perangkat terhitung dua, dan yang menghapus data browser terhitung baru. Pengunjung dengan Do Not Track tidak dihitung. Tidak ada IP, cookie, atau data akun yang disimpan, sesuai Kebijakan Privasi.</p>'+
    '<div class="row"><button class="btn ghost sm" id="stNoTrack" type="button">'+(off?"Perangkat ini TIDAK dihitung. Hitung lagi":"Jangan hitung kunjungan perangkat ini")+"</button></div></div>"}

/* ---- Pengguna ---- */
function provName(p){return{google:"Google",facebook:"Facebook",discord:"Discord",github:"GitHub",email:"Email"}[String(p||"").toLowerCase()]||(p||"Email")}
function ulist(){return UROWS.map(function(u){var nm=u.nickname||"(tanpa nama)";
  return'<div class="us"><span class="ua"'+(u.avatar_url?" style=\"background:center/cover url('"+esc(u.avatar_url).replace(/'/g,"%27")+"')\"":"")+">"+(u.avatar_url?"":esc(nm.charAt(0).toUpperCase()))+'</span><div class="ub"><b>'+esc(nm)+"</b>"+(u.role==="admin"?' <span class="badge adm">Admin</span>':"")+(u.verified?' <span class="badge pub">Terverifikasi</span>':"")+
    '<div class="meta">'+[u.city,"gabung "+dm(u.joined.slice(0,10))+" "+u.joined.slice(0,4),"masuk terakhir "+ago(u.last_sign_in),provName(u.provider)].filter(Boolean).map(esc).join(" · ")+"</div>"+
    '<div class="meta">'+esc(u.email||"")+(u.posts||u.hosted||u.joined_n?" · "+n(u.posts)+" kiriman, "+n(u.hosted)+" ajakan dibuat, "+n(u.joined_n)+" ajakan diikuti":"")+"</div></div></div>"}).join("")||'<p class="meta">Tidak ada pengguna yang cocok.</p>'}
function users(){var u=(D.users&&typeof D.users==="object")?D.users:{total:+D.users||0};u.daily=u.daily||[];u.cities=u.cities||[];
  return'<div class="kps">'+kpi("Pengguna terdaftar",u.total,'<em class="tr">'+n(u.admins)+" admin, "+n(u.verified)+" terverifikasi</em>")+kpi("Pendaftar baru",u.new,trend(u.new,u.prev_new),"Dalam "+days+" hari terakhir")+
    kpi("Aktif 7 hari",u.active7,'<em class="tr">'+n(u.active30)+" aktif dalam 30 hari</em>","Pernah masuk akun")+kpi("Metode Masuk",n(u.google||0)+' OAuth','<em class="tr">Google / FB / Discord / GitHub · '+n(u.email)+" email</em>")+"</div>"+
    card("Pendaftar baru per hari",daily(u.daily.map(function(x){return{d:x.d,n:x.n}}),"n",null,"pendaftar"))+
    '<div class="g2s">'+card("Kota pengguna",hbars(u.cities,function(i){return i.k},"n"),n(u.with_city)+" dari "+n(u.total)+" pengguna mengisi kota.")+
    card("Kelengkapan profil",hbars([{k:"Sudah isi kota",n:u.with_city||0},{k:"Belum isi kota",n:Math.max(0,(u.total||0)-(u.with_city||0))}],function(i){return i.k},"n",u.total))+"</div>"+
    '<div class="card sc"><h3>Daftar pengguna</h3><p class="meta">Email disamarkan. Untuk memblokir penulis, pakai tab Diblokir di Tinjau &gt; Laporan komunitas.</p><div class="bar"><input id="uQ" type="search" placeholder="Cari nama atau email…" value="'+esc(UQ)+'"><button class="btn sm" id="uGo" type="button">Cari</button></div>'+
    '<div id="uList">'+ulist()+'</div><p class="meta" id="uInfo">'+n(UROWS.length)+" dari "+n(UTOT)+'</p>'+(UROWS.length<UTOT?'<div class="row"><button class="btn ghost sm" id="uMore" type="button">Tampilkan lebih banyak</button></div>':"")+"</div>"}
function loadUsers(more){if(!more){UOFF=0;UROWS=[]}
  return sb.rpc("admin_users",{p_q:UQ||null,p_limit:30,p_offset:UOFF}).then(function(r){if(r.error)return msg(r.error.message,"err");UTOT=r.data.total;UROWS=UROWS.concat(r.data.rows);UOFF=UROWS.length;
    if($("uList")){$("uList").innerHTML=ulist();$("uInfo").textContent=n(UROWS.length)+" dari "+n(UTOT);var m=$("uMore");if(m)m.hidden=UROWS.length>=UTOT}else render()})}

/* ---- Konten ---- */
function content(){var c=D.content||{},st=c.events_by_status||{};
  var sts=["published","pending","draft","rejected"].map(function(k){return{k:k,n:st[k]||0}});
  return'<div class="kps">'+kpi("Event tayang & akan datang",c.upcoming)+kpi("Menunggu persetujuan",c.pending,c.pending?'<em class="tr down">perlu diperiksa</em>':'<em class="tr up">beres</em>')+
    kpi("Kiriman forum baru",c.posts,'<em class="tr">'+n(c.replies)+" balasan</em>","Dalam "+days+" hari")+kpi("Ajakan baru",c.invites,'<em class="tr">'+n(c.invites_open)+" masih terbuka</em>","Dalam "+days+" hari")+"</div>"+
    '<div class="g2s">'+card("Status semua postingan",hbars(sts,function(i){return STN[i.k]||i.k},"n"))+card("Event terbit menurut kategori",hbars(c.published_by_cat||[],function(i){return CATN[i.k]||i.k},"n"))+"</div>"+
    card("Kota dengan event akan datang terbanyak",hbars(c.by_city||[],function(i){return i.k},"n"),"Bantu memutuskan kota mana yang perlu diisi lebih banyak.")}

/* ---- Browser (browser.gowithdme.com): data dari supabase/schema_browser.sql (admin_browser_stats, admin_browser_recent) ---- */
function bytesF(b){b=+b||0;if(b<1024)return n(b)+" B";if(b<1048576)return n(Math.round(b/1024))+" KB";if(b<1073741824)return(Math.round(b/104857.6)/10).toString().replace(".",",")+" MB";return(Math.round(b/107374182.4)/10).toString().replace(".",",")+" GB"}
function dur(s){s=+s||0;if(s<60)return s+" dtk";var m=Math.floor(s/60);return m+" mnt"+(s%60?" "+(s%60)+" dtk":"")}
function hhmm(ts){try{return new Date(ts).toLocaleTimeString("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",second:"2-digit"}).replace(/\./g,":")}catch(e){return""}}
var KIND={open:"Buka halaman",nav:"Buka situs",search:"Cari",reload:"Muat ulang",load:"Selesai dimuat",notice:"Bermasalah",newtab:"Tab baru",closetab:"Tutup tab",mode:"Ganti mode",size:"Ganti layar",bookmark:"Bookmark",heartbeat:"Aktif",doc:"Proxy: halaman",asset:"Proxy: berkas",error:"Proxy: galat"};
function bfeed(){var q=BREC.map(function(r){var bad=r.kind==="notice"||r.kind==="error"||(r.status&&r.status>=400);
  return'<div class="us"><span class="ua">'+(r.src==="proxy"?"P":"B")+'</span><div class="ub"><b>'+esc(KIND[r.kind]||r.kind)+"</b>"+(bad?' <span class="badge adm">perlu dicek</span>':"")+
  '<div class="meta">'+[hhmm(r.at),r.host?r.host+(r.path||""):"",r.mode,r.status?"HTTP "+r.status:"",r.ms!=null?n(r.ms)+" ms":"",r.bytes?bytesF(r.bytes):"",r.width?r.width+" px":"",r.sid?"#"+r.sid:""].filter(Boolean).map(esc).join(" · ")+"</div></div></div>"}).join("");
  return q||'<p class="meta">'+(BREC_ERR?esc(BREC_ERR):"Belum ada peristiwa.")+"</p>"}
function browserView(){
  var miss=/admin_browser|schema cache|does not exist|Could not find/i.test(BFAIL);
  if(BFAIL)return'<div class="card"><h3>'+(miss?"Lalu lintas browser belum dipasang di Supabase":"Data browser gagal dimuat")+"</h3><p>"+
    (miss?"Buka Supabase &gt; SQL Editor, jalankan isi file <code>supabase/schema_browser.sql</code> (repo browser), lalu muat ulang halaman ini.":esc(BFAIL))+'</p><button class="btn" id="bRetry" type="button">Coba lagi</button></div>';
  if(!BD)return'<p class="meta">Memuat…</p>';
  var b=BD,p=b.proxy||{};["daily","hosts","modes","devices","sizes","refs","problem_hosts","hours"].forEach(function(k){b[k]=b[k]||[]});["status","err_hosts","slow_hosts","top_hosts"].forEach(function(k){p[k]=p[k]||[]});
  var empty=!b.first_hit?'<div class="msg">Belum ada data. Pastikan <code>js/track.js</code> terpasang di browser.gowithdme.com dan <code>SUPABASE_URL</code> terisi di <code>js/config.js</code>. Data muncul beberapa detik setelah halaman dibuka.</div>':"";
  var errRate=p.requests?Math.round(p.errors/p.requests*100):0,dtot=b.devices.reduce(function(s,x){return s+x.n},0),mtot=b.modes.reduce(function(s,x){return s+x.n},0);
  var SZ=function(i){return+i.k?i.k+" px":"Penuh"};
  return empty+'<div class="kps">'+kpi("Aktif sekarang",b.live_now,'<em class="tr">dalam 2 menit terakhir</em>',"Kunjungan yang masih terbuka")+
    kpi("Kunjungan",b.sessions,trend(b.sessions,b.prev_sessions),"Satu kunjungan = satu sesi di browser")+kpi("Pengunjung unik",b.visitors,trend(b.visitors,b.prev_visitors),n(b.new_visitors)+" baru")+
    kpi("Situs dibuka",b.navs,trend(b.navs,b.prev_navs),n(b.searches)+" pencarian · hari ini "+n(b.today_navs))+"</div>"+
    '<div class="kps">'+kpi("Rata-rata durasi",b.avg_sec,'<em class="tr">'+dur(b.avg_sec)+" per kunjungan</em>")+kpi("Rata-rata waktu muat",b.avg_load_ms,'<em class="tr">milidetik (halaman via proxy)</em>')+
    kpi("Situs bermasalah",b.problems,b.problems?'<em class="tr down">lambat atau menolak iframe</em>':'<em class="tr up">beres</em>')+kpi("Permintaan proxy",p.requests,'<em class="tr">'+bytesF(p.bytes)+" data</em>")+"</div>"+
    card("Situs dibuka per hari",daily(b.daily,"navs","sessions","situs dibuka","kunjungan"),"Batang gelap = kunjungan, terang = situs dibuka. Tanggal WIB.")+
    '<div class="g2s">'+card("Situs paling sering dibuka",hbars(b.hosts,function(i){return i.k+" · "+i.u+" kunjungan"},"n"),"Hanya nama situs; kata pencarian tidak dicatat.")+
    card("Jam ramai",hours(b.hours,"situs dibuka",""),"Situs dibuka per jam (WIB).")+"</div>"+
    '<div class="g2s">'+card("Mode & layar",hbars(b.modes.map(function(i){return{k:i.k==="proxy"?"Proxy":"Langsung",n:i.n}}),function(i){return i.k},"n",mtot)+hbars(b.sizes,SZ,"n"),"Mode dipakai saat membuka situs; layar = pilihan ukuran.")+
    card("Perangkat & asal",hbars(b.devices,function(i){return DEV[i.k]||i.k},"n",dtot)+hbars(b.refs,function(i){return"dari "+i.k},"n"))+"</div>"+
    card("Situs yang bermasalah",hbars(b.problem_hosts,function(i){return i.k+(i.why?" ("+(i.why==="blocked_frame"?"menolak iframe":"proxy lambat")+")":"")},"n"),"Situs yang layarnya kosong atau lama dimuat menurut pengunjung. Kandidat untuk dicek.")+
    '<div class="g2s">'+card("Proxy: status respons",hbars(p.status,function(i){return i.k},"n",p.requests),"Galat "+errRate+"% · rata-rata "+n(p.avg_ms)+" ms · p95 "+n(p.p95_ms)+" ms. Berkas pendukung disampel.")+
    card("Proxy: situs galat",hbars(p.err_hosts,function(i){return i.k+" (HTTP "+(i.st||"gagal")+")"},"n"),"Termasuk alamat internal yang diblokir.")+"</div>"+
    '<div class="g2s">'+card("Proxy: paling banyak diakses",hbars(p.top_hosts,function(i){return i.k+" · "+bytesF(i.b)},"n"))+
    card("Proxy: paling lambat",hbars(p.slow_hosts,function(i){return i.k+" ("+i.n+"x)"},"ms"),"Rata-rata milidetik per halaman.")+"</div>"+
    '<div class="card sc"><h3>Aliran langsung</h3><p class="meta">Peristiwa terbaru (B = halaman browser, P = proxy). Menyegar sendiri tiap 15 detik.</p>'+
    '<div class="bar"><input id="bHost" type="search" placeholder="Filter situs, mis. example.com" value="'+esc(BHOST)+'"><select id="bSrc"><option value="">Semua</option><option value="client"'+(BSRC==="client"?" selected":"")+'>Halaman browser</option><option value="proxy"'+(BSRC==="proxy"?" selected":"")+'>Proxy</option></select><button class="btn sm" id="bGo" type="button">Terapkan</button></div>'+
    '<div id="bFeed">'+bfeed()+'</div><div class="row"><button class="btn ghost sm" id="bMore" type="button">Tampilkan lebih banyak</button></div></div>'+
    '<div class="card sc"><h3>Penyimpanan</h3><p class="meta">Data tercatat sejak '+(b.first_hit?esc(new Date(b.first_hit).toLocaleDateString("id-ID",{timeZone:"Asia/Jakarta"})):"-")+'. Tidak ada IP, cookie, atau kata pencarian yang disimpan. Hanya pemilik yang dapat menghapus data lama.</p>'+
    '<div class="row"><button class="btn ghost sm" id="bPurge" type="button">Hapus data lebih dari 90 hari</button></div></div>'}
function loadBrowserFeed(more){var before=more&&BREC.length?BREC[BREC.length-1].id:null;
  return sb.rpc("admin_browser_recent",{p_limit:40,p_before:before,p_host:BHOST||null,p_src:BSRC||null}).then(function(r){
    if(r.error){BREC_ERR=friendlyErr(r.error);if(!more)BREC=[];return}BREC_ERR="";var rows=(r.data&&r.data.rows)||[];BREC=more?BREC.concat(rows):rows;
    var f=$("bFeed");if(f)f.innerHTML=bfeed();var m=$("bMore");if(m)m.hidden=rows.length<40})}
function loadBrowser(silent){if(BLOAD)return;BLOAD=true;BFAIL="";if(!silent&&!BD)render();
  return sb.rpc("admin_browser_stats",{p_days:days}).then(function(r){
    if(r.error){BLOAD=false;BFAIL=r.error.message||"Gagal";return render()}
    BD=r.data;return loadBrowserFeed().then(function(){BLOAD=false;if(tab==="browser")render()})})}
/* Segarkan otomatis tiap 15 detik saat tab Browser terbuka dan halaman terlihat (tidak mengganggu saat mengetik filter) */
setInterval(function(){var v=$("v_stats"),a=document.activeElement;
  if(tab!=="browser"||!BD||BLOAD||document.hidden||!v||v.hidden||($("panel")&&$("panel").hidden)||(a&&(a.id==="bHost"||a.id==="bSrc")))return;
  BLOAD=true;BREC_ERR="";
  sb.rpc("admin_browser_stats",{p_days:days}).then(function(r){if(!r.error&&r.data)BD=r.data;return loadBrowserFeed()}).then(function(){BLOAD=false;if(tab==="browser")render()},function(){BLOAD=false})},15000);

function render(){var b=$("stBody");if(tab==="browser"){b.innerHTML=browserView();[].forEach.call(document.querySelectorAll("#stTabs .tab"),function(x){x.classList.toggle("on",x.dataset.t===tab)});[].forEach.call(document.querySelectorAll("#stRange .tab"),function(x){x.classList.toggle("on",+x.dataset.d===days)});if(!BD&&!BLOAD&&!BFAIL)loadBrowser();return}if(!D){b.innerHTML='<p class="meta">Memuat…</p>';return}
  b.innerHTML=tab==="visit"?visit():tab==="users"?users():content();
  [].forEach.call(document.querySelectorAll("#stTabs .tab"),function(x){x.classList.toggle("on",x.dataset.t===tab)});
  [].forEach.call(document.querySelectorAll("#stRange .tab"),function(x){x.classList.toggle("on",+x.dataset.d===days)})}
function load(){if(loading)return;loading=true;$("stBody").innerHTML='<p class="meta">Memuat…</p>';
  return sb.rpc("admin_stats",{p_days:days}).then(function(r){loading=false;if(r.error)return fail(r.error);D=r.data;kpiDash();
    if(tab==="users"&&!UROWS.length)return loadUsers().then(render);render()})}

/* ---- Beranda: ringkasan + penanda perlu tindakan ---- */
function kpiDash(){var el=$("kpiDash");if(!el||!D)return;var t=D.traffic||{},u=(D.users&&typeof D.users==="object")?D.users:{total:+D.users||0,new:0};
  el.innerHTML=kpi("Tayangan "+(D.days||days)+" hari",t.views,trend(t.views,t.prev_views))+kpi("Pengunjung unik",t.visitors,trend(t.visitors,t.prev_visitors))+kpi("Pengguna terdaftar",u.total,'<em class="tr">+'+n(u.new)+" baru</em>")}
function sync(){var p=+($("nPend2")||{}).textContent||0,f=+($("nFrep")||{}).textContent||0,t=p+f,d=$("bTinjau");
  if(d){d.hidden=!t;d.textContent=t}
  [].forEach.call(document.querySelectorAll("#tgRev,.tgR"),function(x){x.textContent=p});[].forEach.call(document.querySelectorAll("#tgFor,.tgF"),function(x){x.textContent=f});
  /* "Semua beres" baru tampil setelah data sempat dimuat, supaya tidak berkedip */
  if($("allClear"))$("allClear").hidden=!(settled&&!t)}
["nPend2","nFrep"].forEach(function(id){var el=$(id);if(el&&window.MutationObserver)new MutationObserver(sync).observe(el,{childList:true,characterData:true,subtree:true})});
sync();

document.addEventListener("click",function(ev){var b=ev.target.closest("button");if(!b)return;
  if(b.dataset.v==="stats"&&!D&&!loading)load();
  if(b.closest("#stRange")&&b.dataset.d){days=+b.dataset.d;D=null;BD=null;if(tab==="browser"){BFAIL=""}load()}
  if(b.closest("#stTabs")&&b.dataset.t){tab=b.dataset.t;if(tab==="browser"){BFAIL="";return render()}if(tab==="users"&&!UROWS.length&&D)loadUsers().then(render);else render()}
  if(b.id==="stRetry")load();
  if(b.id==="bRetry"){BFAIL="";BD=null;render()}
  if(b.id==="bGo"){BHOST=($("bHost").value||"").trim().toLowerCase();BSRC=$("bSrc").value;loadBrowserFeed()}
  if(b.id==="bMore")loadBrowserFeed(true);
  if(b.id==="bPurge"){if(!confirm("Hapus semua data lalu lintas browser yang lebih tua dari 90 hari? Tindakan ini tidak bisa dibatalkan."))return;
    sb.rpc("admin_browser_purge",{p_days:90}).then(function(r){if(r.error)return msg(friendlyErr(r.error),"err");msg(n(r.data)+" baris dihapus.","ok");BD=null;render()})}
  if(b.id==="uGo"){UQ=($("uQ").value||"").trim();loadUsers()}
  if(b.id==="uMore")loadUsers(true);
  if(b.id==="stNoTrack"){var off=false;try{off=localStorage.getItem("gwm_notrack")==="1";if(off)localStorage.removeItem("gwm_notrack");else localStorage.setItem("gwm_notrack","1")}catch(e){return msg("Browser menolak menyimpan pengaturan ini.","err")}
    render();msg(off?"Kunjungan perangkat ini dihitung lagi.":"Kunjungan perangkat ini tidak akan dihitung.","ok")}});
document.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target.id==="uQ"){e.preventDefault();UQ=e.target.value.trim();loadUsers()}
  if(e.key==="Enter"&&e.target.id==="bHost"){e.preventDefault();var g=$("bGo");if(g)g.click()}});

/* ringkasan Beranda dimuat sekali setelah admin terverifikasi (panel tampil) */
var tries=0,iv=setInterval(function(){tries++;if(!$("panel").hidden){clearInterval(iv);setTimeout(function(){settled=true;sync()},2200);days=7;var pr=load();var back=function(){days=30;D=null};if(pr&&pr.then)pr.then(back);else back()}else if(tries>40)clearInterval(iv)},250);
})();
