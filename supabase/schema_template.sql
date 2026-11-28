-- v2 (Opsi A, daftar template statis). Jalankan sekali di Supabase SQL Editor (proyek yang sama dengan gowithdme.com).
-- Butuh fungsi is_admin() dari schema_rbac.sql (sudah ada di proyek utama).
-- Aman dijalankan ulang, dan aman walaupun v1 pernah dijalankan (tabel tpl_templates/tpl_versions lama tidak dipakai lagi).

drop view if exists tpl_update_targets;
drop function if exists tpl_download(uuid);

create table if not exists tpl_downloads(
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  slug text, version text, downloaded_at timestamptz not null default now());
alter table tpl_downloads add column if not exists slug text;
alter table tpl_downloads add column if not exists version text;
create index if not exists tpl_dl_slug on tpl_downloads(slug, user_id, downloaded_at desc);
alter table tpl_downloads enable row level security;
drop policy if exists tpl_d_read on tpl_downloads;
create policy tpl_d_read on tpl_downloads for select to authenticated using (user_id=auth.uid() or is_admin());

-- Download WAJIB login. Menolak anon, memastikan file ada, mencatat siapa/template/versi/kapan, mengembalikan path file.
create or replace function tpl_download(p_slug text, p_version text) returns text
language plpgsql security definer set search_path=public as $$
declare pth text;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if p_slug !~ '^[a-z0-9-]+$' or p_version !~ '^[0-9A-Za-z.-]+$' then raise exception 'bad_request'; end if;
  pth := p_slug||'/v'||p_version||'.xml';
  if not exists(select 1 from storage.objects where bucket_id='templates' and name=pth) then raise exception 'file_not_found'; end if;
  insert into tpl_downloads(user_id,slug,version) values(auth.uid(),p_slug,p_version);
  return pth;
end $$;
revoke all on function tpl_download(text,text) from public, anon;
grant execute on function tpl_download(text,text) to authenticated;

-- Bucket privat: hanya user login yang boleh membuat signed URL; hanya admin yang boleh upload.
insert into storage.buckets(id,name,public) values('templates','templates',false) on conflict (id) do nothing;
drop policy if exists tpl_s_read on storage.objects; create policy tpl_s_read on storage.objects for select to authenticated using (bucket_id='templates');
drop policy if exists tpl_s_ins on storage.objects;  create policy tpl_s_ins on storage.objects for insert to authenticated with check (bucket_id='templates' and is_admin());
drop policy if exists tpl_s_upd on storage.objects;  create policy tpl_s_upd on storage.objects for update to authenticated using (bucket_id='templates' and is_admin());
drop policy if exists tpl_s_del on storage.objects;  create policy tpl_s_del on storage.objects for delete to authenticated using (bucket_id='templates' and is_admin());

-- Untuk notifikasi update: siapa yang belum memakai versi terbaru. Jalankan dari SQL Editor:
--   select * from tpl_update_targets('gwm-majalah','10.2');
create or replace function tpl_update_targets(p_slug text, p_latest text)
returns table(email text, last_version text, last_at timestamptz) language sql security definer set search_path=public as $$
  select u.email::text, (array_agg(d.version order by d.downloaded_at desc))[1], max(d.downloaded_at)
  from tpl_downloads d join auth.users u on u.id=d.user_id
  where d.slug=p_slug group by u.email
  having bool_and(d.version<>p_latest) $$;
revoke all on function tpl_update_targets(text,text) from public, anon, authenticated;

-- === v3: daftar versi dinamis (dikelola dari admin.gowithdme.com > Kelola Template) ===
-- Tabel tpl_versions peninggalan v1 (tanpa kolom slug) disimpan sebagai tpl_versions_v1, tidak dihapus.
do $$ begin
  if to_regclass('public.tpl_versions') is not null and not exists(select 1 from information_schema.columns
     where table_schema='public' and table_name='tpl_versions' and column_name='slug') then
    alter table public.tpl_versions rename to tpl_versions_v1;
  end if;
end $$;

create table if not exists public.tpl_versions(
  slug text not null default 'gwm-majalah' check (slug ~ '^[a-z0-9-]+$'),
  version text not null check (version ~ '^[0-9a-z.-]+$'),
  release_date date not null default current_date,
  changelog text not null default '',
  file_path text not null,
  is_latest boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (slug,version));
create unique index if not exists tpl_ver_one_latest on public.tpl_versions(slug) where is_latest;

create or replace function public.tpl_single_latest() returns trigger language plpgsql set search_path=public as $$
begin
  if new.is_latest then
    update public.tpl_versions set is_latest=false where slug=new.slug and version<>new.version and is_latest;
  end if;
  return new;
end $$;
drop trigger if exists tpl_single_latest on public.tpl_versions;
create trigger tpl_single_latest before insert or update on public.tpl_versions for each row execute function public.tpl_single_latest();

alter table public.tpl_versions enable row level security;
grant select on public.tpl_versions to anon, authenticated;
grant insert, update, delete on public.tpl_versions to authenticated;
drop policy if exists tpl_v_read on public.tpl_versions;
create policy tpl_v_read on public.tpl_versions for select to anon, authenticated using (true);
drop policy if exists tpl_v_ins on public.tpl_versions;
create policy tpl_v_ins on public.tpl_versions for insert to authenticated with check (is_admin());
drop policy if exists tpl_v_upd on public.tpl_versions;
create policy tpl_v_upd on public.tpl_versions for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists tpl_v_del on public.tpl_versions;
create policy tpl_v_del on public.tpl_versions for delete to authenticated using (is_admin());

-- Batas 5 MB di bucket
update storage.buckets set file_size_limit=5242880, public=false where id='templates';

-- Versi awal (berkas: seed/gwm-majalah-v10.2.xml di repo template)
insert into public.tpl_versions(slug,version,release_date,changelog,file_path,is_latest)
select 'gwm-majalah','10.2','2026-11-21','Logo tulisan bawaan tanpa gadget gambar.','gwm-majalah/v10.2.xml',
  not exists(select 1 from public.tpl_versions where slug='gwm-majalah' and is_latest)
on conflict (slug,version) do nothing;
