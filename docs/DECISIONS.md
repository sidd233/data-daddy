# DECISIONS.md — DataDaddy

> **Purpose:** Date-stamped architectural decisions with reasoning.
> **Prevents:** Repeating old debates. If a decision is here, it is closed.
> **Update rule:** Add a new entry immediately after any major decision. Never edit a past entry — append a superseding one if a decision changes.
> **Format:** Each entry has a status. `CLOSED` = not up for debate. `SUPERSEDED` = replaced by a later entry.

---

## Decision Index

| ID | Decision | Status | Date |
|----|----------|--------|------|
| D-01 | Chain: Base Sepolia / Base mainnet | CLOSED | 2026-03-01 |
| D-02 | No upgradeable proxy contracts | CLOSED | 2026-03-01 |
| D-03 | Two contracts only — no additional contracts | CLOSED | 2026-03-01 |
| D-04 | Payment token: native ETH for demo | CLOSED | 2026-03-01 |
| D-05 | Pull-over-push escrow pattern | CLOSED | 2026-03-01 |
| D-06 | Early revocation forfeits full balance | CLOSED | 2026-03-01 |
| D-07 | SBT standard: ERC-5192 | CLOSED | 2026-03-01 |
| D-08 | AttributeKey stored as bytes32 keccak256 hash | CLOSED | 2026-03-01 |
| D-09 | No attribute value stored on-chain | CLOSED | 2026-03-01 |
| D-10 | AI is fallback only — requires explicit buyer opt-in | CLOSED | 2026-03-01 |
| D-11 | AI confidence hard-capped at 0.99 | CLOSED | 2026-03-01 |
| D-12 | Documents processed in-memory, never persisted | CLOSED | 2026-03-01 |
| D-13 | ZK layer is modular via IZKProvider interface | CLOSED | 2026-03-01 |
| D-14 | Anon Aadhaar as first ZK provider | CLOSED | 2026-03-01 |
| D-15 | Differential privacy on all buyer-facing stats | CLOSED | 2026-03-01 |
| D-16 | Buyers receive aggregate stats + content delivery — not raw identity | CLOSED | 2026-03-01 |
| D-17 | No Redux / Zustand — single WalletContext only | CLOSED | 2026-03-01 |
| D-18 | Notification via polling — no WebSocket | CLOSED | 2026-03-01 |
| D-19 | settleLease is permissionless — anyone can call after expiry | CLOSED | 2026-03-01 |
| D-20 | Backend is Next.js API routes — no separate microservices | CLOSED | 2026-03-01 |
| D-21 | No platform fee in demo | CLOSED | 2026-03-01 |
| D-22 | Issuer wallet is EOA for demo | CLOSED | 2026-03-01 |
| D-23 | Demo caches Alchemy data and AI verdicts — no live calls | CLOSED | 2026-03-01 |
| D-24 | Leasing model — not data selling | CLOSED | 2026-03-01 |

---

## D-01 — Chain: Base Sepolia (testnet) / Base mainnet (production)

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** Deploy to Base Sepolia for the demo. Base mainnet is the production target.

**Options considered:**
- Ethereum Sepolia — rejected: gas costs too high for frequent cert mints and lease ops during judging
- Polygon Mumbai — rejected: weaker EVM tooling, no Base hackathon bounty
- Base Sepolia — selected

**Reasoning:**
- Gas per tx is sub-cent on Base. Certificate minting and lease approval need to be instant and cheap during the demo
- Full EVM equivalence — all OpenZeppelin contracts, wagmi configs, and viem integrations work without modification
- Base bounty at ETHMumbai is a direct judging incentive
- Native USDC on Base mainnet for the production payment path (ERC-20 upgrade)
- Coinbase ecosystem tooling (Basescan, Coinbase Wallet) works natively

**Consequences:** All contract addresses, RPC endpoints, and chain IDs in config must target Base Sepolia (`84532`). Mainnet (`8453`) referenced in comments only. No other chain is supported.

---

## D-02 — No Upgradeable Proxy Contracts

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** Deploy immutable contracts. No transparent proxy, no UUPS, no Beacon proxy.

