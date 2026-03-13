# AI_PROMPTS.md — Meridian

> **Purpose:** Standardized prompt templates for Solidity, React, and API code generation.
> **Prevents:** Inconsistent AI output quality and missing context errors.
> **Update rule:** When a prompt pattern produces better output, update it here. When one fails, document why under that template.

---

## How to Use This File

1. Pick the template for the task type
2. Feed the listed context files to the agent first
3. Fill in the `[BRACKETED]` fields
4. Do not skip the context files — the agent will hallucinate function signatures, types, and revert strings without them

**Context file priority:** Always include files marked `REQUIRED`. Include `RECOMMENDED` files when the task touches that area.

---

## Context File Index

| File | What it gives the agent |
|------|------------------------|
| `ARCHITECTURE.md` | Full system design, stack, data flow, trust boundaries |
| `CONTRACT_SPEC.md` | All function signatures, params, events, reverts, ABI fragments |
| `DECISIONS.md` | Why things are built the way they are — prevents the agent from "fixing" intentional choices |
| `FEATURES.md` | Feature I/O specs and done criteria — keeps scope tight |
| `DONE.md` | What's already built and locked — prevents duplicate or conflicting code |
| `ENV_VARS.md` | All env var names, visibility rules, and which modules use them |

---

## 1. Solidity — Full Contract

Use when generating an entire contract from scratch.

**Context files:**
- `REQUIRED` — `CONTRACT_SPEC.md` (full file)
- `REQUIRED` — `ARCHITECTURE.md` Sections 4, 10
- `REQUIRED` — `DECISIONS.md` entries D-01 through D-09
- `RECOMMENDED` — `DONE.md` (check nothing is already built)

**Template:**

```
You are writing production Solidity for a hackathon project called Meridian.

## Your task
Write [CertificateRegistry.sol / LeaseManager.sol] in full.

## Spec
The complete function signatures, structs, events, revert conditions, and storage layout
are defined in CONTRACT_SPEC.md Section [1 / 2], pasted below. Do not deviate from them.

[PASTE CONTRACT_SPEC.md SECTION 1 OR 2 IN FULL]

## Constraints — enforce all of these
- Solidity 0.8.28
- OpenZeppelin 5.x imports only: ERC721, ReentrancyGuard, Ownable, Counters
- Do NOT use: ERC721URIStorage, ERC721Enumerable, AccessControl, any upgradeable variant
- nonReentrant on every function that transfers ETH or modifies escrow state
- ETH transfer pattern: (bool sent,) = payable(addr).call{value: amount}(""); require(sent, "ETH transfer failed");
- Never use transfer() or send()
- attributeKey is always bytes32 (keccak256 hash). Never store strings on-chain
- No attribute value stored on-chain — only attributeKey and confidenceLevel
- locked() must always return true. No exceptions.
- transferFrom and safeTransferFrom must always revert with "Soulbound: non-transferable"
- Emit an event on every state change. Never skip an emit.
- Do not add any functions not listed in the spec
- Do not add upgradeability or proxy patterns

## Output format
- Single .sol file, complete, compilable
- NatDoc comments on every public function
- Inline comments explaining non-obvious logic only
- No test code in the output file
```

---

## 2. Solidity — Single Function Addition

Use when adding one function to an existing contract.

