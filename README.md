# Nota · Analisis penjualan Toko Aksara

Aplikasi praktikum Flask Anvisdat untuk toko alat tulis fiktif di Cirebon. Satu nota dapat berisi beberapa produk dan satu metode pembayaran. Data awal merupakan simulasi deterministik selama 112 hari, 6 Agustus–25 November 2026, dengan sepuluh produk. Satuan uang adalah rupiah bulat. Aplikasi dirancang untuk dijalankan lokal oleh satu pengguna.

## Jalankan di Windows

Ekstrak ZIP. Di VS Code, buka folder yang berisi `app.py` dan jalankan perintah berikut di terminal PowerShell dengan Python 3.10 atau lebih baru.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Buka http://127.0.0.1:5000. Hentikan server dengan Ctrl+C. Paket Flask diunduh saat instalasi pertama. Setelah itu aplikasi dapat berjalan tanpa internet. Untuk Linux/macOS gunakan `python3 -m venv .venv`, `.venv/bin/python -m pip install -r requirements.txt`, dan `.venv/bin/python app.py`.

Saat pertama kali berjalan, aplikasi membuat `instance/nota.sqlite3`. Perubahan tetap tersimpan setelah server dimatikan. Cadangkan berkas tersebut ketika server berhenti untuk menyimpan pekerjaan praktikum. Demo web memakai IndexedDB di browser masing-masing dan tidak menyinkronkan data dengan SQLite.

## Alur demonstrasi praktikum

1. Buka Ringkasan. Pilih 7, 30 atau 90 hari dan perhatikan tanggal awal dan akhirnya. Semua angka memakai periode yang berakhir pada tanggal transaksi terakhir. Persentase membandingkan dua periode berurutan yang sama panjang jika riwayat mencukupi.
2. Di Transaksi, cari nomor nota, produk, tanggal ISO atau metode pembayaran. Catat satu nota berisi dua Buku Tulis A5 dan tiga Pulpen Gel 0.5 pada tanggal terakhir dataset. Totalnya Rp36.500.
3. Periksa kenaikan omzet Rp36.500, satu transaksi, dan lima unit di Ringkasan. Buka nota untuk mengubah jumlah produk. Hapus nota setelah demonstrasi untuk mengembalikan data.
4. Di Prediksi, bandingkan MAE model dan MAE pembanding. Nilai yang lebih kecil berarti galat harian rata-rata lebih kecil pada tujuh hari uji. Uji ini mendemonstrasikan alur evaluasi pada data simulasi.

## Analisis dan machine learning

- Omzet adalah jumlah kuantitas × harga jual saat transaksi. Jumlah transaksi menghitung nota unik, sedangkan produk terjual menghitung unit. Grafik garis menampilkan omzet per hari. Diagram batang mengurutkan produk atau kategori menurut unit.
- Target model adalah omzet agregat harian. Hari di antara transaksi pertama dan terakhir yang kosong diperlakukan sebagai omzet nol. Asumsi ini perlu diperiksa bila data sebenarnya memiliki hari yang belum dicatat. Riwayat maksimum 365 hari, minimum 35 hari.
- Model adalah regresi linear kuadrat terkecil (OLS), dengan indeks hari sebagai fitur tren dan hari dalam minggu sebagai fitur kategoris. Implementasi menghitung kemiringan bersama setelah mengurangi rata-rata per kelompok hari, lalu memakai intersep masing-masing kelompok. Bentuk ini setara dengan regresi linear dengan satu tren dan indikator hari.
- Tujuh hari terakhir disisihkan berurutan. Model dilatih pada periode sebelumnya, lalu dievaluasi dengan MAE = jumlah |aktual − prediksi| dibagi tujuh. Baseline adalah omzet tujuh hari sebelumnya. Model akhir dilatih ulang pada seluruh riwayat yang tersedia untuk memperkirakan tujuh hari berikutnya. Estimasi negatif dipotong ke nol dan nominal dibulatkan ke rupiah.
- Prediksi berlaku pada pola data studi kasus, dengan asumsi pencatatan hari terakhir sudah lengkap. Model tidak mengamati promosi, stok atau hari libur.

## Arsitektur

| Lokasi | Tanggung jawab |
| --- | --- |
| app.py, nota/__init__.py | Titik masuk, application factory Flask, pengelolaan koneksi per request dan endpoint JSON |
| nota/store.py | Skema produk, nota, item nota, validasi, harga historis, transaksi atomik dan deteksi konflik versi |
| nota/demo.py | Katalog dan generator data sintetis dengan seed tetap |
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