**Options considered:**
- Transparent proxy (OpenZeppelin) — rejected
- UUPS proxy — rejected
- Immutable deploy — selected

**Reasoning:**
- Proxy patterns add significant attack surface: delegatecall bugs, storage collision, admin key risk
- For a purpose-limited hackathon contract, immutability is more auditable and more trustworthy to judges
- Our contracts are narrow in scope — `CertificateRegistry` mints and revokes SBTs; `LeaseManager` handles escrow. Neither needs logic changes post-deploy
- If logic changes are needed post-launch, the correct path is deploy new contracts + versioned registry migration. This is documented in ARCHITECTURE.md as the production upgrade path

**Consequences:** Contracts locked after Day 2 deploy. Any bug found after lock is a new deployment, not a patch. This is acceptable for demo scope.

---

## D-03 — Two Contracts Only

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** Exactly two contracts — `CertificateRegistry.sol` and `LeaseManager.sol`. No additional contracts for the demo.

**Options considered:**
- Separate escrow contract — rejected: unnecessary indirection
- Fee collector contract — rejected: no platform fee in demo (see D-21)
- Oracle contract for settlement — rejected: cron job is sufficient for demo (see D-19)
- Two contracts — selected

**Reasoning:**
- Every additional contract is another deploy, another address to manage, another attack surface, and another thing that can break during the demo
- Separation of concerns is already clean: registry handles identity proofs, lease manager handles economics
- `LeaseManager` holds a reference to `CertificateRegistry` address — cross-contract reads are sufficient

**Consequences:** Any feature that would require a third contract is out of scope for the demo.

---

## D-04 — Payment Token: Native ETH for Demo

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** Use native ETH for all escrow and payments in the demo. Production path is ERC-20 USDC on Base.

**Options considered:**
- USDC (ERC-20) — considered but deferred to production
- Custom ERC-20 test token — rejected: adds deploy complexity with no demo benefit
- Native ETH — selected

**Reasoning:**
- Native ETH requires no `approve()` step — one fewer tx in the demo flow, one fewer failure point
- Base Sepolia ETH is free from faucets — no dependency on getting test USDC
- Production upgrade path is well-defined: add `tokenAddress` to `LeaseRequest`, replace `msg.value` with `IERC20.transferFrom`. Contract logic is otherwise identical
- Judges understand ETH. Explaining a custom token adds cognitive overhead

**Consequences:** `postRequest` uses `msg.value`. All amounts are in wei. Production ERC-20 path is documented but not built.

---

## D-05 — Pull-Over-Push Escrow Pattern

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** Use pull-over-push escrow. Payments are held in the contract and released via an explicit `settleLease` call. Funds are never pushed automatically.

**Options considered:**
- Push on approval (transfer ETH immediately when user approves) — rejected
- Streaming payment (vesting per second) — rejected: complex, out of scope
- Pull-over-push with explicit settlement — selected

**Reasoning:**
- Push-on-approval creates re-entrancy risk at the point of maximum vulnerability (the approval transaction also validates certificates and updates state)
- Pull pattern separates payment release from state transition — `settleLease` is a simple transfer after all validation is complete
- Pull pattern is the standard safe escrow pattern (see Solidity-by-Example)
- Full payment held in escrow until expiry creates a meaningful economic commitment from users — they can't revoke for free (see D-06)

**Consequences:** Users do not receive ETH until they call `settleLease` (or it is called for them by a cron/keeper). UX must communicate "payment locked until expiry" clearly.

---

## D-06 — Early Revocation Forfeits Full Balance

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** If a user revokes an active lease before expiry, they forfeit 100% of the escrowed payment. No partial refund.

**Options considered:**
- Pro-rata refund (user gets back unused time) — rejected
- Penalty fee + partial refund — rejected: complex calculation, on-chain division risk
- Full forfeiture — selected

