# ENV_VARS.md — Meridian

> **Purpose:** All environment variables with source, visibility, and setup instructions.
> **Prevents:** Setup confusion and onboarding friction.
> **Update rule:** Add a new entry the moment a new variable is introduced. Never leave a variable undocumented.

---

## Ground Rules

| Rule | Detail |
|------|--------|
| `NEXT_PUBLIC_` prefix | Exposed to the browser bundle. Never put secrets here. |
| No prefix | Server-side only. Never referenced in client components. |
| Never commit | `.env.local` is in `.gitignore`. Use `.env.example` for the template. |
| Rotation | If any secret is exposed, rotate it immediately and update this file. |

---

## Quick Setup Checklist

Copy `.env.example` to `.env.local` then fill in each variable below.

- [ ] Alchemy account created — get RPC URL and API key
- [ ] OpenAI account created — get API key
- [ ] Anthropic account created — get API key
- [ ] Supabase project created — get Postgres connection string
- [ ] Vercel project linked — env vars synced via Vercel dashboard or CLI
- [ ] Issuer wallet generated — private key stored securely, address noted
- [ ] Contracts deployed — addresses filled in after Day 2

---

## Variables

---

### Blockchain

#### `ALCHEMY_RPC_SEPOLIA`
```
Value:       https://base-sepolia.g.alchemy.com/v2/[YOUR_KEY]
Visibility:  Server-side only
Required:    Yes
Used in:     lib/onchain/attributeEngine.ts, scripts/deploy.ts
Source:      https://dashboard.alchemy.com → Create App → Base Sepolia
Notes:       Used for all on-chain attribute reads and tx broadcasting from backend.
             Do NOT use NEXT_PUBLIC_ — exposes your Alchemy key to the browser.
```

#### `ALCHEMY_API_KEY`
```
Value:       [32-character alphanumeric key]
Visibility:  Server-side only
Required:    Yes
Used in:     lib/onchain/attributeEngine.ts (Alchemy SDK init)
Source:      Same app as ALCHEMY_RPC_SEPOLIA — key is the suffix of the RPC URL
Notes:       The Alchemy SDK requires the key separately from the full RPC URL.
```

---

### Contracts

#### `NEXT_PUBLIC_CERTIFICATE_REGISTRY_ADDRESS`
```
Value:       0x________________________________________________
Visibility:  Client + server
Required:    Yes (after Day 2 deploy)
Used in:     shared/contracts.ts, all wagmi useReadContract / useWriteContract calls
Source:      Output of scripts/deploy.ts — paste from console log after deploy
Notes:       Leave as 0x until contracts are deployed. App will not function before this is set.
             Populate immediately after deploy — do not continue frontend work with a placeholder.
```

#### `NEXT_PUBLIC_LEASE_MANAGER_ADDRESS`
```
Value:       0x________________________________________________
Visibility:  Client + server
Required:    Yes (after Day 2 deploy)
Used in:     shared/contracts.ts, all wagmi lease interaction hooks
Source:      Output of scripts/deploy.ts
Notes:       Same as above. Both addresses must be set together.
```

#### `NEXT_PUBLIC_CHAIN_ID`
```
Value:       84532
Visibility:  Client + server
Required:    Yes
Used in:     wagmi chain config, deploy guard in scripts/deploy.ts
Source:      Hardcoded — Base Sepolia chain ID. Do not change for demo.
Notes:       84532 = Base Sepolia (testnet). 8453 = Base mainnet (production only).
             wagmi config must reject connections from any other chain.
```

---

### AI

#### `OPENAI_API_KEY`
```
Value:       sk-________________________________________________
Visibility:  Server-side only
Required:    Yes (if using GPT-4o as primary AI provider)
Used in:     lib/ai/verifier.ts
Source:      https://platform.openai.com/api-keys
Notes:       Never prefix with NEXT_PUBLIC_. If exposed, rotate immediately at platform.openai.com.
             For production: enable Zero Data Retention (ZDR) tier to prevent OpenAI storing inputs.
```

#### `ANTHROPIC_API_KEY`
```
Value:       sk-ant-________________________________________________
Visibility:  Server-side only
Required:    Only if using Claude as AI provider (alternative to OpenAI)
Used in:     lib/ai/verifier.ts (alternative provider branch)
Source:      https://console.anthropic.com → API Keys
Notes:       Only one of OPENAI_API_KEY or ANTHROPIC_API_KEY needs to be active at a time.
             See AI_PROMPTS.md Template 4 for provider selection guidance.
```

---

### Backend Wallet

