-- Percakapan Dea per orang untuk panel admin (khusus Pemilik).
-- Jalankan di Supabase > SQL Editor SETELAH schema_rbac.sql dan admin_ai.sql. Aman dijalankan ulang.
-- Worker (service key) yang MENULIS; panel admin hanya MEMBACA lewat fungsi di bawah (is_owner()).
-- Yang disimpan: isi pesan, kota/provinsi kasar (dari Cloudflare, BUKAN GPS dan BUKAN alamat IP), akun (bila login) atau ID perangkat pseudonim (tamu).

create table if not exists ai_chat_sessions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,   -- null = tamu
  device text,                                                -- pseudonim perangkat (tamu / cadangan)
  city text, region text, country text,
  mode text,
  persona text,                                               -- ceria / galak / manja (suasana Dea saat itu)
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  check (user_id is not null or device is not null));
alter table ai_chat_sessions add column if not exists persona text;   -- untuk tabel yang sudah ada sebelum kolom ini
create index if not exists ai_chat_sessions_user on ai_chat_sessions(user_id, last_at desc);
create index if not exists ai_chat_sessions_dev  on ai_chat_sessions(device, last_at desc);
create index if not exists ai_chat_sessions_last on ai_chat_sessions(last_at);

create table if not exists ai_chat_messages(
  id bigserial primary key,
  session_id uuid not null references ai_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (length(content) <= 8000),
  created_at timestamptz not null default now());
create index if not exists ai_chat_messages_sess on ai_chat_messages(session_id, id);
create index if not exists ai_chat_messages_at   on ai_chat_messages(created_at);

-- Tidak ada policy = tidak ada akses dari browser. Worker memakai service key (melewati RLS).
alter table ai_chat_sessions enable row level security;
alter table ai_chat_messages enable row level security;
revoke all on ai_chat_sessions, ai_chat_messages from anon, authenticated;

-- Daftar orang (akun login digabung per akun; tamu per perangkat).
create or replace function admin_ai_people(p_q text default null, p_limit int default 20, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q text:=nullif(btrim(coalesce(p_q,'')),''); res jsonb; tot int;
begin
  if not is_owner() then raise exception 'Hanya pemilik.' using errcode='42501'; end if;
  with g as (
    select s.user_id, case when s.user_id is null then s.device end as device,
           count(distinct s.id)::int as sessions,
           count(m.id)::int as messages,
           max(s.last_at) as last_at,
           (array_agg(s.city   order by s.last_at desc))[1] as city,
           (array_agg(s.region order by s.last_at desc))[1] as region
    from ai_chat_sessions s left join ai_chat_messages m on m.session_id=s.id group by 1,2),
  j as (
    select g.*, pr.nickname as name, pr.avatar_url
    from g left join profiles pr on pr.id = g.user_id
    where q is null or coalesce(pr.nickname,'') ilike '%'||q||'%' or coalesce(g.city,'') ilike '%'||q||'%' or coalesce(g.region,'') ilike '%'||q||'%')
  select count(*) into tot from j;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_at desc),'[]'::jsonb) into res
    from (select * from j order by last_at desc limit least(greatest(p_limit,1),50) offset greatest(p_offset,0)) x;
  perform _rbac_log('ai.people.list',null,jsonb_build_object('q',q));
  return jsonb_build_object('total',tot,'rows',res);
end $$;

