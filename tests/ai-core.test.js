/* Jalankan: node tests/ai-core.test.js. Logika murni menu AI (js/ai-core.js). Tanpa dependensi. */
const assert=require("assert");
const C=require("../js/ai-core.js");
let n=0;const t=(name,fn)=>{try{fn();n++;console.log("ok  "+name)}catch(e){console.error("GAGAL "+name+"\n  "+e.message);process.exitCode=1}};

t("pct: pembulatan, pembagi nol aman",()=>{assert.strictEqual(C.pct(1,3),33);assert.strictEqual(C.pct(2,3),67);assert.strictEqual(C.pct(5,0),0);assert.strictEqual(C.pct(undefined,undefined),0)});
t("ms: md / dtk / kosong",()=>{assert.strictEqual(C.ms(850),"850 md");assert.strictEqual(C.ms(1250),"1,3 dtk");assert.strictEqual(C.ms(null),"—");assert.strictEqual(C.ms("x"),"—")});
t("tok: rb / jt",()=>{assert.strictEqual(C.tok(950),"950");assert.strictEqual(C.tok(12500),"12,5 rb");assert.strictEqual(C.tok(1250000),"1,3 jt");assert.strictEqual(C.tok(null),"0")});
t("cost: dari harga per 1 juta token; harga negatif/kosong = 0",()=>{
  assert.strictEqual(C.cost(2e6,1e6,1000,4000),6000);
  assert.strictEqual(C.cost(2e6,1e6,0,0),0);
  assert.strictEqual(C.cost(2e6,1e6,-5,undefined),0)});
t("rp: format rupiah",()=>assert.strictEqual(C.rp(1500.4),"Rp"+(1500).toLocaleString("id-ID")));
t("peakHours: tiga teratas, hanya yang > 0, jam 23 menyambung ke 00",()=>{
  const hrs=Array.from({length:24},(_,h)=>({h,n:0}));hrs[19].n=50;hrs[20].n=40;hrs[23].n=40;hrs[8].n=5;hrs[3].n=1;
  const p=C.peakHours(hrs);
  assert.deepStrictEqual(p.map(x=>x.h),[19,20,23]);
  assert.strictEqual(p[0].text,"19.00–20.00");
  assert.strictEqual(p[2].text,"23.00–00.00");
  assert.deepStrictEqual(C.peakHours(hrs.map(x=>({h:x.h,n:0}))),[]);
  assert.deepStrictEqual(C.peakHours(null),[])});
t("weekly: dikelompokkan Senin–Minggu, jumlah benar",()=>{
  // 2026-11-23 Senin .. 2026-11-29 Minggu; 2026-11-30 Senin
  const rows=[{d:"2026-11-22",req:1,chats:1},{d:"2026-11-23",req:10,chats:2},{d:"2026-11-29",req:5,chats:1},{d:"2026-11-30",req:7,chats:3}];
  const w=C.weekly(rows);
  assert.deepStrictEqual(w.map(x=>x.week),["2026-11-16","2026-11-23","2026-11-30"]);
  assert.deepStrictEqual(w.map(x=>x.req),[1,15,7]);
  assert.deepStrictEqual(w.map(x=>x.chats),[1,3,3]);
  assert.deepStrictEqual(C.weekly(undefined),[])});
t("shares: persen dan label; kunci tak dikenal tetap tampil",()=>{
  const s=C.shares([{k:"curhat",n:3},{k:"aneh",n:1}],C.TOPIC);
  assert.deepStrictEqual(s.map(x=>[x.label,x.pct]),[["Curhat",75],["aneh",25]]);
  assert.deepStrictEqual(C.shares(null,C.TOPIC),[])});
t("ratingSummary: persen 👍 dan alasan teratas (abaikan 'tanpa')",()=>{
  const r=C.ratingSummary({up:6,down:2,pending:3,approved:1,reasons:[{k:"ngarang",n:2},{k:"tanpa",n:1}]});
  assert.strictEqual(r.upPct,75);assert.strictEqual(r.topReason.k,"ngarang");assert.strictEqual(r.pending,3);
  const r2=C.ratingSummary({up:0,down:1,reasons:[{k:"tanpa",n:1}]});
  assert.strictEqual(r2.topReason,null);assert.strictEqual(r2.upPct,0);
  assert.strictEqual(C.ratingSummary(null).total,0)});
t("errPct",()=>{assert.strictEqual(C.errPct({requests:20,failed:3}),15);assert.strictEqual(C.errPct({}),0)});
t("healthRows: urut, label Indonesia, hitung yang bermasalah",()=>{
  const h=C.healthRows({ok:false,models:{"groq:b":"gone","gemini:a":"ok","groq:c":"auth"}});
  assert.deepStrictEqual(h.rows.map(r=>r.name),["gemini:a","groq:b","groq:c"]);
  assert.strictEqual(h.rows[1].label,"Dimatikan penyedia");assert.strictEqual(h.bad,2);assert.strictEqual(h.ok,false);
  assert.deepStrictEqual(C.healthRows(null),{rows:[],ok:false,bad:0})});