#### `ISSUER_PRIVATE_KEY`
```
Value:       0x________________________________________________
Visibility:  Server-side only — CRITICAL SECRET
Required:    Yes
Used in:     Backend certificate minting (lib/blockchain/issuer.ts)
Source:      Generate a dedicated wallet — do NOT reuse a personal wallet.
             Recommended: cast wallet new (Foundry) or npx hardhat generate-wallet
Notes:       MOST SENSITIVE variable in the project. This key mints certificates on-chain.
             If exposed: (1) rotate by calling CertificateRegistry.removeIssuer(oldAddress)
             and addIssuer(newAddress) from the owner wallet, (2) update this variable,
             (3) redeploy to Vercel. Never log this value. Never paste it in chat or Slack.
             Production path: replace with Gnosis Safe or BitGo MPC — see DECISIONS.md D-22.
```

---

### Database

#### `DATABASE_URL`
```
Value:       postgresql://postgres.[ref]:[password]@[host]:5432/postgres
Visibility:  Server-side only
Required:    Yes
Used in:     All Postgres queries (lib/db/client.ts)
Source:      Supabase dashboard → Project → Settings → Database → Connection string (URI)
             Use the "direct connection" string, not the pooler, for the demo.
Notes:       Contains your Supabase password — never expose. If leaked, rotate via
             Supabase dashboard → Settings → Database → Reset database password.
```

---

### Feature Flags

#### `NEXT_PUBLIC_USE_MOCKS`
```
Value:       false
Visibility:  Client + server
Required:    Yes
Used in:     Any component or route that has a mock fallback during development
Source:      Hardcoded false for demo. Set to true only during local development
             when contracts are not yet deployed.
Notes:       Must be false before entering the demo room. See DEMO_SCRIPT.md pre-checklist.
```

#### `NEXT_PUBLIC_ZK_ENABLED`
```
Value:       true
Visibility:  Client
Required:    Yes
Used in:     Frontend ZK verification flow (F-24) — controls whether ZK option is shown
Source:      Hardcoded true for demo.
Notes:       Set to false to hide ZK flow during early development before Anon Aadhaar
             is integrated. Must be true for demo.
```

---

### Demo-Specific

#### `DEMO_WALLET_ADDRESS`
```
Value:       0x________________________________________________
Visibility:  Server-side only
Required:    Yes (for demo caching — see DECISIONS.md D-23)
Used in:     lib/onchain/attributeEngine.ts (cache check), lib/ai/verifier.ts (verdict cache)
Source:      The wallet address you will use on demo day. Generate dedicated demo wallet.
Notes:       When a request comes in for this address, serve data from the cache files
             instead of calling Alchemy or AI live. All other addresses call live.
             Update demo-wallet-cache.json if the demo wallet makes new transactions before demo day.
```

---

## .env.example Template

This is the file committed to the repo. All values are blank or hardcoded non-secrets.

```bash
# ============================================================
# Meridian — Environment Variables
# Copy this file to .env.local and fill in all values.
# See ENV_VARS.md for source, visibility, and setup notes.
# NEVER commit .env.local
# ============================================================

# --- Blockchain ---
ALCHEMY_RPC_SEPOLIA=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY_HERE
ALCHEMY_API_KEY=YOUR_KEY_HERE

# --- Contracts (populate after Day 2 deploy) ---
NEXT_PUBLIC_CERTIFICATE_REGISTRY_ADDRESS=0x
NEXT_PUBLIC_LEASE_MANAGER_ADDRESS=0x
NEXT_PUBLIC_CHAIN_ID=84532

# --- AI ---
OPENAI_API_KEY=sk-
ANTHROPIC_API_KEY=sk-ant-

# --- Issuer Wallet (SERVER ONLY — never expose) ---
ISSUER_PRIVATE_KEY=0x

# --- Database ---
DATABASE_URL=postgresql://

# --- Feature Flags ---
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_ZK_ENABLED=true

# --- Demo ---
DEMO_WALLET_ADDRESS=0x
```

---

## Vercel Deployment

All variables must be added to Vercel before the first deploy. Variables without `NEXT_PUBLIC_` must be marked **Server** scope only in the Vercel dashboard.

```bash
# Add all at once via Vercel CLI (run from repo root):
vercel env add ALCHEMY_RPC_SEPOLIA
vercel env add ALCHEMY_API_KEY
vercel env add OPENAI_API_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add ISSUER_PRIVATE_KEY
vercel env add DATABASE_URL
vercel env add DEMO_WALLET_ADDRESS

# NEXT_PUBLIC_ vars can be added via dashboard or CLI:
vercel env add NEXT_PUBLIC_CERTIFICATE_REGISTRY_ADDRESS
vercel env add NEXT_PUBLIC_LEASE_MANAGER_ADDRESS
vercel env add NEXT_PUBLIC_CHAIN_ID
vercel env add NEXT_PUBLIC_USE_MOCKS
vercel env add NEXT_PUBLIC_ZK_ENABLED
```

After adding or updating any variable: **redeploy** for changes to take effect.

```bash
vercel --prod
```
