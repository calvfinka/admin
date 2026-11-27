# GoWithDME Admin

Panel admin terpisah untuk gowithdme.com. Situs statis (tanpa build) yang berbicara langsung ke Supabase.
Alamat: https://admin.gowithdme.com

## Pasang

1. Buat repo GitHub baru (mis. `gowithdme-admin`), unggah seluruh isi folder ini ke root.
2. Settings > Pages > Deploy from a branch > `main` / root. Custom domain: `admin.gowithdme.com` (file `CNAME` sudah ada), lalu centang Enforce HTTPS.
3. DNS: tambah rekor CNAME `admin` mengarah ke `<akun-github>.github.io`.
4. Supabase > Authentication > URL Configuration: tambahkan `https://admin.gowithdme.com` ke Site URL atau Redirect URLs (perlu untuk "Kirim tautan masuk" dan "Lupa kata sandi?"; alamat yang dipakai tanpa query, mis. `https://admin.gowithdme.com/`).

Setiap `git push` ke `main` memperbarui situs lewat GitHub Pages (tunggu sekitar 1 menit, cek tab Actions). Bila tampilan lama masih muncul, tutup tab lalu buka lagi.

## Catatan

- Keamanan data ada di Supabase (login dan Row Level Security), bukan di kerahasiaan alamat ini. Pastikan hanya akun berperan `admin` yang boleh menulis ke tabel.
- `js/config.js` di sini harus sama dengan di repo situs utama. Kalau satu berubah, ubah keduanya.
- Aturan render tulisan di `js/admin-blog.js` harus tetap sama dengan `tools/blog.py` di repo situs utama.
- Halaman ini tidak diindeks (`noindex`, `robots.txt`).

## SQL yang dibutuhkan (Supabase > SQL Editor)

Semua aman dijalankan ulang. Sebelum SQL-nya dijalankan, menu terkait menampilkan petunjuk pemasangan, bagian lain tetap jalan.

| Menu | Berkas | Asal repo |
|---|---|---|
| Dasar, peran, izin | `schema_rbac.sql` (jalankan lebih dulu) | situs utama |
| Statistik > Browser | `schema_browser.sql` | browser |
| Statistik > Moderasi | `schema_moderasi.sql` (setelah `schema_browser.sql`) | browser |
| Iklan & Lencana | `schema_iklan.sql` | situs utama |
| AI (Dea) > Ringkasan, Tinjau jawaban, Pelatihan | `admin_ai.sql` (setelah `schema.sql` dan `learning.sql`) | Dea |
| AI (Dea) > Percakapan | `supabase/admin_ai_chat.sql` (setelah `schema_rbac.sql` dan `admin_ai.sql`) | repo ini |

## Admin tambahan & batas akses

Halaman **Admin & Akses** (khusus Pemilik) menambah admin baru dengan peran/izin terbatas. Jalankan `schema_rbac.sql` (repo situs utama) lebih dulu; panduan lengkap di `AKSES-ADMIN.md` repo situs.

- `js/rbac-core.js` = katalog izin & preset (harus sama dengan `schema_rbac.sql`); `js/admin-access.js` = gerbang menu + halaman kelola admin.
- Uji: `node tests/rbac.test.js` (cek logika dan kecocokan dengan `tests/schema_rbac.sql`; salin ulang berkas SQL itu bila SQL berubah).

## Tampilan HP

- Layar <= 899px (dan HP yang membuka "Situs desktop", 900-1023px berjari): sidebar jadi laci geser dengan tombol hamburger di kiri atas; konten selebar layar; statistik 2 kolom; di Event Terdekat tiap event punya satu tombol "Kelola" yang membuka Edit / Tarik / Duplikat / Hapus. Laptop/PC tidak berubah.
- Berkas: `css/admin-mobile.css` (dimuat paling akhir), `js/admin-mobile.js` (hanya buka/tutup laci & Kelola), `assets/kontur-soft.svg`.
- Uji: `node tests/mobile-360.js` (Playwright; set `PW=` bila lokasinya beda). Tangkapan layar masuk `tests/shots/`.

## Statistik > Browser (lalu lintas browser.gowithdme.com)

Tab **Browser** di Statistik menampilkan kunjungan, situs yang dibuka, mode proxy/langsung, situs bermasalah, kinerja proxy, dan aliran peristiwa langsung (menyegar tiap 15 detik). Izin: `stats.view` (tidak ada izin baru). Hapus data lama: khusus Pemilik.

- Berkas: `js/admin-stats.js` (fungsi `browserView`, `loadBrowser`), tombol tab di `index.html`.

## Statistik > Moderasi (kelola daftar blokir browser)

Tab **Moderasi** di Statistik: tambah/hapus situs di daftar blokir atau peringatan, tindak lanjuti laporan pengguna browser, dan lihat jumlah penolakan. Kartu **Pop-up iklan diblokir** menampilkan tujuan iklan teratas (tombol Blokir) dan situs yang paling sering memicunya (tombol Izinkan pop-up = kecualikan dari pemblokir pop-up sentuhan). Membaca: `stats.view`; mengubah, menutup laporan, dan menghapus: khusus Pemilik (ditegakkan di database).

