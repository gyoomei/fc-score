# FC Score

FC Score is a Farcaster Mini App for checking a user's reputation from their FID, Farcaster/Neynar social signals, and onchain activity on Base.

## Core features

- Check Farcaster reputation score by FID.
- Display Farcaster profile data when Neynar data is available.
- Analyze Base wallet activity such as transactions, unique contracts, 30-day activity, and protocol categories.
- Combine social and onchain signals into an easy-to-read reputation summary.
- Generate a share card/image for posting score results on Farcaster.

## How to use

1. Open the app from Farcaster Mini Apps.
2. Enter a FID or use the available Farcaster user context.
3. Connect a Base wallet to include onchain analysis.
4. Review the score, breakdown, tier, and reputation insights.
5. Share the result on Farcaster.

## Configuration

Environment variables used by the app:

- `NEYNAR_API_KEY` — fetches profile data and Farcaster signals from Neynar.
- `NEXT_PUBLIC_USER_FID` — optional default/app owner FID.
- `NEXT_PUBLIC_CLOUDFLARE_WORKERS_URL` — production domain without protocol.
- `WEBHOOK_URL` — optional Farcaster webhook URL.

## Farcaster Mini App

The manifest is available at:

```text
/.well-known/farcaster.json
```

If the production domain changes, the Farcaster account association must be regenerated/signed for the new domain. Do not manually edit the payload/signature because the signature must match the domain.

## Development

```bash
pnpm install
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).