**Reasoning:**
- The value of a verified lease to a buyer is the guarantee that the user committed for the full duration. A free revocation option destroys that guarantee entirely
- Pro-rata refund weakens the commitment — a user could revoke at 99% of the lease duration and recover most of their payment, giving buyers almost no protection
- Full forfeiture is the simplest on-chain implementation and the strongest economic signal
- Users see the forfeiture warning before approving — informed consent is explicit (see DEMO_SCRIPT.md F-15)
- The financial consequence is the privacy protection mechanism: users won't casually approve leases they plan to revoke

**Consequences:** `revokeLease` sets `paidAmount` to forfeited — funds remain in contract (claimable by protocol treasury in production). UX must show forfeiture warning before the revoke tx is signed.

---

## D-07 — SBT Standard: ERC-5192

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** Implement certificates as ERC-5192 Soulbound Tokens (minimal SBT standard extending ERC-721).

**Options considered:**
- Custom non-transferable NFT (no standard) — rejected: non-standard, harder to audit
- ERC-4973 (Account-bound tokens) — considered: less tooling support
- ERC-5192 — selected

**Reasoning:**
- ERC-5192 is the minimal SBT standard — just adds `locked()` returning `true` to ERC-721
- Extends ERC-721 so all existing OpenZeppelin tooling, Hardhat plugins, and explorers work natively
- `locked()` is the explicit signal to any tool or contract that this token cannot move
- Basescan and most explorers already understand ERC-721 — certificates will be visible and inspectable without custom tooling

**Consequences:** `transferFrom` and `safeTransferFrom` must be overridden to always revert. `locked()` must always return `true` with no exceptions.

---

## D-08 — AttributeKey Stored as bytes32 keccak256 Hash

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** All attribute keys are stored and compared on-chain as `bytes32` values — the `keccak256` hash of the canonical attribute name string (e.g. `keccak256("defi_user")`).

**Options considered:**
- Store as `string` — rejected: high gas cost, complex on-chain string comparison, variable length
- Store as `uint8` enum — rejected: rigid, requires contract change to add new attributes
- Store as `bytes32` keccak256 — selected

**Reasoning:**
- `bytes32` is fixed-size, fits in a single EVM storage slot — minimal gas cost
- keccak256 of a string is deterministic and collision-resistant — safe for equality checks
- New attributes can be added without any contract change — just hash a new string
- Human-readable names are preserved off-chain in Postgres and in the TypeScript `ATTRIBUTE_KEYS` constant

**Consequences:** Frontend and backend must always hash attribute names before passing them to contracts. Hash equality between TypeScript (`keccak256(toHex("defi_user"))`) and Solidity (`keccak256("defi_user")`) must be verified in a unit test before any integration. See CONTRACT_SPEC.md Section 4.

---

## D-09 — No Attribute Value Stored On-Chain

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** On-chain certificates store only the attribute category (`attributeKey`) and confidence level. The actual claimed value (e.g. `"22-28"` for age range) is stored in Postgres only, linked by `tokenId`.

**Options considered:**
- Store claimed value on-chain as string — rejected: gas cost, privacy violation
- Store value as encrypted bytes on-chain — rejected: key management complexity, no real privacy gain
- Store only category and confidence on-chain; value in Postgres — selected

**Reasoning:**
- A public blockchain is a permanent, globally readable ledger. Storing `"22-28"` on-chain means anyone can link a wallet to an age range forever — this breaks the privacy model entirely
- Buyers don't need the raw value — they need to know the attribute was verified at a given confidence. The category and confidence level are sufficient for matching
- Postgres storage for values is deleted when a certificate is revoked — on-chain records cannot be deleted
- On-chain observer learns: "wallet `0xABC` has a verified `age_range` attribute at confidence 91." They do not learn the actual range

**Consequences:** Any feature that needs the actual attribute value (e.g. matching on specific age range) must read from Postgres via the backend. The on-chain record is sufficient for lease validation but not for value-level filtering.

---

## D-10 — AI Is Fallback Only — Requires Explicit Buyer Opt-In

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** The AI document scanning tier (Tier 3) activates only when: (a) no ZK provider exists for the attribute, AND (b) the buyer has explicitly set `aiAllowed: true` in their lease request, AND (c) the buyer has set a minimum confidence threshold.