- Berkas: `js/admin-moderasi.js` (dihubungkan lewat `window.ADM_MOD`), perubahan kecil di `js/admin-stats.js` (cabang `tab==="mod"`), tombol tab di `index.html`.

## Iklan & Lencana

Menu **Iklan & Lencana** (izin `sponsor.view` melihat, `sponsor.manage` mengubah): peta penempatan di situs, formulir dengan pratinjau yang sama persis dengan situs, jadwal, target kota, bobot, aktif/nonaktif, hitungan klik. Kartu Lead Sponsor punya tombol **Buat lencana iklan** (terisi sesuai paket).

- `js/ads-core.js` harus identik dengan repo situs. Uji: `node tests/ads.test.js` (salin ulang `tests/schema_iklan.sql` bila SQL berubah) dan `node tests/ads-browser.js`.

## AI (Dea)

Menu **AI (Dea)** (khusus Pemilik, ditegakkan di database lewat `is_owner()`) memantau asisten di ai.gowithdme.com. Lima tab:

| Tab | Isi |
|---|---|
| Ringkasan | angka dan pola pemakaian (permintaan, chat baru, jam ramai, kegagalan, per model) |
| Percakapan | isi chat per orang (lihat di bawah) |
| Tinjau jawaban | pasangan tanya-jawab yang sengaja dinilai pengguna (👍/👎); **Setujui** atau **Tolak** |
| Pelatihan | jumlah contoh siap diekspor dan riwayat ekspor / fine-tune |
| Status model | pemeriksaan kesehatan Worker dan model |

Berkas: `js/admin-ai.js` (tab), `js/ai-core.js` (label dan logika murni), `tests/ai-core.test.js`.

### Percakapan (isi chat per orang)

Susunannya mengikuti web Dea:

1. **Daftar orang**: foto, nama, kota, jumlah chat/pesan, cari nama atau kota. Tamu yang belum login tampil sebagai "Tamu" per perangkat.
2. **Profil satu orang**: ringkasan dan daftar obrolan seperti bilah samping Dea (judul = pesan pertama, suasana Ceria/Galak/Manja, mode, jumlah pesan, "3 jam lalu"), dengan filter Ngobrol / Gunung / Konser / Trip. Ada tombol **Hapus riwayat orang ini**.
3. **Isi satu obrolan**: gelembung pesan, dengan tombol "Muat pesan lebih lama".

Pemasangan:

1. Jalankan `supabase/admin_ai_chat.sql`. Menjalankan ulang aman: menambah kolom `persona`, fungsi `admin_ai_sessions`, dan mengganti `admin_ai_person` (kini punya `p_session`).
2. Pencatat chat ada di repo Dea (`worker/chatlog.js`), dan `PATCH-worker-chat-log.md` di repo ini adalah cara lama (usang). Jangan dipasang bersamaan, nanti chat tercatat dua kali.
3. Pengguna harus setuju lebih dulu di ai.gowithdme.com (kotak persetujuan atau saklar **Catat obrolan saya** di profil). Tanpa itu, tidak ada chat yang dicatat dan tab ini kosong.

Privasi dan kontrol:

- Setiap membuka daftar atau riwayat tercatat di `admin_audit` (`ai.people.list`, `ai.sessions.list`, `ai.chat.view`, `ai.chat.delete`) dan log itu tidak bisa diubah.
- Masa simpan 90 hari (`ai_chat_purge`). Jadwalkan lewat pg_cron; baris perintahnya ada di akhir `admin_ai_chat.sql` (aktifkan dulu Database > Extensions > pg_cron).
- Tabel tertutup untuk browser; hanya Worker (service key) yang menulis dan hanya fungsi khusus Pemilik yang membaca.
- Sebelum dipakai: perbarui halaman Privasi di gowithdme.com. Permintaan hapus data lewat `personal@gowithdme.com` dilayani dengan tombol **Hapus riwayat orang ini**.
- Tombol X di bilah samping Dea hanya menghapus obrolan dari tampilan pengguna. Salinan di panel ini tetap ada sampai masa simpan habis atau dihapus lewat tombol di atas.

Bila tab menampilkan "Percakapan belum dipasang di Supabase", jalankan `admin_ai_chat.sql` lalu muat ulang. Bila daftar kosong padahal SQL sudah jalan, periksa bahwa Worker Dea sudah ter-deploy, pengguna sudah menyalakan saklar, dan secret `SUPABASE_SERVICE_KEY` di Worker terisi dengan kunci service_role.

## Uji

```
node tests/ai-core.test.js      # menu AI
node tests/rbac.test.js         # peran dan izin
node tests/ads.test.js          # iklan
node tests/integrity.test.js
node tests/noindex.test.js
```

Uji browser (Playwright): `tests/mobile-360.js`, `tests/ads-browser.js`, `tests/browser-smoke.js`.
