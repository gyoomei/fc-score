# FC Score

FC Score adalah Farcaster Mini App untuk mengecek reputasi pengguna dari FID, sinyal sosial Farcaster/Neynar, dan aktivitas onchain di Base.

## Fungsi utama

- Cek skor reputasi Farcaster berdasarkan FID.
- Tampilkan profil Farcaster saat data Neynar tersedia.
- Analisis aktivitas wallet di Base seperti transaksi, kontrak unik, aktivitas 30 hari, dan kategori protokol.
- Gabungkan sinyal sosial dan onchain menjadi ringkasan score yang mudah dibaca.
- Buat kartu/share image untuk membagikan hasil score di Farcaster.

## Cara pakai

1. Buka app dari Farcaster Mini App.
2. Masukkan FID atau gunakan konteks user Farcaster jika tersedia.
3. Hubungkan wallet Base jika ingin menambahkan analisis onchain.
4. Lihat score, breakdown, tier, dan insight reputasi.
5. Bagikan hasil ke Farcaster.

## Konfigurasi penting

Environment variable yang dipakai app:

- `NEYNAR_API_KEY` — untuk mengambil data profil dan sinyal Farcaster dari Neynar.
- `NEXT_PUBLIC_USER_FID` — opsional, FID default/app owner.
- `NEXT_PUBLIC_CLOUDFLARE_WORKERS_URL` — domain production tanpa protokol.
- `WEBHOOK_URL` — opsional untuk webhook Farcaster.

## Farcaster Mini App

Manifest tersedia di:

```text
/.well-known/farcaster.json
```

Jika domain production berubah, account association Farcaster harus di-sign ulang untuk domain baru. Jangan edit payload/signature secara manual karena signature harus cocok dengan domain.

## Development

```bash
pnpm install
pnpm run dev
```

Buka [http://localhost:3000](http://localhost:3000).
