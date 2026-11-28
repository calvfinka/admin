-- Ekspor event untuk cek duplikat (OPSIONAL).
-- Tombol "Unduh CSV" di panel admin TIDAK butuh SQL ini. Pakai berkas ini bila ingin
-- mengunduh SEMUA event langsung dari Supabase (Table Editor / SQL Editor > Download CSV),
-- atau mencari event ganda yang sudah telanjur ada. Aman dijalankan ulang.

-- 1) View: satu baris per event + kunci_duplikat (aturan sama dengan pemeriksaan di panel admin:
--    nama kota | tanggal mulai | 10 huruf/angka pertama judul).
create or replace view public.event_export
with (security_invoker = true) as
select
  lower(coalesce(c.name, '')) || '|' || e.event_date || '|' ||
    left(regexp_replace(lower(e.title), '[^a-z0-9]', '', 'g'), 10) as kunci_duplikat,
  e.title      as judul,
  e.category   as kategori,
  e.status,
  c.name       as kota,
  e.event_date as tanggal_mulai,
  e.end_date   as tanggal_selesai,
  e.venue,
  e.organizer  as penyelenggara,
  e.price_label as harga,
  e.genre,
  e.lineup,
  e.mountain   as gunung,
  e.ticket_url as link_tiket,
  e.source_ig  as instagram_sumber,
  e.slug,
  e.id
from public.events e
left join public.cities c on c.id = e.city_id;

-- View ini hanya untuk SQL Editor / service role; tidak dibuka lewat API publik.
revoke all on public.event_export from anon, authenticated;

-- 2) Unduh: jalankan di SQL Editor lalu klik "Download CSV" pada hasil.
--    select * from public.event_export order by tanggal_mulai;
--    Satu kategori saja:
--    select * from public.event_export where kategori = 'konser' order by tanggal_mulai;

-- 3) Cari event yang sudah ganda (kunci sama):
--    select kunci_duplikat, count(*) as jumlah, string_agg(judul || ' [' || status || ']', '  ||  ') as daftar
--    from public.event_export
--    group by kunci_duplikat
--    having count(*) > 1
--    order by jumlah desc;