**Options considered:**
- AI as default verification with ZK as optional upgrade — rejected
- AI as co-equal tier alongside ZK — rejected
- AI as explicit opt-in fallback only — selected

**Reasoning:**
- AI confidence scoring is probabilistic, not cryptographic. Treating it as equivalent to ZK proofs or on-chain data would misrepresent the trust model to buyers
- Buyers paying for verified data have a right to know and control what verification method was used
- The economic model depends on confidence tiers — AI-tier certs command lower lease prices (see ARCHITECTURE.md Section 13). Conflating tiers breaks pricing alignment
- Making buyers opt in means any AI-tier match is a fully informed transaction — no buyer can claim they didn't know

**Consequences:** `approveLease` in `LeaseManager` must check `request.aiAllowed == true` before allowing an AI-derived certificate to fill a request. This check is enforced at the contract level — it cannot be bypassed by the backend.

---

## D-11 — AI Confidence Hard-Capped at 0.99

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** AI-derived confidence scores are hard-capped at `0.99` after all post-processing. The AI model can never produce a confidence of `1.0`.

**Options considered:**
- Allow `1.0` if AI is very confident — rejected
- Cap at `0.95` — considered but arbitrary
- Cap at `0.99` — selected

**Reasoning:**
- `1.0` confidence is reserved for cryptographically provable claims: on-chain attributes (Tier 1) and valid ZK proofs (Tier 2). AI scoring is probabilistic by nature — it should never signal the same certainty as a ZK proof
- Prompt injection attacks could attempt to return `"confidence": 1.0` — the hard cap neutralises this regardless of what the model outputs
- `0.99` is clearly distinguishable from `1.0` in the UI, making the tier difference visible to buyers

**Consequences:** All AI verdict processing in `lib/ai/verifier.ts` must apply `Math.min(parsed.confidence, 0.99)` as a non-negotiable step. Schema validation must also reject any value ≥ 1.0 from the model.

---

## D-12 — Documents Processed In-Memory, Never Persisted

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** Uploaded documents are processed entirely in server memory and garbage-collected at the end of the request. They are never written to disk, database, or any cloud storage service.

**Options considered:**
- Store documents in S3 / Supabase storage for audit trail — rejected
- Store encrypted documents temporarily — rejected: key management, still a data liability
- In-memory only — selected

**Reasoning:**
- Storing documents creates a persistent data liability. A database breach would expose government-issued ID for every user who used Tier 3 verification
- The AI verdict (verified/confidence/reasoning) is sufficient for all downstream use — the raw document adds no value after verification is complete
- In-memory processing means there is nothing to breach, nothing to subpoena, and nothing to accidentally expose
- OpenAI retains API inputs per their default data retention policy (30 days). This is a disclosed residual risk — mitigated in production by using OpenAI's Zero Data Retention API tier

**Consequences:** `POST /api/verify/document` must never call `writeFile`, `createWriteStream`, or any storage SDK. Code review must check this explicitly. Buffer lives in `req` scope only.

---

## D-13 — ZK Layer Is Modular via IZKProvider Interface

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** All ZK providers must conform to the `IZKProvider` TypeScript interface (backend) and `IZKVerifier` Solidity interface (on-chain). No ZK provider logic is hardcoded into the verification path.

**Options considered:**
- Hardcode Anon Aadhaar directly into the verification route — rejected: brittle, not extendable
- Abstract interface with pluggable providers — selected

**Reasoning:**
- The hackathon judges will ask about extensibility. Demonstrating that a second provider (Gitcoin Passport, Worldcoin) is a 5-step addition without touching the core contracts is a strong architectural story
- The `IZKProvider` interface enforces that all providers: verify proofs consistently, return a standardised `ZKVerificationResult`, track nullifiers, and expose supported attributes
- Core contracts (`CertificateRegistry`, `LeaseManager`) never reference a specific ZK provider — they only check that the certificate exists and is valid

