-- Panel admin Dea. Aman diulang.
-- Tabel disimpan di skema `dea`, BUKAN public.users / public.chats,
-- karena public.chats bisa milik fitur pesan situs utama.
-- Browser tidak menulis tabel langsung. Yang dipakai fungsi di public (RPC).
-- Admin = app_metadata.role = 'admin' di Authentication > Users. Bukan user_metadata (itu bisa diubah sendiri).

create schema if not exists dea;

create table if not exists dea.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nama text,
  created_at timestamptz not null default now(),
  last_active timestamptz,
  total_chat integer not null default 0,
  is_blocked boolean not null default false
);

create table if not exists dea.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references dea.users (id) on delete cascade,
  message text not null,
  reply text not null,
  created_at timestamptz not null default now()
);

create index if not exists dea_chats_user_created_idx on dea.chats (user_id, created_at desc);
create index if not exists dea_users_created_idx on dea.users (created_at desc);

alter table dea.users enable row level security;
alter table dea.chats enable row level security;
revoke all on dea.users, dea.chats from anon, authenticated;

create or replace function public.dea_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.dea_touch_user()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  em text;
  nm text;
  blocked boolean;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'login');
  end if;
  select u.email,
         nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'nickname', u.raw_user_meta_data ->> 'name', '')), '')
    into em, nm
  from auth.users u
  where u.id = uid;

  insert into dea.users as t (id, email, nama, last_active)
  values (uid, em, nm, now())
  on conflict (id) do update set
    email = excluded.email,
    nama = coalesce(excluded.nama, t.nama),
    last_active = now();

  select is_blocked into blocked from dea.users where id = uid;
  return jsonb_build_object('ok', true, 'blocked', coalesce(blocked, false));
end;
$$;

create or replace function public.dea_am_i_blocked()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare blocked boolean;
begin
  if auth.uid() is null then
    return false;
  end if;
  perform public.dea_touch_user();
  select is_blocked into blocked from dea.users where id = auth.uid();
  return coalesce(blocked, false);
end;
$$;

create or replace function public.dea_log_chat(p_message text, p_reply text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare blocked boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'login');
  end if;
  perform public.dea_touch_user();
  select is_blocked into blocked from dea.users where id = auth.uid();
  if coalesce(blocked, false) then
    return jsonb_build_object('ok', false, 'blocked', true);
  end if;
  if nullif(btrim(coalesce(p_message, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'empty');
  end if;
  insert into dea.chats (user_id, message, reply)
  values (
    auth.uid(),
    left(btrim(p_message), 4000),
    left(coalesce(p_reply, ''), 4000)
  );
  update dea.users
     set total_chat = total_chat + 1,
         last_active = now()
   where id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.dea_admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare day_start timestamptz;
begin
  if not public.dea_is_admin() then
    raise exception 'Hanya admin.' using errcode = '42501';
  end if;
  day_start := (date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta');
  return jsonb_build_object(
    'total_user', (select count(*) from dea.users),
    'user_baru_hari_ini', (select count(*) from dea.users where created_at >= day_start),
    'total_chat', (select coalesce(sum(total_chat), 0) from dea.users)
  );
end;
$$;

create or replace function public.dea_admin_users(p_q text default null, p_filter text default 'all')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare q text := nullif(btrim(coalesce(p_q, '')), '');
declare res jsonb;
begin
  if not public.dea_is_admin() then
    raise exception 'Hanya admin.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_active desc nulls last), '[]'::jsonb)
    into res
  from (
    select id, email, nama, created_at, last_active, total_chat, is_blocked
    from dea.users
    where (
        p_filter = 'blocked' and is_blocked
        or p_filter = 'active' and not is_blocked
        or coalesce(p_filter, 'all') not in ('blocked', 'active')
      )
      and (
        q is null
        or coalesce(email, '') ilike '%' || q || '%'
        or coalesce(nama, '') ilike '%' || q || '%'
      )
    order by last_active desc nulls last
    limit 100
  ) x;
  return res;
end;
$$;

create or replace function public.dea_admin_chats(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare res jsonb;
begin
  if not public.dea_is_admin() then
    raise exception 'Hanya admin.' using errcode = '42501';
  end if;
  if p_user is null then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into res
  from (
    select id, message, reply, created_at
    from dea.chats
    where user_id = p_user
    order by created_at desc
    limit 200
  ) x;
  return res;
end;
$$;

create or replace function public.dea_admin_block(p_user uuid, p_blocked boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.dea_is_admin() then
    raise exception 'Hanya admin.' using errcode = '42501';
  end if;
  if p_user is null then
    raise exception 'User kosong.';
  end if;
  update dea.users set is_blocked = coalesce(p_blocked, false) where id = p_user;
  if not found then
    raise exception 'User tidak ada.';
  end if;
  return jsonb_build_object('ok', true, 'is_blocked', coalesce(p_blocked, false));
end;
$$;

create or replace function public.dea_admin_delete(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.dea_is_admin() then
    raise exception 'Hanya admin.' using errcode = '42501';
  end if;
  if p_user is null then
    raise exception 'User kosong.';
  end if;
  if p_user = auth.uid() then
    raise exception 'Tidak bisa menghapus akun yang sedang dipakai.';
  end if;
  delete from dea.users where id = p_user;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.dea_is_admin() from public, anon;
revoke all on function public.dea_touch_user() from public, anon;
revoke all on function public.dea_am_i_blocked() from public, anon;
revoke all on function public.dea_log_chat(text, text) from public, anon;
revoke all on function public.dea_admin_stats() from public, anon;
revoke all on function public.dea_admin_users(text, text) from public, anon;
revoke all on function public.dea_admin_chats(uuid) from public, anon;
revoke all on function public.dea_admin_block(uuid, boolean) from public, anon;
revoke all on function public.dea_admin_delete(uuid) from public, anon;

grant execute on function public.dea_is_admin() to authenticated;
grant execute on function public.dea_touch_user() to authenticated;
grant execute on function public.dea_am_i_blocked() to authenticated;
grant execute on function public.dea_log_chat(text, text) to authenticated;
grant execute on function public.dea_admin_stats() to authenticated;
grant execute on function public.dea_admin_users(text, text) to authenticated;
grant execute on function public.dea_admin_chats(uuid) to authenticated;
grant execute on function public.dea_admin_block(uuid, boolean) to authenticated;
grant execute on function public.dea_admin_delete(uuid) to authenticated;
