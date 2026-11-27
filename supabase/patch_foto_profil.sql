-- Foto profil (Tahap 4). Aman dijalankan ulang di Supabase > SQL Editor.
-- Tidak mengubah policy tabel profiles: avatar_url hanya diubah lewat set_my_avatar(), untuk akun sendiri.
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 1048576, array['image/webp','image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS storage: setiap akun hanya boleh mengelola folder bernama id-nya sendiri.
drop policy if exists "foto profil: lihat milik sendiri" on storage.objects;
create policy "foto profil: lihat milik sendiri" on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "foto profil: unggah milik sendiri" on storage.objects;
create policy "foto profil: unggah milik sendiri" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "foto profil: hapus milik sendiri" on storage.objects;
create policy "foto profil: hapus milik sendiri" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.set_my_avatar(p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Silakan masuk dahulu.'; end if;
  if p_url is not null and (p_url !~ '^https://' or
     position('/storage/v1/object/public/profile-photos/' || auth.uid()::text || '/' in p_url) = 0) then
    raise exception 'Alamat foto tidak valid.';
  end if;
  update profiles set avatar_url = p_url where id = auth.uid();
  if not found then raise exception 'Profil tidak ditemukan.'; end if;
end $$;
revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
