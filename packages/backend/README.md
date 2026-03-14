# DataDaddy — Backend

Next.js 16 API routes for the DataDaddy data leasing protocol. Handles credential verification, lease matching, certificate minting, and buyer content delivery.

## Stack

| | |
|--|--|
| Framework | Next.js 16 API routes |
| Database | Postgres via `pg` pool |
| Blockchain reads | Alchemy (`alchemy_getAssetTransfers`, `alchemy_getTokenBalances`, `eth_getBalance`) |
| Certificate minting | viem `WalletClient` (issuer EOA) |
| AI verification | OpenAI `gpt-4o` |
| ZK verification | In-memory proof parsing (Anon Aadhaar SerializedPCD) |

## Dev

```bash
pnpm dev    # Next.js dev server (http://localhost:3000)
pnpm build
pnpm lint
```

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
# Blockchain
ALCHEMY_RPC_SEPOLIA=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
ALCHEMY_API_KEY=YOUR_KEY

# Contracts
NEXT_PUBLIC_CERTIFICATE_REGISTRY_ADDRESS=0xBcF8f15E2c981663A08Db3878B994d65ddd84944
NEXT_PUBLIC_LEASE_MANAGER_ADDRESS=0x1dEcC3fBa8fbc2eb04394Ac5cC6A9497BF9E7a00
NEXT_PUBLIC_CHAIN_ID=84532

# AI
OPENAI_API_KEY=sk-

# Issuer wallet (server-only, never expose)
ISSUER_PRIVATE_KEY=0x

# Database
DATABASE_URL=postgresql://...
```

## API Routes

### Verification

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/verify/onchain` | Scan wallet via Alchemy → 5 on-chain attributes. UPSERT into DB. Mint cert per attribute. |
| POST | `/api/verify/document` | GPT-4o document scan → custom attribute. File in memory only, never persisted. |
| POST | `/api/verify/zk` | Parse Anon Aadhaar SerializedPCD → `age_range` + `state_of_residence`. UPSERT + mint. |
| GET | `/api/verify/status` | Return existing verified attributes for a wallet (loads persisted state on page mount). |

### Matching

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/match/requests` | SQL join: lease_requests × verification_verdicts filtered by address, confidence, active status, not already leased. Case-insensitive LOWER() comparisons. |

### Leases

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/lease/history` | User's full lease history with status, amounts, dates. |
| POST | `/api/lease/record` | Record an on-chain approved lease into DB. Called after `approveLease` tx confirms. |
| POST | `/api/lease/status` | Update a lease status (revoke or settle) in DB. |
| POST | `/api/lease/settle-expired` | Find all active expired leases, attempt on-chain `settleLease`, fall back to DB-only settle. |
| GET | `/api/lease/stats` | Summary stats for a wallet: active requests, pending matches, potential earnings. |
| GET | `/api/lease/notify` | New lease requests since last poll (15-second polling by frontend). |

### Buyer

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/buyer/requests` | Buyer's posted requests with approved_count. |
| POST | `/api/buyer/requests` | Record a new lease request in DB after on-chain `postRequest` confirms. |
| GET | `/api/buyer/leases` | All leases for buyer's requests (approved users). |

### Content Delivery

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/content/deliver` | Buyer-facing: returns verified wallet addresses grouped by request for active leases. |

## Database Schema

```sql
-- Stores all verification results (on-chain, ZK, AI document)
verification_verdicts (id, wallet_address, attribute_key, verified, confidence,
                       reasoning, method, zk_provider_key, certificate_token_id, fetched_at)
-- UNIQUE (wallet_address, attribute_key) — enforces UPSERT

-- Buyer-posted requests (mirrors on-chain LeaseRequest)
lease_requests (id, on_chain_id, buyer_address, attribute_key, min_confidence,
                ai_allowed, price_per_user, lease_duration_sec, expires_at, max_users,
                filled_count, active)

-- User-approved leases (mirrors on-chain Lease)
leases (id, on_chain_id, request_id, user_address, certificate_token_id,
        status, started_at, expires_at, paid_amount, settled_at, revoked_at)

-- Buyer content (for content delivery tab)
buyer_content (id, request_id, content_type, title, body, cta_label, cta_url, created_at)
```

## Lib Modules

| Module | Description |
|--------|-------------|
| `lib/db.ts` | pg pool configured via `DATABASE_URL` |
| `lib/blockchain/issuer.ts` | viem WalletClient for minting certificates on-chain |
| `lib/ai/verifier.ts` | GPT-4o verification with Zod schema validation, 0.99 confidence cap |
| `lib/zk/registry.ts` | ZK provider registry |
| `lib/zk/providers/anon-aadhaar.ts` | Anon Aadhaar SerializedPCD parser (claim.ageAbove18, claim.state) |

## Key Design Rules

- All DB writes use `ON CONFLICT ... DO UPDATE` (UPSERT) — never plain INSERT for verdicts
- All address comparisons use `LOWER()` on both sides — addresses may arrive in any case
- Documents are processed in-memory only, never written to disk or cloud storage
- ZK proofs verified in-memory and discarded — never stored
- AI confidence hard-capped at 0.99 — `1.0` reserved for on-chain/ZK tiers
- Certificate minting runs sequentially per attribute to avoid nonce collisions