**Consequences:** `lib/zk/registry.ts` is the single source of truth for registered providers. Any provider not in the registry returns a `400` from `/api/verify/zk`. Adding a provider requires zero changes to contracts or the matching engine.

---

## D-14 — Anon Aadhaar as First ZK Provider

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** Anon Aadhaar is the reference ZK provider for the demo. It is the first and only fully-integrated ZK provider at launch.

**Options considered:**
- Worldcoin — rejected: requires iris scan hardware, not practical for demo
- Gitcoin Passport — considered: good fit, but Anon Aadhaar is India-specific and more relevant for ETHMumbai
- Anon Aadhaar — selected

**Reasoning:**
- ETHMumbai audience: most judges and attendees will have Aadhaar cards — the demo is immediately relatable
- Anon Aadhaar is production-ready open source (Privacy Scaling Explorations / PSE) with an existing React SDK and published verifier contract
- Proves government-verified age range and state of residence — the two most valuable demographic attributes for Indian advertisers and Web3 buyers
- The PSE team has documented the integration thoroughly — integration risk is low
- Aligns with the hackathon's India-first context

**Consequences:** The Anon Aadhaar React SDK component must be tested on the demo laptop specifically before demo day (not just the dev machine). Proof generation is CPU-intensive — confirm it completes within demo timing on demo hardware.

---

## D-15 — Differential Privacy on All Buyer-Facing Stats

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** All aggregate statistics returned to buyers via `/api/lease/stats` have Laplace mechanism differential privacy noise applied. Epsilon is set to `1.0` and disclosed in the response.

**Options considered:**
- No noise — raw aggregates — rejected: small cohorts can be reverse-engineered to individuals
- Suppression (hide stats for cohorts < N) — considered: simpler but coarser
- Laplace mechanism DP noise — selected

**Reasoning:**
- Without noise, a buyer with a cohort of 3 users and two known values could identify the third — this breaks the privacy model
- Laplace mechanism is the canonical DP approach for numeric queries — well-understood, straightforward to implement
- Epsilon = 1.0 is the standard starting point in the DP literature — provides meaningful privacy without making stats useless for realistic cohort sizes (≥ 5 users)
- Disclosing epsilon in the API response is a transparency signal — buyers know exactly what privacy guarantee was applied and can factor it into their decisions

**Consequences:** Stats are computed on-demand and never cached. The `privacyBudgetUsed` field is mandatory in every stats response — removing it is a privacy model violation, not a cosmetic choice.

---

## D-16 — Buyers Receive Aggregate Stats + Content Delivery — Not Raw Identity

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** Buyers receive two things and only two things: (1) DP-noised aggregate statistics about the matched segment, and (2) the ability to deliver content to matched users via the DataDaddy dashboard. They never receive any individual-level data.

**Options considered:**
- Give buyers individual pseudonymous records — rejected: pseudonymous is not anonymous, re-identification risk
- Give buyers raw wallet addresses — rejected: immediately linkable to on-chain identity
- Aggregate stats + content delivery pipeline only — selected

**Reasoning:**
- The fundamental value proposition of DataDaddy is that user identity is never transferred. If buyers received individual records — even pseudonymous ones — the entire privacy model collapses
- Aggregate stats are sufficient for buyers to evaluate audience quality and ROI
- Content delivery solves the buyer's actual problem (reaching a verified audience) without requiring identity transfer
- This framing also removes legal and regulatory risk around personal data transfer — DataDaddy is not a data broker, it is an audience platform

**Consequences:** No API route in the system returns a wallet address, name, or any identifier to a buyer. This is enforced architecturally — buyer-facing routes only call the stats aggregator and content delivery functions. Code review must verify no buyer route touches `verification_verdicts` directly.

---

## D-17 — No Redux / Zustand — Single WalletContext Only

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** No external state management library. A single `WalletContext` provides the connected wallet address. All other state is local component state or wagmi cache.

**Options considered:**
- Redux Toolkit — rejected: severe overkill for a 12-day build
- Zustand — considered: lightweight, but still adds a dependency and a learning curve for any new contributor
- Jotai / Recoil — rejected: same reasoning as Zustand
- React context for wallet only, everything else local + wagmi — selected

