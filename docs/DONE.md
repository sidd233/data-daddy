# DONE.md — DataDaddy

> **Purpose:** Log of completed, locked features.
> **Prevents:** Losing momentum and rebuilding work that's already done.
> **Update rule:** Add an entry the moment a feature is finished. One line minimum. Never remove an entry.
> **Lock rule:** A feature logged here is locked. No changes without a team vote and a new DECISIONS.md entry.

---

## How to Add an Entry

```
### F-XX — Feature Name
Date:    YYYY-MM-DD @ HH:MM
Owner:   @handle
Commit:  git commit hash or PR link

What was built:     One sentence.
What was tested:    What you verified before logging it here.
What is NOT built:  Any deliberate scope cuts or stubs.
Unlock condition:   What would justify re-opening this (almost nothing should).
```

---

## Completed Features

---

### F-01 — Monorepo & Project Scaffolding

```
Date:    2026-03-01 @ 14:00
Owner:   @all
Commit:  a3f9c12
```

**What was built:** pnpm workspaces monorepo with `packages/contracts` (Hardhat + OpenZeppelin), `packages/frontend` (Next.js 16, wagmi, RainbowKit, Tailwind, shadcn/ui, AnonAadhaar), `packages/backend` (Next.js 16 API routes, pg pool). `.env.example` populated with all required keys. Full docs suite in `docs/`.

**What was tested:** `pnpm install` from root succeeds. `npx hardhat compile` returns no errors. `pnpm dev` serves on localhost. All external accounts (Alchemy, OpenAI, Supabase, Vercel, Basescan) confirmed active.

**What is NOT built:** No contract deployments, no live env keys, no UI pages.

**Unlock condition:** Only if the monorepo structure fundamentally needs to change — requires team vote and new D-XX entry in DECISIONS.md.

---

### F-02 — Smart Contracts (CertificateRegistry + LeaseManager)

```
Date:    2026-03-12 @ 18:00
Owner:   @all
Commit:  ae110a1
```

**What was built:**
- `CertificateRegistry.sol` — ERC-5192 soulbound token. Full implementation: `mintCertificate`, `revokeCertificate`, `getCertificate`, `getTokenId`, `isValid`, `locked`, `addIssuer`, `removeIssuer`. `_update` override blocks all transfers. All events, modifiers, and revert messages per CONTRACT_SPEC.md.
- `LeaseManager.sol` — Pull-over-push escrow. Full implementation: `postRequest`, `approveLease` (10-step validation), `settleLease` (permissionless), `revokeLease`, `withdrawUnfilledEscrow`. AI cert detection via `aiIssuerAddress` comparison. All events and `nonReentrant` guards per spec.
- `ICertificateRegistry.sol` — Interface for cross-contract reads.
- `IZKVerifier.sol` — Interface for ZK provider contracts.
- `AnonAadhaarZKVerifier.sol` — On-chain ZK verifier wrapper for Anon Aadhaar.
- `MockAnonAadhaar.sol` — Mock ZK verifier for local/test use.
- `CertificateRegistry.t.sol`, `LeaseManager.t.sol`, `AnonAadhaarZKVerifierTest.t.sol` — Test suites.
- `deploy.ts` — Full deployment script (deploys all 4 contracts, wires `setCertificateRegistry`, `addIssuer`, `setAiIssuerAddress`).

**What was tested:** Contracts compile under Solidity 0.8.28. Deploy script executes sequentially with nonce management. Cross-contract wiring verified.

**What was tested:** All 166 Solidity tests passing (CertificateRegistry: 67, LeaseManager: 97, AnonAadhaarZKVerifier: 2). Deployed to Base Sepolia on 2026-03-14. Cross-contract wiring verified on-chain.

**Deployed addresses:**
- CertificateRegistry: `0xBcF8f15E2c981663A08Db3878B994d65ddd84944`
- LeaseManager: `0x1dEcC3fBa8fbc2eb04394Ac5cC6A9497BF9E7a00`
- AnonAadhaarZKVerifier: `0xA205f7DED9430ac03b7F0CD3eA1b22C54C1A1453`
- MockAnonAadhaar: `0x68AACB01AaeD9cAC1D46aD248F35cBd2F554F7D0`

**Unlock condition:** Deploy is a one-time irreversible action per D-02. No contract changes after deploy. Contracts are now locked.

---

### F-06 — Backend: verify/document + verify/zk + Certificate Minting

```
Date:    2026-03-14 @ 12:00
Owner:   @all
Commit:  current
```

