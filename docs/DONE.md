# DONE.md — Meridian

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

**What was built:** npm workspaces monorepo with `packages/contracts` (Hardhat + OpenZeppelin), `packages/web` (Next.js 14, wagmi, RainbowKit, Tailwind, shadcn/ui), and `packages/shared` (empty, ready for ABIs). `.env.example` populated with all required keys.

**What was tested:** `npm install` from root succeeds. `npx hardhat compile` returns no errors. `npm run dev` serves on localhost. All external accounts (Alchemy, OpenAI, Anthropic, Supabase, Vercel, Basescan) confirmed active.

**What is NOT built:** No actual contract code, no API routes, no UI components. Shell only.

**Unlock condition:** Only if the monorepo structure fundamentally needs to change — requires team vote and new D-XX entry in DECISIONS.md.

---