-- Daftar obrolan satu orang (seperti bilah samping di ai.gowithdme.com): judul = pesan pertama, mode, suasana, jumlah pesan.
-- p_before = last_at obrolan terlama yang sudah tampil (untuk "muat lagi"). p_mode = filter Ngobrol/Gunung/Konser/Trip.
create or replace function admin_ai_sessions(p_user uuid default null, p_device text default null, p_mode text default null, p_limit int default 30, p_before timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare lim int:=least(greatest(p_limit,1),100); res jsonb; more boolean;
begin
  if not is_owner() then raise exception 'Hanya pemilik.' using errcode='42501'; end if;
  if p_user is null and nullif(p_device,'') is null then raise exception 'Pilih akun atau perangkat.'; end if;
  with sel as (
    select s.id, s.mode, s.persona, s.city, s.started_at, s.last_at,
           (select count(*) from ai_chat_messages m where m.session_id=s.id)::int as messages,
           (select left(m.content,80) from ai_chat_messages m where m.session_id=s.id and m.role='user' order by m.id limit 1) as title
    from ai_chat_sessions s
    where ((p_user is not null and s.user_id=p_user) or (p_user is null and s.user_id is null and s.device=p_device))
      and (nullif(p_mode,'') is null or s.mode=p_mode)
      and (p_before is null or s.last_at < p_before)
    order by s.last_at desc limit lim+1),
  t as (select sel.*, row_number() over (order by sel.last_at desc) rn from sel)
  select (count(*) > lim),
         coalesce(jsonb_agg(to_jsonb(t) - 'rn' order by t.last_at desc) filter (where t.rn <= lim),'[]'::jsonb)
    into more, res from t;
  perform _rbac_log('ai.sessions.list',p_user,jsonb_build_object('device',case when p_user is null then p_device end,'mode',nullif(p_mode,'')));
  return jsonb_build_object('sessions',res,'more',coalesce(more,false));
end $$;

-- Isi satu obrolan (p_session) atau seluruh riwayat satu orang (p_session kosong).
-- p_before = id pesan terlama yang sudah tampil (untuk "muat lebih lama").
-- Versi lama tanpa p_session dihapus dulu supaya tidak ada dua fungsi bernama sama.
drop function if exists admin_ai_person(uuid,text,int,bigint);
create or replace function admin_ai_person(p_user uuid default null, p_device text default null, p_limit int default 60, p_before bigint default null, p_session uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare lim int:=least(greatest(p_limit,1),200); msgs jsonb; more boolean;
begin
  if not is_owner() then raise exception 'Hanya pemilik.' using errcode='42501'; end if;
  if p_user is null and nullif(p_device,'') is null then raise exception 'Pilih akun atau perangkat.'; end if;
  with sel as (
    select m.id, m.session_id, m.role, m.content, m.created_at, s.mode, s.city, s.persona
    from ai_chat_messages m join ai_chat_sessions s on s.id=m.session_id
    where ((p_user is not null and s.user_id=p_user) or (p_user is null and s.user_id is null and s.device=p_device))
      and (p_session is null or m.session_id=p_session)
      and (p_before is null or m.id < p_before)
    order by m.id desc limit lim+1)
  select (count(*) > lim),
         coalesce(jsonb_agg(to_jsonb(t) - 'rn' order by t.id) filter (where t.rn <= lim),'[]'::jsonb)
    into more, msgs
    from (select sel.*, row_number() over (order by id desc) rn from sel) t;
  perform _rbac_log('ai.chat.view',p_user,jsonb_build_object('device',case when p_user is null then p_device end,'session',p_session,'older',p_before is not null));
  return jsonb_build_object('messages',msgs,'more',coalesce(more,false));
end $$;

-- Hapus seluruh riwayat satu orang (permintaan hak hapus data pribadi).
create or replace function admin_ai_person_delete(p_user uuid default null, p_device text default null)
returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if not is_owner() then raise exception 'Hanya pemilik.' using errcode='42501'; end if;
  if p_user is null and nullif(p_device,'') is null then raise exception 'Pilih akun atau perangkat.'; end if;
  delete from ai_chat_sessions s where (p_user is not null and s.user_id=p_user) or (p_user is null and s.user_id is null and s.device=p_device);
  get diagnostics n = row_count;
  perform _rbac_log('ai.chat.delete',p_user,jsonb_build_object('device',case when p_user is null then p_device end,'sessions',n));
  return n;
end $$;

-- Masa simpan: hapus pesan/sesi lebih tua dari p_days (default 90). Dipanggil otomatis oleh pg_cron (di bawah) atau manual.
create or replace function ai_chat_purge(p_days int default 90) returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
  delete from ai_chat_sessions where last_at < now() - make_interval(days => greatest(p_days,7));
  get diagnostics n = row_count; return n;
end $$;
revoke all on function ai_chat_purge(int) from public, anon, authenticated;

revoke all on function admin_ai_people(text,int,int), admin_ai_sessions(uuid,text,text,int,timestamptz), admin_ai_person(uuid,text,int,bigint,uuid), admin_ai_person_delete(uuid,text) from public, anon;
grant execute on function admin_ai_people(text,int,int), admin_ai_sessions(uuid,text,text,int,timestamptz), admin_ai_person(uuid,text,int,bigint,uuid), admin_ai_person_delete(uuid,text) to authenticated;

-- Hapus otomatis tiap hari 03.00 WIB (20.00 UTC). Aktifkan pg_cron dulu: Database > Extensions > pg_cron.
-- select cron.schedule('ai-chat-purge','0 20 * * *','select ai_chat_purge(90)');
