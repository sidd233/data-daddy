"use client"

/**
 * Meridian — Landing Page  (app/page.tsx)
 *
 * PROVIDERS REQUIRED in app/layout.tsx or app/providers.tsx:
 *   <WagmiProvider config={wagmiConfig}>
 *     <QueryClientProvider client={queryClient}>
 *       <RainbowKitProvider>
 *         {children}
 *       </RainbowKitProvider>
 *     </QueryClientProvider>
 *   </WagmiProvider>
 *
 * Existing stack (no new installs):
 *   wagmi · viem · @rainbow-me/rainbowkit · shadcn/ui · next/font
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { Syne, IBM_Plex_Mono } from "next/font/google"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi"
import { parseEther } from "viem"

// ─────────────────────────────────────────────────────────────
// FONTS
// ─────────────────────────────────────────────────────────────

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
})
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
})

// ─────────────────────────────────────────────────────────────
// CONTRACT CONFIG
// TODO: Populate NEXT_PUBLIC_* env vars after Day 2 deployment to Base Sepolia
// ─────────────────────────────────────────────────────────────

const CONTRACT_ADDRESSES = {
  CERTIFICATE_REGISTRY: (process.env.NEXT_PUBLIC_CERTIFICATE_REGISTRY_ADDRESS ??
    "0x") as `0x${string}`,
  LEASE_MANAGER: (process.env.NEXT_PUBLIC_LEASE_MANAGER_ADDRESS ??
    "0x") as `0x${string}`,
}

/**
 * Minimal ABI slices — expand with full ABI from packages/shared/abis once compiled.
 * TODO: import { LEASE_MANAGER_ABI } from "@meridian/shared/abis"
 */
const LEASE_MANAGER_ABI = [
  {
    name: "approveLease",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "requestId", type: "uint256" },
      { name: "certificateTokenId", type: "uint256" },
    ],
    outputs: [{ name: "leaseId", type: "uint256" }],
  },
  {
    name: "revokeLease",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "leaseId", type: "uint256" }],
    outputs: [],
  },
] as const

// ─────────────────────────────────────────────────────────────
// TYPES — mirror contract structs & API interfaces exactly
// ─────────────────────────────────────────────────────────────

/** Mirrors OnChainAttributeResult in /api/verify/onchain */
interface OnChainAttribute {
  attribute: string
  label: string
  verified: boolean
  confidence: number // 0.0–1.0 (always 1.0 for Tier 1)
  evidence: string
  tier: 1 | 2 | 3
  method: "onchain" | "zk" | "ai_document"
  certificateTokenId: number | null
}

/** Mirrors LeaseRequest struct from LeaseManager.sol + off-chain metadata */
interface LeaseRequest {
  onChainId: number
  buyerAddress: string
  buyerName: string
  attributeKey: string
  attributeLabel: string
  minConfidence: number // 0–100 as stored in contract
  aiAllowed: boolean
  pricePerUser: string // ETH string for display
  pricePerUserWei: bigint // for writeContract call
  leaseDurationSec: number
  expiresAt: Date
  maxUsers: number
  filledCount: number
  category: string
}

/** Mirrors Lease struct from LeaseManager.sol */
interface ActiveLease {
  leaseId: number
  requestId: number
  attributeLabel: string
  buyerName: string
  status: "Active" | "Settled" | "Revoked"
  startedAt: Date
  expiresAt: Date
  paidAmountEth: string
  content: BuyerContent | null
}

/** Mirrors buyer_content table in Postgres */
interface BuyerContent {
  contentType: "ad" | "offer" | "survey"
  title: string
  body: string
  ctaLabel: string | null
  ctaUrl: string | null
}

interface PlatformStats {
  totalProofsGenerated: number
  activeUsers: number
  companiesOnboarded: number
  totalPayoutsEth: string
}

// ─────────────────────────────────────────────────────────────
// MOCK DATA
// TODO: Replace each block with the noted API call
// ─────────────────────────────────────────────────────────────

/** TODO: GET /api/verify/onchain?address={address} → OnChainAttribute[] */
const MOCK_ONCHAIN_ATTRS: OnChainAttribute[] = [
  {
    attribute: "defi_user",
    label: "DeFi User",
    verified: true,
    confidence: 1.0,
    evidence: "14 interactions with Aave V2, Uniswap",
    tier: 1,
    method: "onchain",
    certificateTokenId: 1,
  },
  {
    attribute: "active_wallet",
    label: "Active Wallet",
    verified: true,
    confidence: 1.0,
    evidence: "Last transaction 3 days ago",
    tier: 1,
    method: "onchain",
    certificateTokenId: 2,
  },
  {
    attribute: "long_term_holder",
    label: "Long-term Holder",
    verified: true,
    confidence: 1.0,
    evidence: "First transaction 847 days ago",
    tier: 1,
    method: "onchain",
    certificateTokenId: 3,
  },
  {
    attribute: "asset_holder",
    label: "Asset Holder",
    verified: true,
    confidence: 1.0,
    evidence: "Holds 4 non-trivial ERC-20 tokens",
    tier: 1,
    method: "onchain",
    certificateTokenId: 4,
  },
]

/** TODO: GET /api/verify/onchain + ZK status for address → OnChainAttribute[] (tier 2) */
const MOCK_ZK_ATTRS: OnChainAttribute[] = [
  {
    attribute: "age_range",
    label: "Age Range 22–28",
    verified: false,
    confidence: 0,
    evidence: "Verify via Anon Aadhaar",
    tier: 2,
    method: "zk",
    certificateTokenId: null,
  },
  {
    attribute: "state_residence",
    label: "Maharashtra Resident",
    verified: false,
    confidence: 0,
    evidence: "Verify via Anon Aadhaar",
    tier: 2,
    method: "zk",
    certificateTokenId: null,
  },
]

/** TODO: GET /api/match/requests?address={address} → LeaseRequest[] */
const MOCK_REQUESTS: LeaseRequest[] = [
  {
    onChainId: 42,
    buyerAddress: "0xBuyer1",
    buyerName: "FinEdge Capital",
    attributeKey: "defi_user",
    attributeLabel: "DeFi User",
    minConfidence: 100,
    aiAllowed: false,
    pricePerUser: "0.002",
    pricePerUserWei: parseEther("0.002"),
    leaseDurationSec: 30 * 86400,
    expiresAt: new Date(Date.now() + 2.2 * 3600000),
    maxUsers: 500,
    filledCount: 312,
    category: "Web3 Audience",
  },
  {
    onChainId: 43,
    buyerAddress: "0xBuyer2",
    buyerName: "Kreditbee",
    attributeKey: "age_range",
    attributeLabel: "Age Range 22–28",
    minConfidence: 95,
    aiAllowed: false,
    pricePerUser: "0.005",
    pricePerUserWei: parseEther("0.005"),
    leaseDurationSec: 14 * 86400,
    expiresAt: new Date(Date.now() + 6 * 3600000),
    maxUsers: 200,
    filledCount: 87,
    category: "Lending KYC",
  },
  {
    onChainId: 44,
    buyerAddress: "0xBuyer3",
    buyerName: "Polygon Ventures",
    attributeKey: "long_term_holder",
    attributeLabel: "Long-term Holder",
    minConfidence: 100,
    aiAllowed: false,
    pricePerUser: "0.003",
    pricePerUserWei: parseEther("0.003"),
    leaseDurationSec: 7 * 86400,
    expiresAt: new Date(Date.now() + 18 * 3600000),
    maxUsers: 1000,
    filledCount: 601,
    category: "Investor Research",
  },
]

