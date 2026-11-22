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
