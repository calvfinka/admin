# GoWithDME Admin

Panel admin terpisah untuk gowithdme.com. Situs statis (tanpa build) yang berbicara langsung ke Supabase.
Alamat: https://admin.gowithdme.com

## Pasang
1. Buat repo GitHub baru (mis. `gowithdme-admin`), unggah seluruh isi folder ini ke root.
2. Settings > Pages > Deploy from a branch > `main` / root. Custom domain: `admin.gowithdme.com` (file `CNAME` sudah ada), lalu centang Enforce HTTPS.
3. DNS: tambah rekor CNAME `admin` mengarah ke `<akun-github>.github.io`.
4. Supabase > Authentication > URL Configuration: tambahkan `https://admin.gowithdme.com` ke Site URL atau Redirect URLs (perlu untuk "Kirim tautan masuk" dan "Lupa kata sandi?"; alamat yang dipakai tanpa query, mis. `https://admin.gowithdme.com/`).

## Catatan
- Keamanan data ada di Supabase (login dan Row Level Security), bukan di kerahasiaan alamat ini. Pastikan hanya akun berperan `admin` yang boleh menulis ke tabel.
- `js/config.js` di sini harus sama dengan di repo situs utama. Kalau satu berubah, ubah keduanya.
- Aturan render tulisan di `js/admin-blog.js` harus tetap sama dengan `tools/blog.py` di repo situs utama.
- Halaman ini tidak diindeks (`noindex`, `robots.txt`).

## Admin tambahan & batas akses
Halaman **Admin & Akses** (khusus Pemilik) menambah admin baru dengan peran/izin terbatas. Jalankan `supabase/schema_rbac.sql` (repo situs utama) lebih dulu; panduan lengkap di `AKSES-ADMIN.md` repo situs.
- `js/rbac-core.js` = katalog izin & preset (harus sama dengan `schema_rbac.sql`); `js/admin-access.js` = gerbang menu + halaman kelola admin.
- Uji: `node tests/rbac.test.js` (cek logika dan kecocokan dengan `tests/schema_rbac.sql`; salin ulang berkas SQL itu bila SQL berubah).

## Tampilan HP
- Layar <= 899px (dan HP yang membuka "Situs desktop", 900-1023px berjari): sidebar jadi laci geser dengan tombol hamburger di kiri atas; konten selebar layar; statistik 2 kolom; di Event Terdekat tiap event punya satu tombol "Kelola" yang membuka Edit / Tarik / Duplikat / Hapus. Laptop/PC tidak berubah.
- Berkas: `css/admin-mobile.css` (dimuat paling akhir), `js/admin-mobile.js` (hanya buka/tutup laci & Kelola), `assets/kontur-soft.svg`.
- Uji: `node tests/mobile-360.js` (Playwright; set `PW=` bila lokasinya beda). Tangkapan layar masuk `tests/shots/`.

## Statistik > Browser (lalu lintas browser.gowithdme.com)
Tab **Browser** di Statistik menampilkan kunjungan, situs yang dibuka, mode proxy/langsung, situs bermasalah, kinerja proxy, dan aliran peristiwa langsung (menyegar tiap 15 detik). Izin: `stats.view` (tidak ada izin baru). Hapus data lama: khusus Pemilik.
- Jalankan `supabase/schema_browser.sql` dari repo browser (setelah `schema_rbac.sql`). Sebelum itu, tab menampilkan petunjuk pemasangan.
- Berkas: `js/admin-stats.js` (fungsi `browserView`, `loadBrowser`), tombol tab di `index.html`.

## Statistik > Moderasi (kelola daftar blokir browser)
Tab **Moderasi** di Statistik: tambah/hapus situs di daftar blokir atau peringatan, tindak lanjuti laporan pengguna browser, dan lihat jumlah penolakan. Kartu **Pop-up iklan diblokir** menampilkan tujuan iklan teratas (tombol Blokir) dan situs yang paling sering memicunya (tombol Izinkan pop-up = kecualikan dari pemblokir pop-up sentuhan). Butuh `schema_browser.sql` lalu `schema_moderasi.sql` terbaru (repo browser); tanpa itu kartu menampilkan petunjuk, bagian lain tetap jalan. Membaca: `stats.view`; mengubah, menutup laporan, dan menghapus: khusus Pemilik (ditegakkan di database).
- Jalankan `supabase/schema_moderasi.sql` dari repo browser (setelah `schema_browser.sql`). Sebelum itu, tab menampilkan petunjuk pemasangan.
- Berkas: `js/admin-moderasi.js` (dihubungkan lewat `window.ADM_MOD`), perubahan kecil di `js/admin-stats.js` (cabang `tab==="mod"`), tombol tab di `index.html`.
