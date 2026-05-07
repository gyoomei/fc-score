# FC Score

Farcaster Mini App for checking Neynar/Farcaster reputation score and Base onchain activity.

## Deploy on Cloudflare Workers

This project is configured for Cloudflare Workers using OpenNext.

### Cloudflare build settings

Use these commands in Cloudflare:

```bash
pnpm install --frozen-lockfile
pnpm run build
npx wrangler deploy
```

`pnpm run build` runs `opennextjs-cloudflare build` and generates the `.open-next` output required by Wrangler.

### Local verification

```bash
pnpm install
pnpm run type-check
pnpm run build
pnpm exec wrangler deploy --dry-run
```

### Environment variables

Set production values in Cloudflare, not in source code:

- `NEXT_PUBLIC_CLOUDFLARE_WORKERS_URL` — production domain without protocol, for example `fc-score.<your-subdomain>.workers.dev` or your custom domain.
- `NEYNAR_API_KEY` — required for full Neynar/Farcaster profile data.
- `NEXT_PUBLIC_USER_FID` — optional app/user FID.
- `WEBHOOK_URL` — optional webhook URL.

## Farcaster Mini App notes

Farcaster requires `/.well-known/farcaster.json` to be available at the root of the production domain.

If you change the production Cloudflare domain, regenerate/sign the Farcaster account association for the new domain. Do not manually edit the signed association payload because the signature must match the domain.

## Development

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).