/** TODO: GET /api/lease/history?address={address} → ActiveLease[] */
const MOCK_LEASES: ActiveLease[] = [
  {
    leaseId: 7,
    requestId: 39,
    attributeLabel: "Active Wallet",
    buyerName: "Coinbase Ventures",
    status: "Active",
    startedAt: new Date(Date.now() - 5 * 86400000),
    expiresAt: new Date(Date.now() + 25 * 86400000),
    paidAmountEth: "0.002",
    content: {
      contentType: "offer",
      title: "Exclusive Web3 Research Report",
      body: "You've been selected for early access to our Q1 DeFi liquidity report. As a verified long-term holder, your insights matter.",
      ctaLabel: "Access Report",
      ctaUrl: "#",
    },
  },
]

const MOCK_STATS: PlatformStats = {
  totalProofsGenerated: 148_293,
  activeUsers: 12_041,
  companiesOnboarded: 87,
  totalPayoutsEth: "142.7",
}

// ─────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────

const CSS = `
  :root {
    --bg: #03030A; --surface: #08080F; --s2: #0D0D1A;
    --b: #141428; --ba: #252550;
    --accent: #00E5A0; --adim: rgba(0,229,160,.08); --amid: rgba(0,229,160,.2);
    --purple: #7C71F8; --pdim: rgba(124,113,248,.1);
    --amber: #F5A623; --red: #FF5A5A;
    --t: #DDE0EE; --t2: #7A7A9A; --t3: #3A3A5C;
    --fd: var(--font-syne); --fm: var(--font-mono); --r: 12px;
  }
  *{box-sizing:border-box}
  body{background:var(--bg)}

  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes ticker{to{transform:translateX(-50%)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes spinR{to{transform:rotate(-360deg)}}
  @keyframes ring{0%{transform:scale(1);opacity:.5}100%{transform:scale(2.5);opacity:0}}
  @keyframes blink{50%{opacity:0}}
  @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
  @keyframes np{0%,100%{r:4}50%{r:7}}
  @keyframes gp{0%,100%{box-shadow:0 0 10px rgba(0,229,160,.3)}50%{box-shadow:0 0 24px rgba(0,229,160,.6)}}
  @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}

  .au{animation:fadeUp .65s ease both}
  .ai{animation:fadeIn .5s ease both}
  .d1{animation-delay:.1s;opacity:0}
  .d2{animation-delay:.22s;opacity:0}
  .d3{animation-delay:.34s;opacity:0}
  .d4{animation-delay:.48s;opacity:0}
  .d5{animation-delay:.62s;opacity:0}
  .ticker{animation:ticker 32s linear infinite}
  .spin{animation:spin 12s linear infinite}
  .spinR{animation:spinR 8s linear infinite}
  .r1{animation:ring 2s ease-out infinite}
  .r2{animation:ring 2s ease-out infinite .7s}
  .blink{animation:blink 1s step-end infinite}
  .shimmer{background:linear-gradient(90deg,var(--s2) 25%,var(--ba) 50%,var(--s2) 75%);background-size:600px 100%;animation:shimmer 1.6s infinite}
  .np1{animation:np 2.2s ease-in-out infinite}
  .np2{animation:np 2.2s ease-in-out infinite .6s}
  .np3{animation:np 2.2s ease-in-out infinite 1.2s}
  .slide-in{animation:slideIn .4s ease both}
  .live{animation:gp 2s ease infinite}

  .card{background:var(--surface);border:1px solid var(--b);border-radius:var(--r);transition:border-color .2s,box-shadow .2s,transform .2s}
  .card:hover{border-color:var(--ba);box-shadow:0 6px 28px rgba(0,0,0,.5);transform:translateY(-2px)}
  .card-hi{border-color:rgba(0,229,160,.2)!important;box-shadow:0 0 0 1px rgba(0,229,160,.06)}

  .btn-p{background:var(--accent);color:#03030A;font-family:var(--fm);font-weight:700;border:none;border-radius:10px;cursor:pointer;transition:box-shadow .25s,transform .15s,opacity .2s}
  .btn-p:hover{box-shadow:0 0 28px rgba(0,229,160,.4)}
  .btn-p:active{transform:scale(.97)}
  .btn-p:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}

  .btn-g{background:transparent;color:var(--t2);border:1px solid var(--ba);font-family:var(--fm);border-radius:10px;cursor:pointer;transition:border-color .2s,color .2s}
  .btn-g:hover{border-color:var(--accent);color:var(--accent)}

  .btn-d{background:rgba(255,90,90,.1);color:var(--red);border:1px solid rgba(255,90,90,.25);font-family:var(--fm);border-radius:8px;cursor:pointer;transition:background .2s}
  .btn-d:hover{background:rgba(255,90,90,.2)}

  .grid-bg{background-image:linear-gradient(rgba(20,20,40,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(20,20,40,.6) 1px,transparent 1px);background-size:64px 64px}

  .tag{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-family:var(--fm);font-size:11px;text-transform:uppercase;letter-spacing:.08em}
  .tg{background:var(--adim);color:var(--accent);border:1px solid var(--amid)}
  .tp{background:var(--pdim);color:var(--purple);border:1px solid rgba(124,113,248,.25)}
  .ta{background:rgba(245,166,35,.08);color:var(--amber);border:1px solid rgba(245,166,35,.2)}
  .tr{background:rgba(255,90,90,.08);color:var(--red);border:1px solid rgba(255,90,90,.2)}

  .pill{display:inline-block;padding:2px 8px;border-radius:4px;font-family:var(--fm);font-size:11px;background:var(--s2);border:1px solid var(--b);color:var(--t2)}
  .mono{font-family:var(--fm)}
  .dot{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px var(--accent);flex-shrink:0}
  .sl{font-family:var(--fm);font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--t3);margin-bottom:10px}
  .cb{height:3px;border-radius:2px;background:linear-gradient(90deg,var(--accent),#00b87a)}
  .div{border:none;border-top:1px solid var(--b)}
  [data-rk] button{font-family:var(--fm)!important}
`

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const fmtAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const fmtDur = (s: number) => {
  const d = Math.floor(s / 86400)
  return `${d}d`
}
const fmtCountdown = (d: Date) => {
  const s = Math.max(0, Math.floor((d.getTime() - Date.now()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
const urgencyColor = (d: Date) => {
  const h = (d.getTime() - Date.now()) / 3600000
  return h < 3 ? "var(--red)" : h < 8 ? "var(--amber)" : "var(--t3)"
}
const tierMeta = (t: 1 | 2 | 3) =>
  t === 1
    ? { cls: "tg", label: "Tier 1 · On-chain" }
    : t === 2
      ? { cls: "tp", label: "Tier 2 · ZK" }
      : { cls: "ta", label: "Tier 3 · AI Doc" }

// ─────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────

/** RainbowKit wallet button styled to match Meridian dark theme */
function WalletBtn({ sm = false }: { sm?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        if (!mounted) return null
        if (!account || !chain)
          return (
            <button
              className="btn-p"
              onClick={openConnectModal}
              style={{
                padding: sm ? "8px 16px" : "11px 22px",
                fontSize: sm ? 13 : 14,
              }}
            >
              Connect Wallet
            </button>
          )
        if (chain.unsupported)
          return (
            <button
              className="btn-d"
              onClick={openChainModal}
              style={{ padding: "8px 14px", fontSize: 13 }}
            >
              Wrong Network
            </button>
          )
        return (
          <button
            onClick={openAccountModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: sm ? "6px 12px" : "8px 14px",
              background: "var(--adim)",
              border: "1px solid var(--amid)",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            <span className="dot live" />
            <span
              className="mono"
              style={{ fontSize: 13, color: "var(--accent)" }}
            >
              {account.displayName}
            </span>
            {account.displayBalance && (
              <span
                className="mono"
                style={{ fontSize: 12, color: "var(--t3)" }}
              >
                {account.displayBalance}
              </span>
            )}
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}

type ProofState =
  | "idle"
  | "scanning"
  | "generating"
  | "submitting"
  | "done"
  | "error"

function ZKOrb({ state }: { state: ProofState }) {
  const c = {
    idle: "#252550",
    scanning: "#7C71F8",
    generating: "#7C71F8",
    submitting: "#F5A623",
    done: "#00E5A0",
    error: "#FF5A5A",
  }[state]
  const active = state !== "idle"
  const spinning = state === "scanning" || state === "generating"
  const icons = {
    idle: "🔒",
    scanning: "📱",
    generating: "⚡",
    submitting: "⚡",
    done: "✓",
    error: "✕",
  }
  return (
    <div
      style={{
        position: "relative",
        width: 160,
        height: 160,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {(state === "generating" || state === "scanning") && (
        <>
          <div
            className="r1"
            style={{
              position: "absolute",
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: `1px solid ${c}50`,
              background: `${c}08`,
            }}
          />
          <div
            className="r2"
            style={{
              position: "absolute",
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: `1px solid ${c}30`,
            }}
          />
        </>
      )}
      {active && (
        <div
          className={spinning ? "spin" : ""}
          style={{
            position: "absolute",
            width: 112,
            height: 112,
            borderRadius: "50%",
            border: `1px dashed ${c}40`,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: c,
              top: -3.5,
              left: "50%",
              transform: "translateX(-50%)",
              boxShadow: `0 0 10px ${c}`,
            }}
          />
        </div>
      )}
      {active && (
        <div
          className={spinning ? "spinR" : ""}
          style={{
            position: "absolute",
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: `1px dashed ${c}25`,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: `${c}80`,
              bottom: -2.5,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          />
        </div>
      )}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%,${c}30,${c}08)`,
          border: `2px solid ${c}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          transition: "all .4s",
          boxShadow: active ? `0 0 32px ${c}40` : "none",
        }}
      >
        {icons[state]}
      </div>
    </div>
  )
}

function AttrCard({
  a,
  onVerify,
}: {
  a: OnChainAttribute
  onVerify?: () => void
}) {
  const { cls, label } = tierMeta(a.tier)
  return (
    <div className="card slide-in" style={{ padding: "14px 16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--fd)",
              fontWeight: 700,
              fontSize: 14,
              color: a.verified ? "var(--t)" : "var(--t2)",
              margin: 0,
            }}
          >
            {a.label}
          </p>
          <p
            className="mono"
            style={{ fontSize: 11, color: "var(--t3)", margin: "3px 0 0" }}
          >
            {a.evidence}
          </p>
        </div>
        <span className={`tag ${cls}`}>{label}</span>
      </div>
      {a.verified ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: 1, marginRight: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--t3)" }}
              >
                Confidence
              </span>
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--accent)" }}
              >
                {Math.round(a.confidence * 100)}%
              </span>
            </div>
            <div
              style={{ height: 3, background: "var(--ba)", borderRadius: 2 }}
            >
              <div className="cb" style={{ width: `${a.confidence * 100}%` }} />
            </div>
          </div>
          <span className="mono" style={{ fontSize: 11, color: "var(--t3)" }}>
            SBT #{a.certificateTokenId}
          </span>
        </div>
      ) : (
        <button
          onClick={onVerify}
          className="btn-g"
          style={{ fontSize: 12, padding: "5px 12px", marginTop: 4 }}
        >
          {a.tier === 2 ? "Verify via Anon Aadhaar →" : "Verify via Document →"}
        </button>
      )}
    </div>
  )
}

function FlowSVG() {
  return (
    <svg
      viewBox="0 0 540 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", maxWidth: 540 }}
    >
      <defs>
        <marker
          id="a1"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path
            d="M0 1L9 5L0 9"
            fill="none"
            stroke="#252550"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </marker>
        <marker
          id="a2"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path
            d="M0 1L9 5L0 9"
            fill="none"
            stroke="#00E5A0"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </marker>
      </defs>
      <rect
        x="10"
        y="95"
        width="115"
        height="74"
        rx="8"
        fill="#08080F"
        stroke="#141428"
        strokeWidth="1.5"
      />
      <text
        x="67"
        y="122"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="10"
        fill="#7A7A9A"
      >
        USER DEVICE
      </text>
      <text
        x="67"
        y="141"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="12"
        fill="#DDE0EE"
        fontWeight="700"
      >
        DOB · Income
      </text>
      <text
        x="67"
        y="157"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="10"
        fill="#3A3A5C"
      >
        Aadhaar · Salary slip
      </text>

      <rect
        x="210"
        y="75"
        width="120"
        height="114"
        rx="8"
        fill="#08080F"
        stroke="#7C71F8"
        strokeWidth="1.5"
        style={{ filter: "drop-shadow(0 0 14px rgba(124,113,248,.2))" }}
      />
      <text
        x="270"
        y="100"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="10"
        fill="#7C71F8"
      >
        ZK ENGINE
      </text>
      <circle className="np1" cx="248" cy="128" r="4" fill="#7C71F8" />
      <circle className="np2" cx="270" cy="148" r="4" fill="#00E5A0" />
      <circle className="np3" cx="292" cy="128" r="4" fill="#7C71F8" />
      <line
        x1="248"
        y1="128"
        x2="270"
        y2="148"
        stroke="#252550"
        strokeWidth="1"
      />
      <line
        x1="270"
        y1="148"
        x2="292"
        y2="128"
        stroke="#252550"
        strokeWidth="1"
      />
      <line
        x1="248"
        y1="128"
        x2="292"
        y2="128"
        stroke="#252550"
        strokeWidth="1"
      />
      <text
        x="270"
        y="175"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="9"
        fill="#3A3A5C"
      >
        circuit · witness · proof
      </text>

      <rect
        x="410"
        y="95"
        width="120"
        height="74"
        rx="8"
        fill="#08080F"
        stroke="#141428"
        strokeWidth="1.5"
      />
      <text
        x="470"
        y="122"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="10"
        fill="#7A7A9A"
      >
        COMPANY
      </text>
      <text
        x="470"
        y="141"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="12"
        fill="#00E5A0"
        fontWeight="700"
      >
        ✓ Claim valid
      </text>
      <text
        x="470"
        y="157"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="10"
        fill="#3A3A5C"
      >
        Raw data: never seen
      </text>

      <path
        d="M125 132L208 132"
        stroke="#252550"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        markerEnd="url(#a1)"
      />
      <path
        d="M330 132L408 132"
        stroke="#00E5A0"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        markerEnd="url(#a2)"
      />
      <text
        x="167"
        y="122"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="9"
        fill="#3A3A5C"
      >
        raw data
      </text>
      <text
        x="369"
        y="122"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="9"
        fill="#00E5A0"
      >
        proof only
      </text>

      <rect
        x="190"
        y="218"
        width="160"
        height="34"
        rx="6"
        fill="#08080F"
        stroke="#141428"
        strokeWidth="1"
      />
      <text
        x="270"
        y="240"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="9"
        fill="#3A3A5C"
      >
        ⛓ On-chain Nullifier Registry
      </text>
      <line
        x1="270"
        y1="189"
        x2="270"
        y2="218"
        stroke="#141428"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <path
        d="M470 169L470 206Q470 218 460 218L352 218"
        stroke="#141428"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

type Section = "dashboard" | "marketplace" | "leases"

export default function LandingPage() {
  // ── wagmi ────────────────────────────────────────────────────
  const { address, isConnected } = useAccount()

  /**
   * Write hooks — wired to real ABI already.
   * TODO: Remove mock blocks inside handlers when contracts are deployed.
   * Rule from MasterDoc §9: always pair writeContract with useWaitForTransactionReceipt.
   */
  const {
    writeContract,
    data: writeTxHash,
    isPending: isWritePending,
  } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({ hash: writeTxHash })

  // ── State ────────────────────────────────────────────────────
  const [tier1, setTier1] = useState<OnChainAttribute[]>([])
  const [tier2, setTier2] = useState<OnChainAttribute[]>(MOCK_ZK_ATTRS)
  const [requests, setRequests] = useState<LeaseRequest[]>([])
  const [leases, setLeases] = useState<ActiveLease[]>([])
  const [stats, setStats] = useState<PlatformStats>(MOCK_STATS)
  const [section, setSection] = useState<Section>("dashboard")
  const [loadingT1, setLoadingT1] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [revokeId, setRevokeId] = useState<number | null>(null)
  const [proofState, setProofState] = useState<ProofState>("idle")
  const [proofLog, setProofLog] = useState<string[]>([])
  const statsTick = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined
  )

  // ── Data fetching ─────────────────────────────────────────────

  /** TODO: replace body with `fetch("/api/verify/onchain?address=" + addr).then(r => r.json())` */
  const fetchTier1 = useCallback(async (addr: string) => {
    setLoadingT1(true)
    await new Promise((r) => setTimeout(r, 900)) // simulates Alchemy latency
    setTier1(MOCK_ONCHAIN_ATTRS)
    setLoadingT1(false)
  }, [])

  /** TODO: replace body with `fetch("/api/match/requests?address=" + addr).then(r => r.json())` */
  const fetchRequests = useCallback(async (addr: string) => {
    await new Promise((r) => setTimeout(r, 400))
    setRequests(MOCK_REQUESTS)
  }, [])

  /** TODO: replace body with `fetch("/api/lease/history?address=" + addr).then(r => r.json())` */
  const fetchLeases = useCallback(async (addr: string) => {
    await new Promise((r) => setTimeout(r, 300))
    setLeases(MOCK_LEASES)
  }, [])

  useEffect(() => {
    if (!isConnected || !address) {
      setTier1([])
      setRequests([])
      setLeases([])
      return
    }
    fetchTier1(address)
    fetchRequests(address)
    fetchLeases(address)
    const poll = setInterval(() => fetchRequests(address), 15_000) // §9: 15s polling
    return () => clearInterval(poll)
  }, [isConnected, address, fetchTier1, fetchRequests, fetchLeases])

  useEffect(() => {
    statsTick.current = setInterval(
      () =>
        setStats((p) => ({
          ...p,
          totalProofsGenerated:
            p.totalProofsGenerated + Math.floor(Math.random() * 3),
        })),
      2000
    )
    return () => clearInterval(statsTick.current!)
  }, [])

  // Refetch after tx success (§9 wagmi rule)
  useEffect(() => {
    if (isTxSuccess && address) {
      fetchLeases(address)
      fetchRequests(address)
      setPendingId(null)
    }
  }, [isTxSuccess, address, fetchLeases, fetchRequests])

  // ── Handlers ──────────────────────────────────────────────────

  const handleApprove = useCallback(
    async (req: LeaseRequest) => {
      const certId =
        tier1.find((a) => a.attribute === req.attributeKey)
          ?.certificateTokenId ?? 1
      setPendingId(req.onChainId)

      // ── MOCK (remove when contracts deployed) ──────────────────
      await new Promise((r) => setTimeout(r, 2200))
      setRequests((p) => p.filter((r) => r.onChainId !== req.onChainId))
      setLeases((p) => [
        ...p,
        {
          leaseId: Date.now(),
          requestId: req.onChainId,
          attributeLabel: req.attributeLabel,
          buyerName: req.buyerName,
          status: "Active",
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + req.leaseDurationSec * 1000),
          paidAmountEth: req.pricePerUser,
          content: {
            contentType: "offer",
            title: `Offer from ${req.buyerName}`,
            body: `You've been matched as a verified ${req.attributeLabel}. Exclusive access for this lease period.`,
            ctaLabel: "View",
            ctaUrl: "#",
          },
        },
      ])
      setSection("leases")
      setPendingId(null)
      // ── /MOCK ────────────────────────────────────────────────────

      // TODO: uncomment when CONTRACT_ADDRESSES are populated:
      // writeContract({
      //   address: CONTRACT_ADDRESSES.LEASE_MANAGER,
      //   abi: LEASE_MANAGER_ABI,
      //   functionName: "approveLease",
      //   args: [BigInt(req.onChainId), BigInt(certId)],
      // });
    },
    [tier1]
  )

  const handleRevoke = useCallback(async (leaseId: number) => {
    setRevokeId(null)

    // ── MOCK ──
    await new Promise((r) => setTimeout(r, 1500))
    setLeases((p) =>
      p.map((l) =>
        l.leaseId === leaseId ? { ...l, status: "Revoked" as const } : l
      )
    )
    // ── /MOCK ──

    // TODO: uncomment when contracts deployed:
    // writeContract({ address: CONTRACT_ADDRESSES.LEASE_MANAGER, abi: LEASE_MANAGER_ABI, functionName: "revokeLease", args: [BigInt(leaseId)] });
  }, [])

  /**
   * Anon Aadhaar ZK flow — currently mocked end-to-end.
   *
   * TODO: Replace with Anon Aadhaar React SDK:
   * 1. npm install anon-aadhaar-react  (confirm before installing)
   * 2. Render <AnonAadhaarProve> from the SDK — handles QR scan + local proof gen
   * 3. On onProofGenerated callback: POST /api/verify/zk { proof, providerKey: "anon_aadhaar" }
   * 4. Backend calls AnonAadhaar verifier contract, mints SBT via CertificateRegistry
   * 5. Poll /api/verify/onchain or listen for CertificateMinted event to update tier2 state
   */
  const handleZKVerify = useCallback(async (attrKey: string) => {
    setProofLog([])
    setProofState("scanning")
    setProofLog(["Scanning Aadhaar QR code on device..."])
    await new Promise((r) => setTimeout(r, 1200))
    setProofState("generating")
    setProofLog((p) => [
      ...p,
      "Building zkSNARK witness locally...",
      "Generating proof (circuit computation)...",
    ])
    await new Promise((r) => setTimeout(r, 2200))
    setProofLog((p) => [
      ...p,
      "Proof generated. Submitting to /api/verify/zk...",
    ])
    setProofState("submitting")
    await new Promise((r) => setTimeout(r, 1000))
    setProofState("done")
    setProofLog((p) => [
      ...p,
      "✓ Backend verified. Certificate minted on Base Sepolia.",
    ])
    setTier2((p) =>
      p.map((a) =>
        a.attribute === attrKey
          ? {
              ...a,
              verified: true,
              confidence: 1.0,
              certificateTokenId: Math.floor(Math.random() * 9000) + 1000,
            }
          : a
      )
    )
  }, [])

  // ── Derived ────────────────────────────────────────────────────
  const allAttrs = [...tier1, ...tier2]
  const verifiedN = allAttrs.filter((a) => a.verified).length

  const S = { padding: "0 24px", maxWidth: 980, margin: "0 auto" }

  // ──────────────────────────────────────────────────────────────
  return (
    <div
      className={`${syne.variable} ${mono.variable}`}
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--t)",
        fontFamily: "var(--fd)",
        overflowX: "hidden",
      }}
    >
      <style>{CSS}</style>

      {/* ===== NAV ===== */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          background: "rgba(3,3,10,.88)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--b)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 14px rgba(0,229,160,.4)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="3.5" fill="#03030A" />
              <path
                d="M9 1v3M9 14v3M1 9h3M14 9h3"
                stroke="#03030A"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "var(--fd)",
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: "-.02em",
            }}
          >
            Meridian
          </span>
          <span className="pill" style={{ fontSize: 10 }}>
            Base Sepolia
          </span>
        </div>
        <div
          className="mono"
          style={{ display: "flex", gap: 28, fontSize: 13, color: "var(--t2)" }}
        >
          {[
            ["#how", "How It Works"],
            ["#dashboard", "Dashboard"],
            ["#marketplace", "Marketplace"],
          ].map(([h, l]) => (
            <a
              key={h}
              href={h}
              style={{ color: "inherit", textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--t)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--t2)")}
            >
              {l}
            </a>
          ))}
        </div>
        <WalletBtn sm />
      </nav>

      {/* ===== HERO ===== */}
      <section
        className="grid-bg"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "120px 24px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(124,113,248,.06) 0%,transparent 70%)",
            top: "5%",
            left: "0%",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(0,229,160,.05) 0%,transparent 70%)",
            bottom: "10%",
            right: "0%",
            pointerEvents: "none",
          }}
        />

        <div className="au d1">
          <span className="tag tg">
            <span className="dot live" style={{ width: 5, height: 5 }} />
            Zero-Knowledge · Soulbound Credentials · Base Network
          </span>
        </div>

        <h1
          className="au d2"
          style={{
            fontFamily: "var(--fd)",
            fontWeight: 900,
            fontSize: "clamp(3rem,8vw,6.5rem)",
            letterSpacing: "-.03em",
            lineHeight: 1.0,
            margin: "22px 0 0",
            maxWidth: 860,
          }}
        >
          Your data.
          <br />
          Your proof.
          <span
            style={{
              color: "var(--accent)",
              textShadow: "0 0 60px rgba(0,229,160,.35)",
            }}
          >
            {" "}
            Your terms.
          </span>
        </h1>

        <p
          className="au d3"
          style={{
            marginTop: 20,
            maxWidth: 520,
            color: "var(--t2)",
            fontSize: "clamp(1rem,1.8vw,1.1rem)",
            lineHeight: 1.7,
          }}
        >
          Prove you're above 23, earn above ₹21 LPA, or own an Aadhaar —{" "}
          <span style={{ color: "var(--t)" }}>
            without showing a single document.
          </span>{" "}
          Lease your cryptographic proofs and get paid.
        </p>

        <div
          className="au d4"
          style={{
            display: "flex",
            gap: 12,
            marginTop: 32,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {!isConnected ? (
            <WalletBtn />
          ) : (
            <a href="#dashboard">
              <button
                className="btn-p"
                style={{ padding: "12px 24px", fontSize: 14 }}
              >
                Open Dashboard →
              </button>
            </a>
          )}
          <a href="#how">
            <button
              className="btn-g"
              style={{ padding: "12px 20px", fontSize: 14 }}
            >
              How it works
            </button>
          </a>
        </div>

        <div
          className="au d5"
          style={{ marginTop: 64, width: "100%", maxWidth: 580 }}
        >
          <div className="card" style={{ padding: 24 }}>
            <FlowSVG />
          </div>
        </div>
      </section>

      {/* ===== STATS TICKER ===== */}
      <div
        style={{
          borderTop: "1px solid var(--b)",
          borderBottom: "1px solid var(--b)",
          background: "var(--surface)",
          overflow: "hidden",
          padding: "10px 0",
        }}
      >
        <div
          className="ticker"
          style={{
            display: "flex",
            gap: 48,
            whiteSpace: "nowrap",
            width: "max-content",
          }}
        >
          {[0, 1].map((i) => (
            <span
              key={i}
              className="mono"
              style={{
                display: "flex",
                gap: 48,
                alignItems: "center",
                fontSize: 13,
              }}
            >
              {[
                {
                  l: "Proofs Generated",
                  v: stats.totalProofsGenerated.toLocaleString("en-IN"),
                  c: "var(--accent)",
                },
                {
                  l: "Active Users",
                  v: stats.activeUsers.toLocaleString("en-IN"),
                  c: "var(--t)",
                },
                {
                  l: "Companies Onboarded",
                  v: String(stats.companiesOnboarded),
                  c: "var(--t)",
                },
                {
                  l: "Total Payouts",
                  v: `${stats.totalPayoutsEth} ETH`,
                  c: "var(--accent)",
                },
              ].map((s) => (
                <span
                  key={s.l}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    color: "var(--t2)",
                  }}
                >
                  <span style={{ color: "var(--t3)" }}>⬡</span>
                  {s.l}
                  <span style={{ color: s.c, fontWeight: 700 }}>{s.v}</span>
                </span>
              ))}
              <span style={{ color: "var(--t3)" }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ===== HOW IT WORKS ===== */}
      <section
        id="how"
        style={{
          padding: "100px 24px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--b)",
        }}
      >
        <div style={S}>
          <p className="sl" style={{ textAlign: "center" }}>
            Protocol
          </p>
          <h2
            style={{
              fontFamily: "var(--fd)",
              fontWeight: 900,
              fontSize: "clamp(1.8rem,3.5vw,2.8rem)",
              textAlign: "center",
              marginBottom: 48,
              letterSpacing: "-.02em",
            }}
          >
            Three tiers of verified trust
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
              gap: 16,
              marginBottom: 40,
            }}
          >
            {[
              {
                n: "01",
                cls: "tg",
                color: "var(--accent)",
                icon: "⛓",
                tier: "Tier 1 · On-chain",
                conf: "100%",
                name: "On-chain Attributes",
                desc: "Verified directly from your wallet's blockchain history via Alchemy. Trustless, instant, unfakeable.",
                examples: [
                  "DeFi User",
                  "Active Wallet",
                  "Long-term Holder",
                  "Asset Holder",
                  "NFT Holder",
                ],
              },
              {
                n: "02",
                cls: "tp",
                color: "var(--purple)",
                icon: "🔐",
                tier: "Tier 2 · ZK Proof",
                conf: "~100%",
                name: "ZK Proofs",
                desc: "Generate a zkSNARK from your Aadhaar QR locally via Anon Aadhaar. Government-backed, math-verified.",
                examples: [
                  "Age Range 22–28",
                  "State of Residence",
                  "Govt. Verified Identity",
                ],
              },
              {
                n: "03",
                cls: "ta",
                color: "var(--amber)",
                icon: "🤖",
                tier: "Tier 3 · AI Doc",
                conf: "65–95%",
                name: "AI Document Scan",
                desc: "Upload a document. AI extracts the claim, returns a confidence score. Buyer must opt in to aiAllowed.",
                examples: [
                  "Income Threshold",
                  "Employer Verify",
                  "Custom Attributes",
                ],
              },
            ].map((it) => (
              <div key={it.n} className="card" style={{ padding: "22px 20px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 24 }}>{it.icon}</span>
                  <span
                    className="mono"
                    style={{ fontSize: 10, color: "var(--t3)" }}
                  >
                    {it.n}
                  </span>
                </div>
                <span className={`tag ${it.cls}`} style={{ marginBottom: 10 }}>
                  {it.tier} · {it.conf} confidence
                </span>
                <h4
                  style={{
                    fontFamily: "var(--fd)",
                    fontWeight: 700,
                    fontSize: "1rem",
                    margin: "10px 0 6px",
                    color: it.color,
                  }}
                >
                  {it.name}
                </h4>
                <p
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--t2)",
                    lineHeight: 1.65,
                    marginBottom: 14,
                  }}
                >
                  {it.desc}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {it.examples.map((e) => (
                    <span key={e} className="pill">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Lease flow steps */}
          <div className="card card-hi" style={{ padding: "22px 24px" }}>
            <p className="sl">Lease Flow</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                gap: 16,
              }}
            >
              {[
                {
                  s: "1",
                  t: "Verify",
                  d: "On-chain attributes auto-verified on wallet connect. Add Anon Aadhaar ZK for premium tiers.",
                },
                {
                  s: "2",
                  t: "Match",
                  d: "Backend matches you to open buyer requests based on your verified attributes + confidence.",
                },
                {
                  s: "3",
                  t: "Approve",
                  d: "Review request terms. Sign approveLease(). Payment enters escrow in LeaseManager.sol.",
                },
                {
                  s: "4",
                  t: "Earn",
                  d: "Lease expires → settleLease() releases payment to your wallet. Revoke early and forfeit.",
                },
              ].map((it) => (
                <div key={it.s}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: "var(--accent)",
                        color: "#03030A",
                        fontWeight: 700,
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--fm)",
                      }}
                    >
                      {it.s}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--fd)",
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--accent)",
                      }}
                    >
                      {it.t}
                    </span>
                  </div>
                  <p
                    className="mono"
                    style={{
                      fontSize: 12,
                      color: "var(--t2)",
                      lineHeight: 1.6,
                    }}
                  >
                    {it.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== DASHBOARD ===== */}
      <section id="dashboard" style={{ padding: "80px 24px" }}>
        <div style={S}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 28,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <p className="sl">Dashboard</p>
              <h2
                style={{
                  fontFamily: "var(--fd)",
                  fontWeight: 900,
                  fontSize: "clamp(1.6rem,3vw,2.4rem)",
                  letterSpacing: "-.02em",
                  margin: 0,
                }}
              >
                {isConnected ? (
                  <>
                    {fmtAddr(address!)}{" "}
                    <span
                      style={{
                        color: "var(--t2)",
                        fontWeight: 400,
                        fontSize: "55%",
                      }}
                    >
                      — {verifiedN} verified attribute
                      {verifiedN !== 1 ? "s" : ""}
                    </span>
                  </>
                ) : (
                  "Your Verified Attributes"
                )}
              </h2>
            </div>
            {isConnected && (
              <div style={{ display: "flex", gap: 8 }}>
                {(["dashboard", "marketplace", "leases"] as Section[]).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => setSection(s)}
                      className={section === s ? "btn-p" : "btn-g"}
                      style={{ padding: "7px 14px", fontSize: 12 }}
                    >
                      {s === "leases"
                        ? `Leases${leases.length ? ` (${leases.length})` : ""}`
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Not connected */}
          {!isConnected && (
            <div
              className="card"
              style={{ padding: "64px 24px", textAlign: "center" }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <h3
                style={{
                  fontFamily: "var(--fd)",
                  fontWeight: 700,
                  fontSize: "1.3rem",
                  marginBottom: 10,
                }}
              >
                Connect your wallet to get started
              </h3>
              <p
                className="mono"
                style={{
                  fontSize: 13,
                  color: "var(--t2)",
                  marginBottom: 24,
                  maxWidth: 400,
                  margin: "0 auto 24px",
                }}
              >
                Your Tier 1 on-chain attributes are verified automatically the
                moment you connect — no document upload needed.
              </p>
              <WalletBtn />
            </div>
          )}

          {/* Dashboard tab */}
          {isConnected && section === "dashboard" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <span className="tag tg">Tier 1 · On-chain</span>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--t3)" }}
                  >
                    Auto-verified from Base blockchain via Alchemy · GET
                    /api/verify/onchain
                  </span>
                </div>
                {loadingT1 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(220px,1fr))",
                      gap: 12,
                    }}
                  >
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="card shimmer"
                        style={{ height: 90 }}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(220px,1fr))",
                      gap: 12,
                    }}
                  >
                    {tier1.map((a) => (
                      <AttrCard key={a.attribute} a={a} />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <span className="tag tp">Tier 2 · ZK Proof</span>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--t3)" }}
                  >
                    Anon Aadhaar · proof generated locally · POST /api/verify/zk
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
                    gap: 12,
                  }}
                >
                  {tier2.map((a) => (
                    <AttrCard
                      key={a.attribute}
                      a={a}
                      onVerify={() => handleZKVerify(a.attribute)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Marketplace tab */}
          {isConnected && section === "marketplace" && (
            <div id="marketplace">
              <div
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid var(--b)",
                }}
              >
                <div
                  className="mono"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.6fr 1fr 1fr 0.7fr 0.7fr auto",
                    gap: 12,
                    padding: "10px 20px",
                    background: "var(--s2)",
                    borderBottom: "1px solid var(--b)",
                    fontSize: 11,
                    color: "var(--t3)",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                  }}
                >
                  <span>Company · Attribute</span>
                  <span>Duration</span>
                  <span>Reward</span>
                  <span>Slots</span>
                  <span>Expires</span>
                  <span />
                </div>
                {requests.length === 0 ? (
                  <div
                    className="mono"
                    style={{
                      padding: "48px 24px",
                      textAlign: "center",
                      color: "var(--t3)",
                      fontSize: 13,
                      background: "var(--bg)",
                    }}
                  >
                    No matching requests. Polling every 15s — GET
                    /api/match/requests
                  </div>
                ) : (
                  requests.map((req, i) => {
                    const pending = pendingId === req.onChainId
                    const writing = pending && (isWritePending || isConfirming)
                    return (
                      <div
                        key={req.onChainId}
                        className="card"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.6fr 1fr 1fr 0.7fr 0.7fr auto",
                          gap: 12,
                          padding: "16px 20px",
                          alignItems: "center",
                          borderRadius: 0,
                          borderLeft: "none",
                          borderRight: "none",
                          borderTop: "none",
                          borderBottom:
                            i < requests.length - 1
                              ? "1px solid var(--b)"
                              : "none",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              fontFamily: "var(--fd)",
                              fontWeight: 700,
                              fontSize: 14,
                              margin: "0 0 2px",
                            }}
                          >
                            {req.buyerName}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              className="mono"
                              style={{ fontSize: 12, color: "var(--t2)" }}
                            >
                              {req.attributeLabel}
                            </span>
                            {!req.aiAllowed && (
                              <span className="tag tp" style={{ fontSize: 9 }}>
                                ZK only
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className="mono"
                          style={{ fontSize: 13, color: "var(--t2)" }}
                        >
                          {fmtDur(req.leaseDurationSec)}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--fd)",
                            fontWeight: 700,
                            fontSize: 15,
                            color: "var(--accent)",
                          }}
                        >
                          {req.pricePerUser} ETH
                        </span>
                        <div>
                          <span
                            className="mono"
                            style={{ fontSize: 12, color: "var(--t2)" }}
                          >
                            {req.maxUsers - req.filledCount} left
                          </span>
                          <div
                            style={{
                              marginTop: 4,
                              height: 3,
                              background: "var(--b)",
                              borderRadius: 2,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${(req.filledCount / req.maxUsers) * 100}%`,
                                background: "var(--accent)",
                                borderRadius: 2,
                                opacity: 0.35,
                              }}
                            />
                          </div>
                        </div>
                        <span
                          className="mono"
                          style={{
                            fontSize: 12,
                            color: urgencyColor(req.expiresAt),
                          }}
                        >
                          {fmtCountdown(req.expiresAt)}
                        </span>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={pending}
                          className="btn-p"
                          style={{
                            padding: "8px 16px",
                            fontSize: 12,
                            minWidth: 92,
                          }}
                        >
                          {writing
                            ? "Confirming…"
                            : pending
                              ? "Sending…"
                              : "Approve →"}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
              <p
                className="mono"
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "var(--t3)",
                  textAlign: "center",
                }}
              >
                approveLease() · minConfidence enforced on-chain · aiAllowed
                buyers gated per cert method
              </p>
            </div>
          )}

          {/* Leases tab */}
          {isConnected && section === "leases" && (
            <div>
              {leases.length === 0 ? (
                <div
                  className="card"
                  style={{ padding: "48px 24px", textAlign: "center" }}
                >
                  <p
                    className="mono"
                    style={{ color: "var(--t3)", fontSize: 13 }}
                  >
                    No active leases. Approve a marketplace request to start
                    earning.
                  </p>
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                  {leases.map((l) => {
                    const total = l.expiresAt.getTime() - l.startedAt.getTime()
                    const elapsed = Date.now() - l.startedAt.getTime()
                    const pct = Math.min(100, (elapsed / total) * 100)
                    const done = l.status !== "Active"
                    return (
                      <div
                        key={l.leaseId}
                        className={`card ${l.status === "Active" ? "card-hi" : ""}`}
                        style={{ padding: "20px 22px" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: 12,
                            marginBottom: 14,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "var(--fd)",
                                  fontWeight: 700,
                                  fontSize: 15,
                                }}
                              >
                                {l.attributeLabel}
                              </span>
                              <span
                                className={`tag ${l.status === "Active" ? "tg" : l.status === "Revoked" ? "tr" : "tp"}`}
                              >
                                {l.status}
                              </span>
                            </div>
                            <p
                              className="mono"
                              style={{
                                fontSize: 12,
                                color: "var(--t2)",
                                margin: 0,
                              }}
                            >
                              {l.buyerName} · Lease #{l.leaseId} ·{" "}
                              <span style={{ color: "var(--accent)" }}>
                                {l.paidAmountEth} ETH
                              </span>{" "}
                              in escrow
                            </p>
                          </div>
                          {!done &&
                            (revokeId === l.leaseId ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <span
                                  className="mono"
                                  style={{ fontSize: 12, color: "var(--red)" }}
                                >
                                  Forfeit {l.paidAmountEth} ETH?
                                </span>
                                <button
                                  className="btn-d"
                                  style={{ padding: "5px 10px", fontSize: 12 }}
                                  onClick={() => handleRevoke(l.leaseId)}
                                >
                                  Confirm
                                </button>
                                <button
                                  className="btn-g"
                                  style={{ padding: "5px 10px", fontSize: 12 }}
                                  onClick={() => setRevokeId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                className="btn-d"
                                style={{ padding: "6px 12px", fontSize: 12 }}
                                onClick={() => setRevokeId(l.leaseId)}
                              >
                                Revoke Lease
                              </button>
                            ))}
                        </div>
                        {!done && (
                          <div style={{ marginBottom: 14 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: 5,
                              }}
                            >
                              <span
                                className="mono"
                                style={{ fontSize: 11, color: "var(--t3)" }}
                              >
                                Lease progress
                              </span>
                              <span
                                className="mono"
                                style={{ fontSize: 11, color: "var(--t3)" }}
                              >
                                Expires {fmtCountdown(l.expiresAt)}
                              </span>
                            </div>
                            <div
                              style={{
                                height: 3,
                                background: "var(--b)",
                                borderRadius: 2,
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${pct}%`,
                                  background: "var(--accent)",
                                  borderRadius: 2,
                                  transition: "width 1s",
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {l.content && l.status !== "Revoked" && (
                          <div
                            style={{
                              padding: "14px 16px",
                              background: "var(--s2)",
                              borderRadius: 8,
                              border: "1px solid var(--b)",
                            }}
                          >
                            <p
                              className="mono"
                              style={{
                                fontSize: 10,
                                color: "var(--t3)",
                                marginBottom: 6,
                                textTransform: "uppercase",
                                letterSpacing: ".08em",
                              }}
                            >
                              Content from {l.buyerName}
                            </p>
                            <p
                              style={{
                                fontFamily: "var(--fd)",
                                fontWeight: 700,
                                fontSize: 14,
                                marginBottom: 5,
                              }}
                            >
                              {l.content.title}
                            </p>
                            <p
                              className="mono"
                              style={{
                                fontSize: 12,
                                color: "var(--t2)",
                                lineHeight: 1.6,
                                marginBottom: l.content.ctaLabel ? 12 : 0,
                              }}
                            >
                              {l.content.body}
                            </p>
                            {l.content.ctaLabel && (
                              <a href={l.content.ctaUrl ?? "#"}>
                                <button
                                  className="btn-g"
                                  style={{ padding: "6px 14px", fontSize: 12 }}
                                >
                                  {l.content.ctaLabel} →
                                </button>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ===== ZK PROOF MODAL ===== */}
      {proofState !== "idle" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(3,3,10,.85)",
            backdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            className="card"
            style={{ maxWidth: 440, width: "100%", padding: "32px 28px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--fd)",
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                Anon Aadhaar ZK Verification
              </span>
              {proofState === "done" && (
                <button
                  onClick={() => setProofState("idle")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--t3)",
                    cursor: "pointer",
                    fontSize: 20,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <ZKOrb state={proofState} />
            </div>
            <div
              className="mono"
              style={{
                background: "var(--s2)",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 12,
                color: "var(--t2)",
                minHeight: 80,
                border: "1px solid var(--b)",
              }}
            >
              {proofLog.map((line, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 3,
                    color: i === proofLog.length - 1 ? "var(--t)" : "var(--t2)",
                  }}
                >
                  <span style={{ color: "var(--t3)" }}>$ </span>
                  {line}
                </div>
              ))}
              {proofState !== "done" && proofState !== "error" && (
                <span className="blink" style={{ color: "var(--accent)" }}>
                  _
                </span>
              )}
            </div>
            {proofState === "done" && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  background: "var(--adim)",
                  border: "1px solid var(--amid)",
                  borderRadius: 8,
                }}
              >
                <p
                  className="mono"
                  style={{ fontSize: 12, color: "var(--accent)", margin: 0 }}
                >
                  ✓ Certificate minted on Base Sepolia. Attribute unlocked for
                  leasing.
                </p>
              </div>
            )}
            <p
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--t3)",
                marginTop: 12,
                textAlign: "center",
              }}
            >
              Proof generated locally · Aadhaar number never leaves your device
            </p>
          </div>
        </div>
      )}

      {/* ===== PROBLEM / SOLUTION ===== */}
      <section
        style={{
          padding: "100px 24px",
          background: "var(--surface)",
          borderTop: "1px solid var(--b)",
          borderBottom: "1px solid var(--b)",
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
            gap: 20,
          }}
        >
          {[
            {
              cls: "tr",
              tag: "Today",
              title: "You share everything. Companies store everything.",
              color: "var(--red)",
              icon: "✕",
              items: [
                "Submit full Aadhaar just to prove you exist",
                "Upload salary slips to prove income",
                "Share DOB just to confirm you're 23+",
                "Repeat this for every company, every time",
                "Get nothing. Companies sell your data.",
              ],
            },
            {
              cls: "tg",
              tag: "Meridian",
              title: (
                <>
                  Prove the claim.
                  <br />
                  <span style={{ color: "var(--accent)" }}>
                    Keep the data. Get paid.
                  </span>
                </>
              ),
              color: "var(--accent)",
              icon: "✓",
              items: [
                "Prove age ≥ 23 without revealing birthdate",
                "Prove income ≥ ₹21 LPA without salary slips",
                "Prove Aadhaar ownership without the number",
                "One SBT credential. Infinite time-bounded leases.",
                "Companies pay you. You keep your data.",
              ],
            },
          ].map((col) => (
            <div
              key={col.tag}
              className={`card ${col.tag === "Meridian" ? "card-hi" : ""}`}
              style={{ padding: "28px 26px" }}
            >
              <span className={`tag ${col.cls}`} style={{ marginBottom: 16 }}>
                {col.tag}
              </span>
              <h3
                style={{
                  fontFamily: "var(--fd)",
                  fontWeight: 800,
                  fontSize: "1.5rem",
                  marginBottom: 16,
                  lineHeight: 1.2,
                }}
              >
                {col.title}
              </h3>
              <ul
                className="mono"
                style={{
                  listStyle: "none",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  fontSize: 13,
                  color: "var(--t2)",
                }}
              >
                {col.items.map((t) => (
                  <li key={t} style={{ display: "flex", gap: 10 }}>
                    <span style={{ color: col.color, flexShrink: 0 }}>
                      {col.icon}
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ===== WHAT BUYERS GET ===== */}
      <section style={{ padding: "100px 24px" }}>
        <div style={S}>
          <p className="sl" style={{ textAlign: "center" }}>
            For Companies
          </p>
          <h2
            style={{
              fontFamily: "var(--fd)",
              fontWeight: 900,
              fontSize: "clamp(1.8rem,3.5vw,2.8rem)",
              textAlign: "center",
              marginBottom: 10,
              letterSpacing: "-.02em",
            }}
          >
            What buyers actually receive
          </h2>
          <p
            className="mono"
            style={{
              textAlign: "center",
              color: "var(--t2)",
              fontSize: 13,
              marginBottom: 48,
            }}
          >
            No raw identity data. No wallet addresses. No individual records.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
              gap: 16,
            }}
          >
            {[
              {
                icon: "📊",
                t: "Aggregate Stats with Differential Privacy",
                c: "var(--purple)",
                d: "Mean, median, quartiles for matched segment. Laplace noise (ε=1.0) applied. Individual records cannot be reverse-engineered.",
              },
              {
                icon: "📢",
                t: "Content Delivery Access",
                c: "var(--accent)",
                d: "Push offers, ads, or surveys to matched users inside the Meridian dashboard for the active lease duration. Buyer never knows who acted.",
              },
              {
                icon: "⛓",
                t: "On-chain Lease Record",
                c: "var(--amber)",
                d: "LeaseApproved event: leaseId, attributeCategory, confidence, expiry. Verifiable on Basescan. Zero personal identifiers.",
              },
            ].map((it) => (
              <div key={it.t} className="card" style={{ padding: "22px 20px" }}>
                <span
                  style={{ fontSize: 26, marginBottom: 14, display: "block" }}
                >
                  {it.icon}
                </span>
                <h4
                  style={{
                    fontFamily: "var(--fd)",
                    fontWeight: 700,
                    fontSize: "1rem",
                    marginBottom: 8,
                    color: it.c,
                  }}
                >
                  {it.t}
                </h4>
                <p
                  className="mono"
                  style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.65 }}
                >
                  {it.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOOTER / CTA ===== */}
      <footer
        style={{
          padding: "100px 24px 48px",
          background: "var(--surface)",
          borderTop: "1px solid var(--b)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center,rgba(0,229,160,.04) 0%,transparent 65%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            maxWidth: 620,
            margin: "0 auto",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--fd)",
              fontWeight: 900,
              fontSize: "clamp(2rem,5vw,3.8rem)",
              letterSpacing: "-.03em",
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            From document sharing
            <br />
            to{" "}
            <span
              style={{
                color: "var(--accent)",
                textShadow: "0 0 40px rgba(0,229,160,.4)",
              }}
            >
              cryptographic proofs.
            </span>
          </h2>
          <p
            className="mono"
            style={{
              color: "var(--t2)",
              fontSize: 14,
              lineHeight: 1.7,
              marginBottom: 36,
            }}
          >
            Connect your wallet. Tier 1 attributes verified in seconds — no
            upload, no waiting. Add Anon Aadhaar to unlock higher-paying ZK
            leases.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 64,
            }}
          >
            <WalletBtn />
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button
                className="btn-g"
                style={{ padding: "11px 22px", fontSize: 14 }}
              >
                GitHub →
              </button>
            </a>
          </div>
          <hr className="div" style={{ marginBottom: 28 }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="3.5" fill="#03030A" />
                  <path
                    d="M9 1v3M9 14v3M1 9h3M14 9h3"
                    stroke="#03030A"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span
                style={{
                  fontFamily: "var(--fd)",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                Meridian
              </span>
            </div>
            <span className="mono" style={{ fontSize: 12, color: "var(--t3)" }}>
              Built on Base · Privacy-first data ownership ·{" "}
              {new Date().getFullYear()}
            </span>
            <div
              className="mono"
              style={{
                display: "flex",
                gap: 18,
                fontSize: 12,
                color: "var(--t3)",
              }}
            >
              <a
                href="https://sepolia.basescan.org"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                Basescan
              </a>
              <a href="#" style={{ color: "inherit", textDecoration: "none" }}>
                Docs
              </a>
              <a href="#" style={{ color: "inherit", textDecoration: "none" }}>
                Twitter
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