**Context files:**
- `REQUIRED` — `CONTRACT_SPEC.md` (the specific function's spec)
- `REQUIRED` — The existing contract file being modified
- `RECOMMENDED` — `DECISIONS.md` D-05, D-06 (if function touches escrow)

**Template:**

```
You are adding a single function to an existing Solidity contract for a project called Meridian.

## Existing contract
[PASTE FULL EXISTING CONTRACT]

## Function to add
Name:       [functionName]
Spec:       [PASTE THE FUNCTION'S SECTION FROM CONTRACT_SPEC.md]

## Constraints
- Do not modify any existing function
- Do not add any storage variables not required by this function
- Add nonReentrant if the function transfers ETH or modifies escrow balances
- Emit the event specified in the spec — do not change the event signature
- Match revert strings exactly as specified

## Output format
- Output the complete updated contract file
- Mark the new function with a comment: // ---- NEW: [functionName] ----
```

---

## 3. Solidity — Hardhat Unit Tests

Use when writing tests for a contract.

**Context files:**
- `REQUIRED` — `CONTRACT_SPEC.md` Section 7 (unit test checklist)
- `REQUIRED` — The contract file being tested
- `REQUIRED` — `CONTRACT_SPEC.md` Sections 1 or 2 (for the contract under test)

**Template:**

```
You are writing Hardhat unit tests in TypeScript for a Solidity contract in a project called Meridian.

## Contract under test
[PASTE FULL CONTRACT]

## Required test cases
Every checkbox in the following list must have a corresponding test. Do not skip any.

[PASTE CONTRACT_SPEC.md SECTION 7 CHECKLIST FOR THIS CONTRACT]

## Constraints
- Use Hardhat + ethers.js (test environment only — viem is used in the frontend)
- Use OpenZeppelin test helpers where appropriate
- Each test must be independent — no shared mutable state between tests
- Use descriptive test names that match the checklist item exactly
- Test both success paths and every revert condition listed in the spec
- For revert tests: use expect(...).to.be.revertedWith("[exact revert string]")
- For event tests: use expect(...).to.emit(contract, "[EventName]").withArgs(...)

## Output format
- Single test file: test/[ContractName].test.ts
- Group tests with describe() blocks matching the function names
- No placeholder or TODO tests — every test must be complete and runnable
```

---

## 4. Next.js API Route

Use when generating a single backend API route.

**Context files:**
- `REQUIRED` — `ARCHITECTURE.md` Section 5.1 (route pattern) and the relevant subsection (5.2, 5.3, 5.4, 5.5, or 5.6)
- `REQUIRED` — `FEATURES.md` entry for the feature this route serves (I/O spec and done criteria)
- `REQUIRED` — `ARCHITECTURE.md` Section 6 (database schema) if the route reads/writes Postgres
- `REQUIRED` — `ENV_VARS.md` (so the agent uses correct variable names and never exposes secrets client-side)
- `RECOMMENDED` — `DECISIONS.md` D-10, D-11, D-12 (if route touches AI verification)
- `RECOMMENDED` — `DECISIONS.md` D-15, D-16 (if route returns buyer-facing stats)

**Template:**

```
You are writing a Next.js 14 API route for a project called Meridian.

## Route to build
Method:   [GET / POST]
Path:     [/api/verify/onchain]
Feature:  [F-XX from FEATURES.md]

## I/O spec
[PASTE THE FEATURE'S INPUT/OUTPUT SPEC FROM FEATURES.md]

## Route pattern — follow this exactly
[PASTE ARCHITECTURE.md SECTION 5.1 CODE BLOCK]

## Business logic
[PASTE THE RELEVANT SUBSECTION FROM ARCHITECTURE.md — e.g. Section 5.2 for on-chain engine]

## Database schema (if applicable)
[PASTE ARCHITECTURE.md SECTION 6 TABLES THIS ROUTE TOUCHES]

## Constraints
- TypeScript, strict mode
- No middleware frameworks, no dependency injection
- No raw document bytes written to disk or any storage — buffer in memory only (for /verify/document)
- No wallet address, name, or any identifier returned in buyer-facing routes (for /lease/stats, /content/deliver)
- Validate all inputs before processing — return 400 for missing required params
- Return 500 with generic "internal error" on unexpected exceptions — never expose stack traces
- Use Zod for validating AI output schema (for /verify/document)

## Done criteria — output must satisfy all of these
[PASTE THE FEATURE'S DONE CRITERIA FROM FEATURES.md]

## Output format
- Single file: src/app/api/[path]/route.ts
- Export named GET or POST function only
- Helper functions in the same file unless they already exist in lib/
```

---

## 5. React Component — Page or View

Use when generating a full page component.

**Context files:**
- `REQUIRED` — `FEATURES.md` entry for the feature (done criteria = acceptance test)
- `REQUIRED` — `ARCHITECTURE.md` Section 7 (frontend architecture, wagmi rules)
- `REQUIRED` — `CONTRACT_SPEC.md` Section 5 (frontend integration patterns) if the page calls contracts
- `REQUIRED` — `CONTRACT_SPEC.md` Section 6 (ABI fragments) if TypeChain types aren't available yet
- `RECOMMENDED` — `ARCHITECTURE.md` Section 4.1 or 4.2 (contract data model, for struct field names)

**Template:**

```
You are writing a React component for a Next.js 14 app called Meridian.

## Component to build
Feature:     [F-XX — Feature Name]
File path:   [src/app/(pages)/dashboard/page.tsx]
Description: [One sentence from FEATURES.md]

## Data the component needs
[PASTE THE FEATURE'S INPUT/OUTPUT SPEC AND DATA SOURCES FROM FEATURES.md]

## Contract interaction (if any)
[PASTE RELEVANT SECTIONS FROM CONTRACT_SPEC.md SECTION 5]

## wagmi rules — enforce all of these
[PASTE ARCHITECTURE.md SECTION 7 wagmi rules block]

## UI states required
Loading:  [describe loading state — skeleton, spinner, or disabled]
Error:    [describe error state — message text, retry option if applicable]
Empty:    [describe empty state — message and call to action]
Success:  [describe the primary success state]

## Constraints
- TypeScript, strict mode
- Tailwind CSS only — no inline styles, no CSS modules
- shadcn/ui for all UI primitives (Button, Card, Badge, Dialog for modals)
- Framer Motion for: [list any animations required, or "none"]
- No useEffect + fetch — use wagmi useReadContract for on-chain data, standard fetch for API routes
- useReadContract calls at page level only — pass data as props to child components
- Always handle isPending, isConfirming, isSuccess, isError for any writeContract call
- No global state — local useState only plus WalletContext for address
- Do not import from wagmi inside child components — pass data as props

## Done criteria — component must satisfy all of these
[PASTE THE FEATURE'S DONE CRITERIA FROM FEATURES.md]

## Output format
- Single .tsx file
- Default export
- Props typed with a TypeScript interface at the top of the file
- No placeholder content — all states must be implemented
```

---

## 6. React Component — Isolated UI Component

Use for smaller reusable components (cards, panels, modals).

**Context files:**
- `REQUIRED` — `FEATURES.md` entry for the parent feature this component belongs to
- `RECOMMENDED` — `CONTRACT_SPEC.md` Section 4 (attribute key names, for display labels)

**Template:**

```
You are writing a reusable React UI component for a Next.js 14 app called Meridian.

## Component to build
Name:        [AttributeCard / LeaseRequestRow / ForfeitureModal]
File path:   [src/components/[name].tsx]
Used by:     [F-XX — parent feature name]
Description: [One sentence describing what this component displays or does]

## Props
[List each prop with its TypeScript type and what it's used for]

## Constraints
- TypeScript with explicit prop interface
- Tailwind CSS only
- shadcn/ui primitives only (no custom CSS)
- Framer Motion only if the parent feature specifies an animation for this component
- No data fetching inside this component — all data via props
- No wagmi hooks inside this component — all contract data via props

## Output format
- Single .tsx file
- Named export preferred over default export for components
- Props interface exported alongside the component
```

---

## 7. TypeScript Library Module

Use for non-component backend logic (ZK providers, AI verifier, stats aggregator, attribute engine).

**Context files:**
- `REQUIRED` — `ARCHITECTURE.md` subsection for the module (5.2, 5.3, 5.4, or 5.5)
- `REQUIRED` — `FEATURES.md` entry for the feature this module serves
- `REQUIRED` — `ENV_VARS.md` (so the agent reads secrets from correct server-side variable names)
- `RECOMMENDED` — `DECISIONS.md` relevant entries (D-10 to D-13 for AI/ZK modules)

**Template:**

```
You are writing a TypeScript library module for a Next.js 14 backend called Meridian.

## Module to build
File path:   [src/lib/ai/verifier.ts]
Feature:     [F-XX — Feature Name]
Description: [One sentence]

## Spec
[PASTE THE RELEVANT SUBSECTION FROM ARCHITECTURE.md — e.g. Section 5.3 for AI verifier]

## Types to implement
[List the TypeScript interfaces from the spec, or paste from ARCHITECTURE.md]

## Constraints
- TypeScript strict mode
- No side effects on import
- All async functions must handle their own errors and either return a typed result or throw a typed error — no unhandled promise rejections
- No direct database access in this module — DB calls belong in the route, not the lib
- [AI modules] AI output must be validated with Zod before use. Never trust raw AI JSON.
- [AI modules] confidence hard-capped at 0.99 after all post-processing
- [Document modules] No file I/O — buffer input only, never write to disk
- [ZK modules] Must implement IZKProvider interface exactly — no extra public methods

## Done criteria
[PASTE THE FEATURE'S DONE CRITERIA FROM FEATURES.md]

## Output format
- Single .ts file
- All exported types at the top
- All exported functions below types
- No default exports from library modules — named exports only
```

---

## 8. Database Migration / Schema

Use when generating SQL for new tables or altering existing ones.

**Context files:**
- `REQUIRED` — `ARCHITECTURE.md` Section 6 (full schema)
- `REQUIRED` — `ARCHITECTURE.md` Section 9 (data residency rules)
- `RECOMMENDED` — `DECISIONS.md` D-09, D-12, D-16 (what must NOT be stored)

**Template:**

```
You are writing a Postgres SQL migration for a project called Meridian hosted on Supabase.

## Migration task
[Add the buyer_content table / Add index on verification_verdicts.wallet_address / etc.]

## Full current schema for reference
[PASTE ARCHITECTURE.md SECTION 6 IN FULL]

## Data residency rules — these are hard constraints, not suggestions
- No column for raw document bytes
- No column for Aadhaar number or any government ID number
- No column for full name or date of birth
- No column storing individual-level buyer-facing data
- Attribute claimed values (e.g. "22-28") MAY be stored — they are backend-only, never returned to buyers

[PASTE ARCHITECTURE.md SECTION 9 DATA RESIDENCY TABLE]

## Output format
- Plain SQL — no ORM, no migration framework syntax
- CREATE TABLE with explicit column types, NOT NULL constraints, and DEFAULT values
- Foreign key constraints inline
- One migration file — no split up/down scripts for demo scope
```

---

## 9. Hardhat Deploy Script

Use when generating the deployment script for contracts.

**Context files:**
- `REQUIRED` — `CONTRACT_SPEC.md` Addresses section (fill in after deploy)
- `REQUIRED` — Both compiled contract files
- `REQUIRED` — `ARCHITECTURE.md` Section 4 (constructor args, issuer setup)
- `REQUIRED` — `ENV_VARS.md` (exact variable names for RPC URL, issuer key, chain ID)

**Template:**

```
You are writing a Hardhat deploy script in TypeScript for a project called Meridian deploying to Base Sepolia.

## Contracts to deploy
1. CertificateRegistry.sol
2. LeaseManager.sol

## Deploy sequence
1. Deploy CertificateRegistry
2. Deploy LeaseManager with CertificateRegistry address as constructor arg
3. Call CertificateRegistry.addIssuer(issuerWalletAddress) — issuer address from env
4. Call LeaseManager.setCertificateRegistry(registryAddress)
5. Verify both contracts on Basescan using hardhat-verify
6. Log all deployed addresses to console in a format that can be pasted into .env.local

## Constraints
- Read ISSUER_PRIVATE_KEY and all addresses from environment variables — never hardcode
- Chain must be Base Sepolia (chainId 84532) — add a guard that reverts if wrong chain
- Script must be idempotent — safe to re-run without re-deploying if already deployed
- After deploy, output a ready-to-paste .env.local block with all new addresses

## Output format
- Single file: scripts/deploy.ts
- Async main() function with try/catch
- Explicit console.log for every deployment step and address
```

---

## Known Failure Patterns

Document prompts that produced bad output so the team doesn't repeat them.

---

### FAIL-01 — Asking for contracts without CONTRACT_SPEC.md context

**What happened:** Agent generated plausible-looking Solidity with slightly different function signatures — `minConf` became `minConfidenceLevel`, `reqExpiry` became `requestExpiry`. Tests passed locally but frontend calls failed silently.

**Fix:** Always paste the exact CONTRACT_SPEC.md function signatures. Do not paraphrase them in the prompt.

---

### FAIL-02 — Asking for a React component without wagmi rules

**What happened:** Agent used `useEffect` + `fetch` for on-chain data instead of `useReadContract`. UI showed stale data after transactions because wagmi cache was bypassed.

**Fix:** Always paste ARCHITECTURE.md Section 7 wagmi rules block verbatim into every component prompt.

---

### FAIL-03 — Asking for AI verifier without confidence cap constraint

**What happened:** Agent returned AI verification logic that allowed `confidence: 1.0` when the model was "certain." Prompt injection test with a crafted document returned `verified: true, confidence: 1.0` for a fake attribute.

**Fix:** The `0.99` hard cap constraint must appear verbatim in every prompt that touches AI verification. Also paste DECISIONS.md D-11.

---

### FAIL-04 — Asking for a stats route without differential privacy context

**What happened:** Agent returned raw aggregate counts without noise. When tested with a 3-user cohort, individual records were trivially reverse-engineered.

**Fix:** Always paste ARCHITECTURE.md Section 5.5 (full Laplace implementation) and DECISIONS.md D-15 into any prompt that generates buyer-facing stat routes.

---

### FAIL-05 — Asking for a single function without the existing contract file

**What happened:** Agent regenerated the entire contract from memory with subtle differences — `mapping` key order changed, an event was missing from a function it didn't modify.

**Fix:** Template 2 (single function addition) requires the full existing contract as context. The output must be the full contract — not just the new function — to keep the file authoritative.

---

### FAIL-06 — Asking for an API route or lib module without ENV_VARS.md context

**What happened:** Agent generated `process.env.ALCHEMY_KEY` (wrong name), `process.env.NEXT_PUBLIC_ISSUER_PRIVATE_KEY` (exposes secret to client bundle), and `process.env.AI_KEY` (invented name). None of these exist in `.env.local` — the route silently failed with `undefined`.

**Fix:** Always include `ENV_VARS.md` as `REQUIRED` context for any route or lib module that reads environment variables. The agent must use exact variable names from that file and must never apply `NEXT_PUBLIC_` to secret keys.
