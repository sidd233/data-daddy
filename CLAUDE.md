# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DataDaddy** — A privacy-first, on-chain data leasing protocol on Base Sepolia. Users prove ownership of credentials (on-chain activity, ZK identity proofs) and lease access to those credentials to buyers via escrow-based smart contracts with revocable access.

## Monorepo Structure

pnpm workspaces with three packages:

- `packages/frontend/` — Next.js 16 / React 19 client (RainbowKit + Anon Aadhaar)
- `packages/backend/` — Next.js 16 API routes (credential verification, matching, content delivery)
- `packages/contracts/` — Solidity 0.8.28 smart contracts (Hardhat)

## Commands

```bash
# From repo root
pnpm install

# Frontend
cd packages/frontend
pnpm dev          # Next.js dev server with Turbopack
pnpm build
pnpm lint
pnpm format       # prettier --write
pnpm typecheck    # tsc --noEmit

# Backend
cd packages/backend
pnpm dev
pnpm build
pnpm lint

# Contracts
cd packages/contracts
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.ts --network baseSepolia
```

## Architecture

### Smart Contracts (authoritative: `docs/CONTRACT_SPEC.md`)

**Two immutable contracts only — never add a third:**
- `CertificateRegistry.sol` — ERC-721 soulbound token (ERC-5192). Stores credential proofs on-chain: `attributeKey` (keccak256 hash), `confidenceLevel` (0–100), issuer. Attribute values are **never stored on-chain**.
- `LeaseManager.sol` — Pull-over-push escrow. States: `Funded → Active → Settled/Revoked/Cancelled`. ETH held until expiry or revocation. Uses `call{value}()` (never `transfer()`). `settleLease()` is permissionless.

Chain: **Base Sepolia** (chainId: 84532). Payment: native ETH (demo).

### Backend API Routes (`packages/backend/src/app/api/`)

| Route | Purpose |
|-------|---------|
| `verify/onchain` | Deterministic Alchemy queries → 5 on-chain attributes |
| `verify/document` | GPT-4o document verification (confidence capped at 0.99) |
| `verify/zk` | Anon Aadhaar ZK proof verification (in-memory only) |
| `match/requests` | SQL join of `lease_requests` × `verification_verdicts` |
| `lease/stats` | Aggregate stats with Laplace differential privacy (ε=1.0) |
| `lease/notify` | Polling endpoint — no WebSocket, clients poll every 15s |
| `lease/history` | User's lease history |
| `content/deliver` | Buyer content for active leases |

**Attribute tiers:**
- Tier 1 (on-chain, confidence 1.0): `defi_user`, `asset_holder`, `active_wallet`, `long_term_holder`, `nft_holder`
- Tier 2 (ZK, confidence 1.0): `age_range`, `state_of_residence`
- Tier 3 (AI doc, confidence ≤0.99): arbitrary claims

Database: Postgres via `pg` pool (`packages/backend/src/lib/db.ts`). Tables: `verification_verdicts`, `lease_requests`, `leases`, `buyer_content`.

### Frontend (`packages/frontend/app/`)

**Provider stack** (`providers.tsx`): `WagmiProvider` → `QueryClientProvider` → `RainbowKitProvider` → `AnonAadhaarProvider`

**State management:** Single `WalletContext` from wagmi `useAccount()`. No Redux/Zustand. wagmi hooks at page level, data passed as props. React Query for API caching.

**Contract reads:** `useReadContract` with multicall pattern. **Contract writes:** always pair `useWriteContract` with `useWaitForTransactionReceipt`.

UI components: shadcn/ui in `components/ui/`. Styling: Tailwind CSS. Dark mode via `next-themes`. Wallet accent color: `#00E5A0`.

## Key Design Decisions (from `docs/DECISIONS.md`)

- **No WebSockets** — polling every 15 seconds
- **No Redux/Zustand** — wagmi state only
- **Differential privacy** on all aggregate stats (Laplace noise, ε=1.0)
- **ZK proofs verified in-memory** and immediately discarded (never stored)
- **Raw documents discarded immediately** after AI verification
- Demo wallet address has a cached Alchemy response (bypasses live calls)
- `reactStrictMode: false` in frontend next.config.mjs (intentional)

## Documentation

The `docs/` directory is authoritative for architecture decisions and should be kept in sync with implementation:

- `docs/ARCHITECTURE.md` — Full system design and data flow
- `docs/CONTRACT_SPEC.md` — Contract ABIs, function signatures, events
- `docs/DECISIONS.md` — Numbered decision log (D-01 to D-24)
- `docs/ENV_VARS.md` — All environment variables with descriptions
