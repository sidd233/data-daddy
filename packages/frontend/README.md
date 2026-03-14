# DataDaddy — Frontend

Next.js 16 / React 19 client for the DataDaddy data leasing protocol.

## Stack

| | |
|--|--|
| Framework | Next.js 16 (App Router, Turbopack) |
| React | 19 |
| Wallet | wagmi v3 + RainbowKit v2 + viem |
| ZK | `@anon-aadhaar/react` v2 |
| UI | shadcn/ui + Tailwind CSS v4 |
| State | wagmi hooks + single `WalletContext` (no Redux/Zustand) |
| Chain | Base Sepolia (chainId `84532`) |

## Dev

```bash
pnpm dev       # Next.js dev server with Turbopack (http://localhost:3001)
pnpm build     # Production build
pnpm lint      # ESLint
pnpm format    # Prettier --write
pnpm typecheck # tsc --noEmit
```

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_CERTIFICATE_REGISTRY_ADDRESS=0xBcF8f15E2c981663A08Db3878B994d65ddd84944
NEXT_PUBLIC_LEASE_MANAGER_ADDRESS=0x1dEcC3fBa8fbc2eb04394Ac5cC6A9497BF9E7a00
NEXT_PUBLIC_CHAIN_ID=84532
```

## Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Dashboard — on-chain verification + matched lease requests |
| `/leases` | `app/leases/page.tsx` | Lease history (active / history tabs) with revoke/settle |
| `/verify` | `app/verify/page.tsx` | ZK verification (Anon Aadhaar) + AI document verification |
| `/buyer` | `app/buyer/page.tsx` | Post lease requests on-chain, approved users, data access |
| `/stats` | `app/stats/page.tsx` | Verified attributes, earnings, lease summary stats |

## Components

| Component | Description |
|-----------|-------------|
| `components/site-header.tsx` | Navigation bar with wallet address + connect button |
| `components/attribute-card.tsx` | Verified/unverified attribute display |
| `components/matched-request-row.tsx` | Matched lease request with Approve button |
| `components/lease-row.tsx` | Lease row with status badge and Revoke/Settle actions |
| `components/buyer-request-card.tsx` | Buyer's posted request with fill-rate progress |
| `components/request-form.tsx` | Form to post a new lease request |
| `components/ui/` | shadcn/ui primitives (Button, Card, Badge, Skeleton, etc.) |

## Provider Stack

```
WagmiProvider (Base Sepolia)
  └── QueryClientProvider
        └── RainbowKitProvider (dark theme, #00E5A0 accent)
              └── AnonAadhaarProvider (_useTestAadhaar=true)
                    └── WalletProvider (WalletContext)
```

## Contract Interaction

- Reads: `useReadContracts` (multicall for all 5 attribute token IDs in one call)
- Writes: always pair `useWriteContract` + `useWaitForTransactionReceipt`
- Events decoded with viem `decodeEventLog` (RequestPosted, LeaseApproved)
- Contract config: `lib/contracts.ts` — address + ABI for CertificateRegistry and LeaseManager

## Key Design Rules

- No Redux / Zustand — wagmi hooks + local state only
- `reactStrictMode: false` in `next.config.mjs` (intentional — prevents double-effect firing with ZK)
- Backend URL always via `NEXT_PUBLIC_BACKEND_URL` env var
- Skeleton loaders (`components/ui/skeleton`) on all async-loaded sections
- Polling for matched requests every 15 seconds (no WebSocket)
