# Nota · Analisis penjualan Toko Aksara

Aplikasi praktikum Flask Anvisdat untuk toko alat tulis fiktif di Cirebon. Satu nota dapat berisi beberapa produk dan satu metode pembayaran. Data awal merupakan simulasi deterministik selama 112 hari, 6 Agustus–25 November 2026, dengan sepuluh produk. Satuan uang adalah rupiah bulat. Aplikasi dirancang untuk dijalankan lokal oleh satu pengguna.

## Jalankan di Windows

Ekstrak ZIP. Di VS Code, buka folder yang berisi `app.py` dan jalankan perintah berikut di terminal PowerShell dengan Python 3.10 atau lebih baru.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Buka http://127.0.0.1:5000. Hentikan server dengan Ctrl+C. Flask, pandas dan Plotly diunduh saat instalasi pertama. Setelah itu aplikasi dapat berjalan tanpa internet. Untuk Linux/macOS gunakan `python3 -m venv .venv`, `.venv/bin/python -m pip install -r requirements.txt`, dan `.venv/bin/python app.py`.

Saat pertama kali berjalan, aplikasi membuat `instance/nota.sqlite3`. Perubahan tetap tersimpan setelah server dimatikan. Cadangkan berkas tersebut ketika server berhenti untuk menyimpan pekerjaan praktikum. Demo web memakai IndexedDB di browser masing-masing dan tidak menyinkronkan data dengan SQLite.

## Demonstrasi interaksi

1. Di Ringkasan, pilih 30 hari. Arahkan penunjuk ke titik pada grafik Tren omzet untuk membaca tanggal dan nominal dalam rupiah.
2. Pilih **Zoom** lalu seret area yang ingin diperbesar. Gunakan **Geser** untuk memindahkan tampilan dan **Reset tampilan** untuk mengembalikan sumbu. Zoom hanya mengubah tampilan grafik.
3. Pilih **Seleksi** lalu seret melintasi beberapa tanggal. Area terpilih diberi sorotan. KPI, lima peringkat dan daftar nota dihitung untuk rentang tersebut. **Hapus filter** memulihkan periode penuh. **Filter tanggal** menyediakan pilihan yang sama dengan formulir tanggal.
4. Klik titik omzet untuk membuka Transaksi pada tanggal itu. Pilih nomor nota untuk melihat kuantitas, harga dan subtotal. Lewat keyboard, buka **Data harian**, pilih tanggal dan tekan Enter. Tombol **Lihat semua** membuka seluruh nota dalam rentang aktif. Daftar transaksi memuat 12 nota per halaman.
5. Di Prediksi, bandingkan 7, 14 dan 30 hari ke depan. Total dan grafik mencakup seluruh horizon. Rincian menampilkan tujuh hari per halaman. MAE tetap dihitung pada tujuh hari historis terakhir.
6. Untuk demonstrasi CRUD, catat dua Buku Tulis A5 dan tiga Pulpen Gel pada 25 November 2026. Totalnya Rp36.500. Buka nota untuk mengubah jumlah atau menghapusnya.

## Memperbarui proyek lokal

Hentikan server, lalu cadangkan folder `instance` jika Anda sudah mencatat transaksi. Ekstrak versi baru di folder terpisah dan salin `instance/nota.sqlite3` dari proyek lama ke subfolder `instance` proyek baru sebelum menjalankan server. Pasang dependensi dari `requirements.txt` versi baru. Database lama menggunakan skema yang sama. Browser menyimpan perubahan demo privat per perangkat.

## Analisis dan machine learning

- Omzet adalah jumlah kuantitas × harga jual saat transaksi. Jumlah transaksi menghitung nota unik, sedangkan produk terjual menghitung unit. Grafik garis menampilkan omzet per hari. Diagram batang mengurutkan produk atau kategori menurut unit.
- Target model adalah omzet agregat harian. Hari di antara transaksi pertama dan terakhir yang kosong diperlakukan sebagai omzet nol. Asumsi ini perlu diperiksa bila data sebenarnya memiliki hari yang belum dicatat. Riwayat maksimum 365 hari, minimum 35 hari.
- Model adalah regresi linear kuadrat terkecil (OLS), dengan indeks hari sebagai fitur tren dan hari dalam minggu sebagai fitur kategoris. Implementasi menghitung kemiringan bersama setelah mengurangi rata-rata per kelompok hari, lalu memakai intersep masing-masing kelompok. Bentuk ini setara dengan regresi linear dengan satu tren dan indikator hari.
- Tujuh hari terakhir disisihkan berurutan. Model dilatih pada periode sebelumnya, lalu dievaluasi dengan MAE = jumlah |aktual − prediksi| dibagi tujuh. Baseline adalah omzet tujuh hari sebelumnya. Model akhir dilatih ulang pada seluruh riwayat yang tersedia untuk memperkirakan hingga 30 hari berikutnya. Estimasi negatif dipotong ke nol dan nominal dibulatkan ke rupiah.
- Prediksi berlaku pada pola data studi kasus, dengan asumsi pencatatan hari terakhir sudah lengkap. Model tidak mengamati promosi, stok atau hari libur.

## Arsitektur

| Lokasi | Tanggung jawab |
| --- | --- |
| app.py, nota/__init__.py | Titik masuk, application factory Flask, pengelolaan koneksi per request dan endpoint JSON |
| nota/store.py | Skema produk, nota, item nota, validasi, harga historis, transaksi atomik dan deteksi konflik versi |
| nota/demo.py | Katalog dan generator data sintetis dengan seed tetap |
| nota/charts.py | Plotly Express membentuk figure dari DataFrame omzet harian dan hasil prediksi. Flask mengirim spesifikasi figure melalui API. |
| nota/static/plots.js | Plotly.js menggambar figure dan menghubungkan tooltip, zoom, pan, seleksi dan klik titik ke transaksi. |
| nota/forecast.py | Agregasi harian, pelatihan, evaluasi kronologis dan prediksi |
| nota/templates/index.html | Struktur semantik halaman, navigasi dan dialog |
| nota/static/ | Tampilan responsif, grafik, pengelolaan formulir dan akses data |
| tests/ | Uji CRUD, integritas, prediksi, pemisahan waktu dan alur HTTP |

Relasi SQLite adalah `sale 1—N item N—1 product`. Harga disalin ke item supaya total historis konsisten. Pengubahan dan penghapusan memeriksa versi nota, dan setiap penyimpanan seluruh item berlangsung dalam satu transaksi database.

### Endpoint

| Metode | Path | Kegunaan |
| --- | --- | --- |
| GET | /api/state | Katalog, nota, dan hasil prediksi |
| POST | /api/sales | Buat nota |
| PUT | /api/sales/<id> | Ubah isi nota dengan versi terkini |
| DELETE | /api/sales/<id> | Hapus nota dengan versi terkini |

Untuk menjalankan pengujian setelah memasang Flask, gunakan `.\.venv\Scripts\python.exe -m unittest discover -s tests -v`.
