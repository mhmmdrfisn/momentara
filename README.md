# Momentara

Photobooth yang hidup di satu file HTML. Pilih bingkai, tumpuk overlay lucu di atas foto, tekan sekali, lalu unduh strip berisi tiga foto Anda.

Semua digambar langsung di `<canvas>` di perangkat Anda sendiri — tidak ada unggahan, tidak ada akun, tidak ada server.

---

## Menjalankan

Butuh **server lokal** agar browser mengizinkan akses kamera. `file://` tidak cukup karena `getUserMedia` hanya jalan di origin aman.

```bash
git clone https://github.com/mhmmdrfisn/momentara.git
cd momentara
python -m http.server 8000
```

Buka <http://localhost:8000>.

Alternatif: `npx serve`, `php -S localhost:8000`, atau Live Server dari VS Code.

---

## Fitur

- **Tiga foto otomatis.** Satu kali tekan, hitung mundur 3-2-1 per foto, kilau putih di antar foto.
- **38 bingkai**, dikelompokkan menjadi Elegan, Segar, Kosmik, Lucu, Romans, Budaya, Vintage, dan Minimal.
- **7 overlay lucu** — Mahkota, Kacamata, Kumis, Topi Pesta, Teling Kucing, Merona, Kilau — digambar *di atas* foto. Bisa ditumpuk sebanyak apa pun pada bingkai mana pun.
- **Pratinjau jujur.** Setiap kartu dirender oleh kode yang sama dengan strip akhir, jadi pratinjau tidak mungkin menampilkan sesuatu yang berbeda dari hasil sebenarnya.
- **Cari bingkai** berdasarkan nama atau kelompok, plus tombol **Acak** untuk pilihan acak.
- **Ulangi** tanpa memuat ulang halaman, dan nama file unduhan mengikuti bingkai yang Anda pilih.
- **Ingat pilihan terakhir** lewat `localStorage`.
- Foto dicerminkan seperti cermin sungguhan dan dipotong konsisten rasio 4:3.

---

## Struktur

Tidak ada build step, tidak ada framework. `index.html` berisi markup, gaya, dan satu skrip yang mendefinisikan tiga hal:

```
pembantu    rr() acak() bintang() hati() daun() …    primitif gambar
BININGKAI   38 entri                                definisi bingkai
OVERLAY     7 entri                                 corak di atas foto
```

Sebuah bingkai adalah data murni plus dua fungsi gambar:

```js
batik: {
  nama: 'Batik Parang',
  grup: 'Budaya',
  foto: { radius: 8, garis: { warna: '#F5F3FF', lebar: 4 } },
  bg(ctx, w, h) { /* gambar latar 600×1600 */ },
  judul: { teks: 'BATIK PARANG', font: `700 30px ${SANS}`, warna: '#FDE68A' }
}
```

Lalu `composeStrip()` menjalankan: `bg()` → tiga `gambarFoto()` → `atas()` opsional → judul → kaki.

Dua hal yang perlu diketahui bila ingin menambah bingkai:

- **Keacakan memakai benih.** Semua pola prosedural memanggil `acak(namaBingkai)`, bukan `Math.random()`. Jadi taburan bintang dan serpihan terrazzo selalu muncul di tempat yang sama setiap kali digambar ulang. Itulah yang membuat pratinjau cocok dengan hasilnya.
- **`foto` itu resep, bukan kondisi khusus.** `{ alas, ruang, radius, garis, bayang }` dibaca oleh satu fungsi yang sama, sehingga percabangan `if (selectedTheme === 'velvet')` yang lama sudah hilang.

### Menambah bingkai

Tambahkan satu entri ke `BININGKAI`. Galeri, pratinjau, pencarian, pengelompokan, dan nama file unduhan semuanya menyesuaikan sendiri. Pakai ulang `gradien()`, `radial()`, `bintang()`, `hati()`, `daun()`, `pelangi()`, `ledakan()`, `bintangLatar()`, dan `acak()` daripada memanggil `Math.random()`.

### Menambah overlay

Tambahkan ke `OVERLAY` dengan `label`, warna `sw` untuk chip, dan `fn(ctx, w, h)` yang menggambar dalam **koordinat lokal foto** (`0,0` adalah pojok kiri atas foto). `gambarFoto()` sudah mengurus pemotongan dan pergeseran koordinat.

---

## Privasi

Foto tidak pernah dikirim ke mana pun. Alirannya langsung dari kamera ke canvas di luar layar, lalu ke `blob:` URL untuk diunduh. Tidak ada panggilan jaringan setelah halaman dimuat, tidak ada analitik, tidak ada cookie. Satu-satunya data yang disimpan adalah bingkai dan overlay pilihan Anda di `localStorage`, dan itu terhapus bersama data situs.

Aliran kamera dilepas setelah pemotretan, saat dibatalkan, saat tab disembunyikan, dan saat halaman ditutup. Hitung mundur yang sedang berjalan dibatalkan lewat token sesi, sehingga tidak ada timer yang masih berjalan menembak ke layar yang sudah ditinggalkan.

---

## Kebutuhan

Chrome, Edge, Firefox, atau Safari versi terkini. Memakai `getUserMedia`, `<canvas>`, dan `IntersectionObserver` (untuk pratinjau malas). Kamera memerlukan origin aman — `localhost` sudah cukup.

---

## Lisensi

[MIT](LICENSE) © 2026 mhmmdrfisn