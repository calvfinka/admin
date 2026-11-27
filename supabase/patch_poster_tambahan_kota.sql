-- PATCH: poster tambahan (event multi-hari) + tambah kota baru dari panel admin.
-- Aman dijalankan ulang. Jalankan SEBELUM memakai panel admin versi baru.

-- 1) Poster tambahan. poster_url tetap poster utama / Hari 1; kolom ini untuk Hari 2, dst.
alter table events add column if not exists extra_posters text[] not null default '{}';

-- 2) Tambah kota baru dari panel (kota yang belum ada di daftar).
create or replace function admin_add_city(p_name text, p_province text) returns int
language plpgsql security definer set search_path=public as $$
declare nm text:=nullif(trim(regexp_replace(coalesce(p_name,''),'\s+',' ','g')),''); sl text; pid int; cid int;
begin
  if not (has_perm('events.publish') or is_admin()) then
    raise exception 'Tidak punya izin menambah kota.' using errcode='42501'; end if;
  if nm is null or length(nm)>60 then raise exception 'Nama kota wajib diisi (maks 60 huruf).'; end if;
  select id into pid from provinces where name=p_province;
  if pid is null then raise exception 'Provinsi tidak ditemukan.'; end if;
  sl:=trim(both '-' from regexp_replace(lower(nm),'[^a-z0-9]+','-','g'));
  select id into cid from cities where slug=sl or lower(name)=lower(nm) limit 1;
  if cid is not null then return cid; end if;           -- sudah ada: pakai yang lama
  insert into cities(province_id,name,slug) values(pid,nm,sl) returning id into cid;
  return cid;
end $$;
revoke all on function admin_add_city(text,text) from public, anon;
grant execute on function admin_add_city(text,text) to authenticated;

-- 3) Daftar provinsi untuk pilihan di form (kalau tabel provinces belum bisa dibaca panel)
-- (opsional) create policy "provinsi: baca" on provinces for select to authenticated using (true);
