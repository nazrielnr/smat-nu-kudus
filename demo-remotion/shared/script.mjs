// Naskah narasi. Satu segmen = satu file suara = satu "beat" aksi di layar.
// kind "gfx" = murni grafis Remotion (tanpa rekaman layar).
export const SCENES = [
  {
    id: "intro", kind: "gfx", title: "Pengantar",
    segments: [
      { id: "i1", text: "Selamat datang di SMAT NU Kudus, Sistem Monitoring Aset Wakaf dan Tanah Nahdlatul Ulama Kabupaten Kudus. Dalam lima menit, kita telusuri semua halaman dan fiturnya." },
      { id: "i2", text: "Aplikasi ini menyatukan pencatatan dana wakaf, pembukuan akuntansi otomatis, dan pengelolaan aset wakaf, untuk lima peran pengguna." },
    ],
  },
  {
    id: "login", kind: "rec", title: "Masuk", role: "Bendahara",
    segments: [
      { id: "l1", text: "Kita mulai dari halaman masuk. Formulir memvalidasi input langsung, misalnya email kosong atau salah format." },
      { id: "l2", text: "Lalu masuk sebagai Bendahara. Sesi disimpan di cookie HttpOnly, aman dari pencurian lewat skrip." },
    ],
  },
  {
    id: "dash", kind: "rec", title: "Beranda", role: "Bendahara",
    segments: [
      { id: "d1", text: "Ini Beranda. Empat kartu menampilkan saldo kas, total penerimaan, pengeluaran, dan nilai aset wakaf, semua dalam rupiah bulat." },
      { id: "d2", text: "Grafik arus kas bisa diatur tiga, enam, atau dua belas bulan. Di sebelahnya, aset per jenis, tanah mendominasi delapan puluh delapan persen." },
      { id: "d3", text: "Di bawahnya, aktivitas terbaru lengkap dengan status, dan aksi cepat di kanan atas." },
    ],
  },
  {
    id: "wakif", kind: "rec", title: "Data Wakif", role: "Bendahara",
    segments: [
      { id: "w1", text: "Data Wakif menyimpan identitas para pewakif, dan bisa dicetak atau diekspor ke PDF." },
      { id: "w2", text: "Kita tambah wakif baru. Semua isian divalidasi sebelum disimpan." },
      { id: "w3", text: "Halaman detail menampilkan profil dan riwayat wakaf sang wakif." },
    ],
  },
  {
    id: "masuk", kind: "rec", title: "Dana Masuk", role: "Bendahara",
    segments: [
      { id: "m1", text: "Dana Masuk mencatat penerimaan wakaf, dan bisa disaring menurut status dan kategori." },
      { id: "m2", text: "Kita catat penerimaan baru. Pilih kategori, wakif, dan metode bayar, lalu isi jumlahnya, yang langsung diformat otomatis." },
      { id: "m3", text: "Simpan dan ajukan. Nomor transaksi dibuat otomatis, status menjadi menunggu persetujuan." },
    ],
  },
  {
    id: "keluar", kind: "rec", title: "Dana Keluar", role: "Bendahara",
    segments: [
      { id: "k1", text: "Dana Keluar serupa, untuk penyaluran manfaat, biaya operasional, atau imbalan nazhir, dengan tambahan penerima dan sumber dana." },
    ],
  },
  {
    id: "setuju", kind: "rec", title: "Persetujuan", role: "Pemeriksa",
    segments: [
      { id: "a1", text: "Sekarang ganti peran: keluar, lalu masuk sebagai Pemeriksa. Pembuat transaksi tidak bisa menyetujui transaksinya sendiri." },
      { id: "a2", text: "Halaman Persetujuan memuat antrean. Pemeriksa bisa menyetujui, atau menolak dengan catatan." },
      { id: "a3", text: "Detail transaksi punya garis waktu status, dari draf, menunggu, disetujui, sampai diposting. Posting dilakukan oleh Bendahara atau Administrator." },
    ],
  },
  {
    id: "aset", kind: "rec", title: "Data Aset", role: "Pengelola Aset",
    segments: [
      { id: "s1", text: "Pengelola Aset fokus pada Data Aset, dengan filter jenis dan status serta nilai tiap aset." },
      { id: "s2", text: "Detail aset memuat sertifikat, luas, lokasi, tab dokumen unggahan, dan tab riwayat perubahan." },
      { id: "s3", text: "Menambah aset memakai formulir lengkap, dari nama sampai nilai perolehan dan lokasi." },
    ],
  },
  {
    id: "buku", kind: "rec", title: "Pembukuan", role: "Administrator",
    segments: [
      { id: "b1", text: "Kini sebagai Administrator, kita masuk ke pembukuan. Bagan Akun tersusun per tipe: aset, kewajiban, aset neto, pendapatan, dan beban." },
      { id: "b2", text: "Administrator memposting transaksi tadi ke jurnal. Satu klik membuat jurnal ganda yang seimbang, idempoten, dan bernomor berurutan." },
      { id: "b3", text: "Buku Besar menampilkan mutasi per akun dengan saldo berjalan." },
      { id: "b4", text: "Saldo Akun memastikan neraca saldo seimbang, dan Lembar Kerja merangkum semua akun." },
    ],
  },
  {
    id: "laporan", kind: "rec", title: "Laporan", role: "Administrator",
    segments: [
      { id: "r1", text: "Lalu laporan keuangan. Neraca bisa dilihat per tanggal pilihan." },
      { id: "r2", text: "Daftar Aset Wakaf dan Aktivitas menunjukkan perubahan aset neto dalam satu periode." },
      { id: "r3", text: "Aset Kelolaan, Arus Kas, dan Catatan Laporan melengkapinya, semua bisa dicetak atau diunduh PDF." },
    ],
  },
  {
    id: "sistem", kind: "rec", title: "Sistem", role: "Administrator",
    segments: [
      { id: "y1", text: "Riwayat Perubahan mencatat siapa mengubah apa dan kapan. Ini jejak audit yang tak bisa dihapus." },
      { id: "y2", text: "Menu Pengguna khusus Administrator, untuk menambah akun, mengatur peran, dan menonaktifkan akun." },
      { id: "y3", text: "Terakhir Pengaturan untuk ganti kata sandi, dan dari menu akun, tampilan bisa diganti ke mode gelap." },
    ],
  },
  {
    id: "outro", kind: "gfx", title: "Penutup",
    segments: [
      { id: "o1", text: "Lima peran, satu alur: Bendahara mencatat, Pemeriksa menyetujui, Pengelola Aset merawat data, Pimpinan memantau, Administrator mengelola sistem." },
      { id: "o2", text: "Di balik layar: React dan Vite di sisi depan, Hono di atas Cloudflare Workers dengan basis data D1 di sisi belakang, lengkap dengan pengujian otomatis." },
      { id: "o3", text: "Itulah SMAT NU Kudus. Aset wakaf tercatat rapi, laporan transparan, dan semua dapat diaudit. Terima kasih." },
    ],
  },
];
