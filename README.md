# Momentara

Photobooth sederhana yang berjalan sepenuhnya di dalam browser. Pilih satu bingkai, tekan tombol rana sekali, dan aplikasi mengambil tiga foto beruntun lalu menyusunnya menjadi satu strip PNG yang bisa diunduh.

Seluruh pemrosesan gambar dilakukan di `<canvas>` di perangkat Anda. Tidak ada unggahan, tidak ada akun, tidak ada server.

---

## Menjalankan

```bash
git clone https://github.com/mhmmdrfisn/momentara.git
cd momentara
python -m http.server 8000
```

Buka <http://localhost:8000>.

**Server lokal wajib dipakai.** Browser hanya mengizinkan `getUserMedia` pada origin aman (`https://` atau `localhost`). Membuka `index.html` langsung lewat `file://` membuat halaman tetap tampil, tetapi tombol kamera gagal karena alasan keamanan browser.

Alternatif: `npx serve`, `php -S localhost:8000`, atau ekstensi Live Server di VS Code.

---

## Cara kerja

1. Pilih bingkai dari daftar.
2. Klik **Initialize Camera** — browser meminta izin kamera.
3. Klik tombol rana **satu kali**. Tiga foto diambil otomatis:
   - hitung mundur 3-2-1 sebelum tiap foto,
   - kilau putih sesaat tiap kali rana ditekan,
   - jeda 1 detik antar foto.
4. Strip selesai, lalu tampil di layar hasil.
5. Klik **Download** untuk menyimpan PNG, atau **Home** untuk kembali.

Pratinjau kamera dicerminkan seperti cermin sungguhan. Setiap foto dipotong ke rasio 4:3 yang sama agar ketiga bingkai selalu sejajar.

---

## Tab About Creator

Di kanan atas daftar bingkai ada tautan **About Creator** yang membuka profil singkat disertai portofolio sembilan proyek. Tab ini memakai `switchView()` yang sama dengan layar kamera, dan tetap responsif di ponsel maupun desktop.

- Sembilan proyek dirender dari array `PROYEK` lewat `renderProyek()`. Susunan tiap kartu dari atas ke bawah: judul, deskripsi, deretan tag, lalu "Kunjungi proyek" bila proyek punya URL.
- Tag disimpan sebagai array dan digambar sebagai chip terpisah satu per satu, bukan satu string yang dipisah garis miring. Contoh: `tag: ["Javascript", "HTML", "TailWind"]`.
- Proyek yang punya URL hidup menjadi tautan; yang URL-nya `#` tetap sebagai kartu statis.
- SimpleCalc menautkan ke https://simplexcalc-bytexindonesia.netlify.app/ bersama Virtual Tour Campus Tel-U dan Queue Tracker.
- Tautan sosial di profil: LinkedIn, https://github.com/mhmmdrfisn, dan Instagram.

---

## Bingkai

Sepuluh bingkai, didefinisikan di objek `themes`:

| Bingkai | Warna teks | Font |
|---|---|---|
| Aura Blanc | `#475569` | Plus Jakarta Sans |
| Lumina Pearl | `#6D28D9` | Playfair Display |
| Linen Dream | `#57534E` | Plus Jakarta Sans |
| Matcha Latte | `#166534` | Plus Jakarta Sans |
| Santalus Merpati | `#9D174D` | Playfair Display (miring) |
| Cendrawasih Vetiver | `#0E7490` | Plus Jakarta Sans |
| Kasmir Kijang | `#0369A1` | Plus Jakarta Sans |
| Noir Ébène | `#D4AF37` | Playfair Display (miring) |
| Velvet Rose | `#9F1239` | Playfair Display (miring) |
| Oud Wood | `#D6D3D1` | Plus Jakarta Sans (tebal) |

---

## Struktur kode

Semuanya berada di satu `index.html`. Tiga bagian penting:

**`themes`** — kamus warna, font, dan teks judul untuk setiap bingkai.

**`captureFrame(video)`** — menggambar satu frame dari `<video>` ke canvas berukuran 500×375, memotongnya ke rasio 4:3 dan mencerminnya.

**`processPhotos()`** — menyusun strip akhir. Latar depan bingkai digambar lebih dulu, lalu tiga foto, lalu judul dan footer. Sebagian bingkai punya latar khusus yang ditangani lewat percabangan di fungsi ini.

Konstanta ukuran ada di bagian atas skrip:

```js
const CANVAS_W = 600, CANVAS_H = 1600, PHOTO_W = 500, PHOTO_H = 375, PADDING = 50, SPACING = 30;
```

- `CANVAS_W` × `CANVAS_H` — ukuran strip hasil, 600 × 1600
- `PHOTO_W` × `PHOTO_H` — ukuran satu foto, 500 × 375 (rasio 4:3)
- `PADDING` dan `SPACING` — jarak tepi serta jarak antar foto

Hasil akhir diekspor sebagai PNG 600 × 1600.

### Menambah bingkai baru

Tambahkan satu entri ke objek `themes`:

```js
themes.hijau = {
    bg: '#ECFDF5',
    border: '#A7F3D0',
    text: 'Hijau Muda',
    textColor: '#065F46',
    font: '600 28px "Plus Jakarta Sans"',
    radius: 24
};
```

Lalu salin salah satu kartu yang sudah ada di markup, ganti `onclick="selectTheme('hijau')"` dan `id="theme-hijau"`. Kalau bingkai itu butuh latar khusus, tambahkan percabangannya di `processPhotos()`.

---

## Ketergantungan

Semua dimuat dari CDN, jadi butuh koneksi internet saat halaman pertama dibuka:

- **Tailwind CSS** via `cdn.tailwindcss.com`
- **Google Fonts** — Plus Jakarta Sans dan Playfair Display

Tidak ada proses build, tidak ada `package.json`, tidak ada dependensi npm.

---

## Privasi

Foto tidak pernah dikirim ke mana pun. Alurnya langsung dari kamera ke canvas, lalu ke tautan unduhan di komputer sendiri. Tidak ada analitik, tidak ada cookie, tidak ada penyimpanan. Menutup halaman menghapus semuanya.

---

## Kebutuhan

Browser Chromium, Firefox, atau Safari versi terkini, dengan kamera dan mikrofon tidak dipakai aplikasi lain.

---

## Lisensi

[MIT](LICENSE) Copyright (c) 2026 Rafi Sanjaya