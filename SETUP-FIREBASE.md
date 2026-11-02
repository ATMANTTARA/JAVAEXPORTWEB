# Setup Login Google dan Dashboard Admin

Fitur ini memakai Firebase (paket gratis Spark, tanpa kartu kredit). Website tetap statis dan tetap bisa di-host di GitHub Pages.

## 1. Buat project Firebase

1. Buka https://console.firebase.google.com lalu klik **Add project**.
2. Beri nama, misalnya `java-essence-export`. Google Analytics boleh dimatikan.

## 2. Daftarkan aplikasi web

1. Di halaman project, klik ikon **Web** (`</>`).
2. Beri nama aplikasi, lewati Firebase Hosting, klik **Register app**.
3. Salin isi `firebaseConfig`, lalu tempel ke `js/firebase-config.js` menggantikan semua nilai `ISI_...`.

## 3. Aktifkan login Google

1. Menu **Build > Authentication > Get started**.
2. Tab **Sign-in method**, pilih **Google**, aktifkan, isi email dukungan, simpan.
3. Tab **Settings > Authorized domains**, klik **Add domain** lalu tambahkan domain tempat website berjalan:
   - `atmanttara.github.io` (atau domain GitHub Pages / domain sendiri yang dipakai)
   - `localhost` biasanya sudah ada untuk pengujian.

## 4. Buat database Firestore

1. Menu **Build > Firestore Database > Create database**.
2. Pilih lokasi `asia-southeast2 (Jakarta)`, mode **production**.
3. Tab **Rules**, ganti isinya dengan isi file `firestore.rules`, lalu **Publish**.

## 5. Tentukan email admin (di dua tempat)

Ganti `emailadmin@gmail.com` dengan email Gmail milik admin (boleh lebih dari satu):

- `js/firebase-config.js` pada `ADMIN_EMAILS`
- `firestore.rules` pada baris `request.auth.token.email in [...]`

Contoh dua admin: `['admin1@gmail.com', 'admin2@gmail.com']`

Daftar di `firestore.rules` yang sebenarnya menjaga keamanan data. Daftar di `firebase-config.js` hanya mengatur tampilan menu admin.

## 6. Jalankan dan uji

Modul JavaScript tidak jalan jika file dibuka langsung (`file://`). Gunakan salah satu:

- VS Code, ekstensi **Live Server**, klik kanan `index.html` lalu **Open with Live Server**.
- Atau push ke GitHub Pages.

Uji:

1. Buka `products.html`. Halaman terbuka untuk umum, tetapi produk terbaru dari dashboard hanya tampil setelah login.
2. Klik **Sign in** dan login dengan akun Google.
3. Login dengan email admin, buka `admin.html`, lalu tambah produk. Produk langsung muncul di `products.html` pada kategori yang dipilih.

## Cara kerja

| Halaman | Akses |
| --- | --- |
| `index`, `about`, `contact`, `login` | Publik |
| semua `gallery-*`, semua halaman detail produk | Wajib login Google |
| `products` | Terbuka untuk umum; produk tambahan dari dashboard tampil setelah login |
| `admin` | Hanya email admin |

Halaman yang wajib login diatur di `js/guard.js` (daftar `PROTECTED_PAGES`). Hapus nama halaman dari daftar itu bila ingin membukanya untuk publik.

## Best Seller dan Gallery

Saat menambah atau mengubah produk di dashboard, bagian **Tampilkan di** punya dua pilihan:

- **Best Seller**: produk muncul di halaman `products.html` (di luar gallery).
- **Gallery**: produk muncul di halaman galeri kategorinya. Pilih juga **Bagian di Gallery** (misalnya Main Categories atau salah satu sub-grup).

Keduanya boleh dicentang sekaligus. Tombol **Impor Produk Bawaan Website** memasukkan 18 produk halaman Products dan 82 item galeri ke dashboard (100 item). Setelah diimpor, kartu statis yang sama disembunyikan otomatis agar tidak dobel. Pilihan tempat tampil bisa diubah kapan saja lewat tombol **Ubah**.

## Catatan penting

- Halaman produk lama (`gallery-*.html`, `kursi.html`, dst.) adalah file HTML statis. Pembatasan login di sana bersifat penghalang di sisi browser, bukan pengaman penuh: orang yang tahu alamat file dan memakai alat pengembang masih bisa membukanya. Data produk dari dashboard terlindungi penuh oleh aturan Firestore karena baru bisa dibaca setelah login.
- Jika ingin semua produk benar-benar terlindungi, tambahkan produknya lewat dashboard admin, lalu hapus halaman statis lama.
- Foto produk disimpan di Firestore (diperkecil otomatis ke maksimal 900 px, 3 foto per produk). Cukup untuk puluhan hingga ratusan produk pada paket gratis. Bila katalog tumbuh sangat besar, pindahkan foto ke Cloudinary atau Firebase Storage.
- Tab **Calon Buyer** di dashboard berisi nama, email, waktu login pertama dan terakhir dari setiap orang yang login. Halaman login sudah memuat pemberitahuan bahwa data ini disimpan.