**Reasoning:**
- wagmi already provides caching and reactivity for all on-chain reads — duplicating that in a state store creates sync bugs
- The only truly global state in this app is "which wallet is connected" — everything else is local to a page or component
- Fewer dependencies = fewer things that can break during a 12-day sprint
- The team can onboard any contributor to the state model in 30 seconds: "one context, everything else is wagmi hooks"

**Consequences:** wagmi's `useReadContract` and `useReadContracts` are the data layer for all on-chain state. Backend API data is fetched with standard `fetch` or SWR inside components. No global store for API responses.

---

## D-18 — Notification Delivery via Polling — No WebSocket

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** Frontend polls `/api/lease/notify` every 15 seconds to detect new matching lease requests. No WebSocket, no SSE.

**Options considered:**
- WebSocket — rejected: requires persistent connection, complex to manage in Next.js API routes
- Server-Sent Events (SSE) — considered: simpler than WebSocket but still stateful
- 15-second polling — selected

**Reasoning:**
- For a 12-day build, a polling interval of 15 seconds is imperceptible to users and requires zero infrastructure beyond a standard GET route
- Vercel serverless functions do not support persistent connections — WebSocket would require a separate deployment (e.g. Pusher, Ably, or a dedicated server)
- The demo flow pre-stages the lease request — precise real-time delivery is not required for judging
- WebSocket / SSE is the documented production upgrade path and can be presented as such to judges

**Consequences:** The 15-second polling interval is a constant defined in one place — easy to adjust or replace. Polling stops when the wallet disconnects.

---

## D-19 — settleLease Is Permissionless — Anyone Can Call After Expiry

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** `settleLease` can be called by anyone after the lease expires, not just the user or DataDaddy.

**Options considered:**
- Only the user can call `settleLease` — rejected: user may forget, or lose their key
- Only DataDaddy backend can call `settleLease` — rejected: centralised control over payment release is a trust risk
- Permissionless (anyone can call after expiry) — selected

**Reasoning:**
- Permissionless settlement means users don't need to remember to claim — a cron job, a keeper, or even a public good actor can trigger it
- It removes any ability for DataDaddy to hold payments hostage by simply not calling settlement
- The validation inside `settleLease` is strict: `status == Active` AND `block.timestamp >= expiresAt` AND ETH transferred to `lease.user`. There is no way for a malicious caller to redirect the payment
- This is the standard pattern for on-chain payment rails — Uniswap, Compound, and most DeFi protocols use permissionless settlement

**Consequences:** Demo uses a Vercel cron job to call `settleLease` for expired leases. Production uses Chainlink Automation. Neither is required for security — they're conveniences.

---

## D-20 — Backend Is Next.js API Routes — No Separate Microservices

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** All backend logic lives in Next.js API routes in the same repo as the frontend. No separate Express server, no separate microservice deployment.

**Options considered:**
- Separate Express/Fastify backend — rejected: doubles deployment complexity, adds CORS config
- Serverless functions on separate service (AWS Lambda) — rejected: two deployment pipelines
- Next.js API routes — selected

**Reasoning:**
- One Vercel deployment covers both frontend and backend — one URL, one config, one set of env vars
- API routes share the same TypeScript types as the frontend — no separate type sync required
- For a 12-day build, the marginal gain from microservices is zero. The marginal risk from added complexity is high
- MasterDoc explicitly notes: "For production hardening, these routes should be extracted into independent microservices" — this is the acknowledged upgrade path

**Consequences:** All routes live under `packages/web/src/app/api/`. Shared logic (Alchemy calls, AI verification, ZK verification, stats aggregation) lives in `packages/web/src/lib/`. No API key is ever exposed client-side.

---

## D-21 — No Platform Fee in Demo

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** The demo contracts collect zero platform fees. 100% of the escrowed amount goes to the user on settlement (or is forfeited on revocation). Production path is a 5% protocol fee deducted at settlement.