t("isMissing / isDenied membedakan SQL belum dipasang vs bukan Pemilik",()=>{
  assert(C.isMissing("Could not find the function public.admin_ai_stats(p_days) in the schema cache"));
  assert(C.isMissing('relation "ai_usage" does not exist'));
  assert(!C.isMissing("hanya Pemilik"));
  assert(C.isDenied("hanya Pemilik"));assert(C.isDenied("permission denied for function"));
  assert(!C.isDenied("network error"))});
t("label topik: semua label yang dikeluarkan Worker punya nama Indonesia",()=>{
  ["krisis","curhat","sapaan","cari_teman","cafe_makan","gunung","konser","trip","pencarian","lainnya"].forEach(k=>assert(C.TOPIC[k],k));
  ["mobile","tablet","desktop","?"].forEach(k=>assert(C.DEVICE[k],k));
  ["busy","kuota","down","auth"].forEach(k=>assert(C.ERR[k],k));
  ["ngarang","salah","kurang","tanpa"].forEach(k=>assert(C.REASON[k],k))});

t("percakapan: nama, inisial, kunci, lokasi, dan tamu",()=>{
  assert.strictEqual(C.personName({name:" Budi "}),"Budi");assert.strictEqual(C.personName({user_id:"u"}),"(tanpa nama)");assert.strictEqual(C.personName({device:"d"}),"Tamu (belum login)");
  assert.strictEqual(C.personInitial({name:"budi"}),"B");assert.strictEqual(C.personKey({user_id:"u1",device:"d"}),"u1");assert.strictEqual(C.personKey({device:"d"}),"d:d");assert.strictEqual(C.personKey({}),"");
  assert.strictEqual(C.placeLabel({city:"Bandung",region:"Jawa Barat"}),"Bandung, Jawa Barat");assert.strictEqual(C.placeLabel({}),"Lokasi tidak diketahui");
  assert.ok(C.isMissingChat("Could not find the function public.admin_ai_people"));assert.ok(!C.isMissingChat("Hanya pemilik."))});
t("SQL percakapan: tiap fungsi admin khusus pemilik, tercatat di audit, tabel tertutup untuk browser",()=>{
  const fs=require("fs"),sql=fs.readFileSync(__dirname+"/../supabase/admin_ai_chat.sql","utf8");
  ["admin_ai_people","admin_ai_person","admin_ai_person_delete"].forEach(f=>{
    const b=sql.match(new RegExp("function "+f+"\\([\\s\\S]*?end \\$\\$;"))[0];
    assert(b.includes("is_owner()"),f+" tanpa is_owner()");assert(b.includes("_rbac_log("),f+" tanpa audit")});
  assert(/alter table ai_chat_messages enable row level security/.test(sql));
  assert(/revoke all on ai_chat_sessions, ai_chat_messages from anon, authenticated/.test(sql));
  assert(!/create policy/i.test(sql),"jangan beri policy ke tabel chat")});
t("riwayat per obrolan: judul, label, 'x jam lalu'",()=>{
  assert.strictEqual(C.sessionTitle({title:"  dea,  apa kabs "}),"dea, apa kabs");assert.strictEqual(C.sessionTitle({title:null}),"Obrolan tanpa judul");assert.strictEqual(C.sessionTitle(null),"Obrolan tanpa judul");
  assert.strictEqual(C.sessionMeta({persona:"manja",mode:"ngobrol",messages:12}),"Manja · Ngobrol · 12 pesan");
  assert.strictEqual(C.sessionMeta({mode:null,messages:2}),"2 pesan");assert.strictEqual(C.sessionMeta({persona:"aneh",mode:"gunung",messages:0}),"Gunung · 0 pesan");
  const now=Date.parse("2026-11-27T12:00:00Z");
  assert.strictEqual(C.ago("2026-11-27T11:59:30Z",now),"baru saja");assert.strictEqual(C.ago("2026-11-27T11:30:00Z",now),"30 mnt lalu");
  assert.strictEqual(C.ago("2026-11-27T09:00:00Z",now),"3 jam lalu");assert.strictEqual(C.ago("2026-11-24T12:00:00Z",now),"3 hari lalu");
  assert.strictEqual(C.ago("2026-08-27T12:00:00Z",now),"3 bln lalu");assert.strictEqual(C.ago("bukan tanggal",now),"—");
  assert.ok(C.isMissingChat("Could not find the function public.admin_ai_sessions(p_user) in the schema cache"))});

console.log("\n"+n+" uji lulus"+(process.exitCode?" (ADA YANG GAGAL)":""));