**What was built:**
- `lib/blockchain/issuer.ts` — shared cert minting utility using viem `WalletClient`. Calls `mintCertificate` on-chain, waits for receipt, extracts `tokenId` from `CertificateMinted` event, stores back in DB.
- `lib/ai/verifier.ts` — GPT-4o document verification service. Includes system prompt, user prompt template, JSON schema validation via zod, anomaly penalty, 0.99 hard cap, retry logic, timeout handling.
- `lib/zk/providers/anon-aadhaar.ts` — Parses serialized AnonAadhaar PCD, extracts `age_range` and `state_of_residence` attributes.
- `lib/zk/registry.ts` — Provider registry, returns provider by key.
- `verify/document/route.ts` — POST multipart. Reads file into memory only, calls AI verifier, stores verdict, mints cert if verified.
- `verify/zk/route.ts` — POST JSON. Parses PCD proof, extracts attributes, stores verdicts, mints cert per attribute.

**What was tested:** Both routes build clean. `verify/zk` smoke tested — 2 attributes extracted and 2 certs minted on-chain in one call. `verify/document` tested with blank image returns `verified: false` correctly.

**What is NOT built:** Server-side cryptographic ZK proof verification (skipped for demo — client-side proof generation is the trust anchor).

**Unlock condition:** AI prompt locked per D-10/D-11. No changes to confidence cap or post-processing without D-XX entry.

---

### F-03 — Frontend Provider Stack

```
Date:    2026-03-12 @ 18:00
Owner:   @all
Commit:  ae110a1
```

**What was built:** `packages/frontend/app/providers.tsx` — Full provider stack: `WagmiProvider` (Base Sepolia, WalletConnect projectId) → `QueryClientProvider` → `RainbowKitProvider` (dark theme, `#00E5A0` accent) → `AnonAadhaarProvider` (test mode, local WASM artifacts). `ConnectButton` and `LogInWithAnonAadhaar` rendered on landing page. Full shadcn/ui component library installed.

**What was tested:** Wallet connect works. AnonAadhaar SDK loads without SSR errors (dynamic import). Tailwind and dark theme apply correctly.

**What is NOT built:** No WalletContext. No pages beyond the landing stub. No contract reads wired up.

**Unlock condition:** Provider stack changes require D-XX entry — it is the app's trust root.

---

### F-04 — Backend: On-Chain Attribute Verification

```
Date:    2026-03-12 @ 18:00
Owner:   @all
Commit:  ae110a1
```

**What was built:** `packages/backend/src/app/api/verify/onchain/route.ts` — GET endpoint. Validates address format. Makes 5 parallel Alchemy calls (`alchemy_getAssetTransfers` × 4, `alchemy_getTokenBalances` × 1). Deterministically evaluates all 5 Tier-1 attributes: `defi_user` (≥3 DeFi interactions), `asset_holder` (non-zero ERC-20 balance), `active_wallet` (tx in last 180 days), `long_term_holder` (tx > 365 days ago), `nft_holder` (ERC-721 transfer exists). All confidence = 1.0. Inserts verdicts into `verification_verdicts` table. Returns `Attribute[]`.

**What was tested:** Attribute logic is deterministic. DB insert pattern confirmed working against live Postgres.

**What is NOT built:** Demo wallet cache (calls Alchemy live for all addresses). No certificate minting after verification.

**Unlock condition:** Logic is deterministic per D-10; no changes to attribute thresholds without a D-XX entry.

---

### F-05 — Backend: Matching, Stats, Content Delivery (partial)

```
Date:    2026-03-12 @ 18:00
Owner:   @all
Commit:  ae110a1
```

**What was built:**
- `match/requests/route.ts` — Basic SQL join of `lease_requests × verification_verdicts` filtered by `wallet_address`, `verified = TRUE`, `confidence >= min_confidence`, `active = TRUE`, `filled_count < max_users`.
- `lease/stats/route.ts` — User-facing stats: count of active matching requests + potential earnings sum for a wallet's verified attributes.
- `content/deliver/route.ts` — Returns `buyer_content` rows for requests matching user's verified attributes.
- `packages/backend/src/lib/db.ts` — pg pool configured via `DATABASE_URL`.

**What was tested:** Routes return correct SQL results against test data.

**What was tested:** Backend builds clean. All 7 routes registered and serving.

**What is NOT built:** `lease/stats` does not apply Laplace DP noise (spec requirement for buyer-facing stats). `content/deliver` does not gate on active lease status.

**Unlock condition:** SQL schema must remain stable; changes require confirming DB migration.

---
