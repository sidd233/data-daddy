# DataDaddy

**Verify your data. Mint proof. Lease it. Get paid.**

DataDaddy is a privacy-first, on-chain data leasing protocol built on Base Sepolia. Users prove ownership of credentials (on-chain activity, ZK identity proofs, AI-verified documents) and lease time-bounded access to those credentials to buyers via escrow-based smart contracts with revocable access.

## How it works

1. **Verify** — Users verify attributes about themselves via three tiers:
   - Tier 1 (on-chain, confidence 1.0): wallet activity scanned via Alchemy — `defi_user`, `asset_holder`, `active_wallet`, `long_term_holder`, `nft_holder`
   - Tier 2 (ZK, confidence 1.0): Anon Aadhaar zero-knowledge proof — `age_range`, `state_of_residence`
   - Tier 3 (AI document, confidence ≤0.99): GPT-4o scans an uploaded document for any custom attribute

2. **Mint** — Each verified attribute triggers minting of an ERC-5192 soulbound certificate on-chain (`CertificateRegistry`)

3. **Match** — Buyers post lease requests with attribute requirements and ETH escrow. Users with matching verified attributes see the requests on their dashboard.

4. **Lease** — Users approve matched requests on-chain (`approveLease`). ETH is held in escrow until the lease expires.

5. **Settle** — On expiry, `settleLease` releases ETH to the user. Permissionless — anyone can call it. Auto-settle runs on lease page load.

6. **Revoke** — Users can revoke any time, forfeiting their escrow payment.

## Monorepo Structure

```
data-daddy/
├── packages/
│   ├── frontend/          # Next.js 16 — user & buyer UI (port 3001)
│   ├── backend/           # Next.js 16 API routes — verification, matching, delivery (port 3000)
│   └── contracts/         # Solidity 0.8.28 — CertificateRegistry + LeaseManager (Hardhat)
├── docs/                  # Architecture, decisions, env vars, done log
└── CLAUDE.md              # AI code-gen instructions (authoritative)
```

## Quick Start

```bash
# Install all dependencies from repo root
pnpm install

# Terminal 1 — backend (port 3000)
cd packages/backend && pnpm dev

# Terminal 2 — frontend (port 3001)
cd packages/frontend && pnpm dev
```

Set up env vars in both `packages/frontend/.env.local` and `packages/backend/.env.local`. See [`docs/ENV_VARS.md`](docs/ENV_VARS.md).

## Pages

| Route | Description |
|-|-|
| `/` | Dashboard — verify wallet on-chain, see matched lease requests, approve |
| `/leases` | Lease history — active, settled, revoked; revoke/settle actions |
| `/verify` | ZK verification (Anon Aadhaar) + AI document verification |
| `/buyer` | Post lease requests on-chain, view approved users, access verified wallets |
| `/stats` | Personal stats — verified attributes, earnings breakdown, lease summary |

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|-|-|
| CertificateRegistry | `0xBcF8f15E2c981663A08Db3878B994d65ddd84944` |
| LeaseManager | `0x1dEcC3fBa8fbc2eb04394Ac5cC6A9497BF9E7a00` |
| AnonAadhaarZKVerifier | `0xA205f7DED9430ac03b7F0CD3eA1b22C54C1A1453` |
| MockAnonAadhaar | `0x68AACB01AaeD9cAC1D46aD248F35cBd2F554F7D0` |

Chain ID: `84532` (Base Sepolia)

## Docs

| File | Purpose |
|-|-|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full system design, API routes, data flow, trust boundaries |
| [`docs/CONTRACT_SPEC.md`](docs/CONTRACT_SPEC.md) | Contract ABIs, events, function signatures, test checklist |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Numbered architectural decision log (D-01 to D-27) |
| [`docs/ENV_VARS.md`](docs/ENV_VARS.md) | All environment variables with source and setup instructions |
| [`docs/DONE.md`](docs/DONE.md) | Completed feature log with commit references |



Hi, Rashul here I did a ton of work on this project from Sthita's laptop. Just want credit here thanks. 