**Options considered:**
- Build fee collection into demo contracts — rejected: adds a fee recipient address, treasury management, and a separate withdrawal function — all for 0 demo value
- No fee in demo — selected

**Reasoning:**
- Fee collection adds contract complexity with no judging benefit — judges are evaluating the leasing mechanism, not the fee model
- A fee recipient address in the contract means another key to manage during the demo
- Documenting the 5% production fee as a design decision is sufficient to demonstrate the business model

**Consequences:** `settleLease` transfers `lease.paidAmount` to `lease.user` in full, with no deduction. Production upgrade: add `uint256 protocolFeeBps = 500` (500 bps = 5%), deduct at settlement, transfer to `feeRecipient` address.

---

## D-22 — Issuer Wallet Is EOA for Demo

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** The certificate issuer wallet is a standard externally-owned account (EOA) with the private key stored in `ISSUER_PRIVATE_KEY` environment variable. This is acceptable for the demo only.

**Options considered:**
- Gnosis Safe multisig (4/7) — preferred for production, not practical for 12-day demo setup
- BitGo MPC wallet — optimal for production, significant setup overhead
- EOA — selected for demo

**Reasoning:**
- A multisig requires coordinating multiple signers for every certificate mint — not feasible in a demo where the backend is minting certs in real-time
- The EOA is sufficient to demonstrate the issuer access control model on-chain (`onlyIssuer` modifier)
- The production upgrade path is a drop-in backend change — the contracts are agnostic to how the issuer signature is produced. Switching from EOA to Gnosis Safe to BitGo MPC requires no contract redeployment

**Consequences:** `ISSUER_PRIVATE_KEY` must be stored in `.env.local` only — never committed to the repo, never exposed in client-side code, never logged. If this key is compromised, any address can be added as an issuer and fraudulent certs can be minted. Rotate immediately if exposed.

---

## D-23 — Demo Caches Alchemy Data and AI Verdicts

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** For the demo wallet address, on-chain attribute data is served from a pre-cached JSON file. AI verification verdicts for the demo document are pre-cached. Neither Alchemy nor the AI provider is called live during the demo.

**Options considered:**
- Call Alchemy live during demo — rejected: venue WiFi is unreliable, rate limits are possible, latency is unpredictable
- Call AI live during demo — rejected: AI inference latency can exceed 10 seconds, toxic for a 2-minute demo
- Pre-cache both — selected

**Reasoning:**
- The demo has a 2-minute window. A 5-second Alchemy timeout or a 10-second AI call would consume 10–20% of the entire demo time
- Caching does not misrepresent the system — the cache is a snapshot of real data from a real wallet. Judges can verify the wallet on Basescan
- The cache pattern is a production-grade technique (CDN edge caching) not a hack

**Consequences:** `demo-wallet-cache.json` must be refreshed before the demo if the demo wallet has made new transactions. The cache check must be a pre-condition check on wallet address, not a global flag — other wallets continue to call Alchemy live.

---

## D-24 — Leasing Model — Not Data Selling

```
Date:     2026-03-01 @ 14:00
Location: Reading Room
Status:   CLOSED
Decided by: Full team
```

**Decision:** DataDaddy is a data leasing platform. Users lease time-bounded proofs of their attributes. They never sell their data. The underlying attribute always remains with the user.

**Options considered:**
- Permanent data sale model — rejected: irrevocable, removes user control, creates liability
- Leasing model with time-bound access — selected

**Reasoning:**
- A lease is structurally different from a sale: it expires, it can be revoked (with consequences), and the user retains the underlying attribute for future leases
- Leasing creates a recurring revenue model — users can re-lease the same attribute to different buyers repeatedly
- The revocation mechanism (with forfeiture) is only meaningful in a leasing context — it gives users genuine control without letting them act in bad faith
- "You never lose your data" is a simple, powerful message to users and judges. "You sell your data once" is not

**Consequences:** All product copy, demo script language, and judge Q&A answers use "lease" not "sell." The contract is called `LeaseManager` not `DataSaleManager`. This framing is architectural, not cosmetic — it shapes the entire economic model.
