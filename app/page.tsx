"use client"

import { useState, useEffect, useRef } from "react"
import { Syne, IBM_Plex_Mono } from "next/font/google"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
})
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
})

// ============================================================
// MOCK DATA — TODO: Replace each block with real API calls
// ============================================================

// TODO: GET /api/stats
const MOCK_STATS = {
  totalProofsGenerated: 148_293,
  activeUsers: 12_041,
  companiesOnboarded: 87,
  totalPayouts: "₹2.4 Cr",
}

// TODO: GET /api/marketplace/requests
const MOCK_MARKETPLACE_REQUESTS = [
  {
    id: "req_001",
    company: "FinEdge Capital",
    attribute: "Age ≥ 23",
    category: "KYC",
    reward: "₹120",
    expiry: "2h 14m",
    urgency: "high",
  },
  {
    id: "req_002",
    company: "Kreditbee",
    attribute: "Income ≥ ₹21 LPA",
    category: "Loan Eligibility",
    reward: "₹350",
    expiry: "6h 02m",
    urgency: "medium",
  },
  {
    id: "req_003",
    company: "Cred",
    attribute: "Aadhaar Ownership",
    category: "Identity",
    reward: "₹80",
    expiry: "18h 30m",
    urgency: "low",
  },
  {
    id: "req_004",
    company: "Zerodha",
    attribute: "Income ≥ ₹10 LPA",
    category: "Trading Access",
    reward: "₹200",
    expiry: "1h 45m",
    urgency: "high",
  },
]

// TODO: GET /api/credentials/user — replace with wallet-authenticated call
const MOCK_USER_CREDENTIALS = [
  {
    id: "cred_age",
    label: "Age ≥ 23",
    issuer: "DigiLocker",
    verified: true,
    confidence: 99,
  },
  {
    id: "cred_income",
    label: "Income ≥ ₹21 LPA",
    issuer: "CBDT",
    verified: true,
    confidence: 97,
  },
  {
    id: "cred_aadhaar",
    label: "Aadhaar Ownership",
    issuer: "UIDAI",
    verified: true,
    confidence: 100,
  },
]

// TODO: POST /api/proof/generate — currently mocks the ZK proof flow
async function generateProof(
  credentialId: string,
  condition: string
): Promise<string> {
  // Replace with actual zkSNARK proof generation call
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve("0x" + Math.random().toString(16).slice(2, 18).toUpperCase()),
      2200
    )
  )
}

// TODO: POST /api/marketplace/accept — accepts a request and triggers escrow
async function acceptMarketplaceRequest(
  requestId: string,
  proofHash: string
): Promise<boolean> {
  // Replace with smart contract call via wagmi/ethers
  return new Promise((resolve) => setTimeout(() => resolve(true), 1200))
}

// ============================================================
// TYPES
// ============================================================

type Stats = typeof MOCK_STATS
type MarketplaceRequest = (typeof MOCK_MARKETPLACE_REQUESTS)[0]
type Credential = (typeof MOCK_USER_CREDENTIALS)[0]
type ProofState = "idle" | "generating" | "done"

// ============================================================
// ANIMATIONS (CSS injected via style tag)
// ============================================================

const GLOBAL_STYLES = `
  :root {
    --bg: #03030A;
    --surface: #0B0B14;
    --surface-2: #11111E;
    --border: #1C1C2E;
    --border-glow: #2A2A50;
    --accent: #00E5A0;
    --accent-dim: rgba(0,229,160,0.12);
    --accent-glow: 0 0 20px rgba(0,229,160,0.3);
    --purple: #7B6EF6;
    --purple-dim: rgba(123,110,246,0.12);
    --text: #E0E0F0;
    --text-2: #8888AA;
    --text-3: #444466;
    --font-display: var(--font-syne);
    --font-code: var(--font-mono);
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: 0.6; }
    100% { transform: scale(2.2); opacity: 0;   }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes spin-reverse {
    from { transform: rotate(0deg); }
    to   { transform: rotate(-360deg); }
  }
  @keyframes dash {
    to { stroke-dashoffset: -200; }
  }
  @keyframes ticker {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes node-pulse {
    0%, 100% { r: 5; opacity: 1; }
    50%       { r: 8; opacity: 0.7; }
  }

  .animate-fade-up { animation: fadeUp 0.7s ease forwards; }
  .animate-fade-in { animation: fadeIn 0.5s ease forwards; }
  .delay-1 { animation-delay: 0.1s; opacity: 0; }
  .delay-2 { animation-delay: 0.25s; opacity: 0; }
  .delay-3 { animation-delay: 0.4s; opacity: 0; }
  .delay-4 { animation-delay: 0.55s; opacity: 0; }
  .delay-5 { animation-delay: 0.7s; opacity: 0; }

  .ticker-track { animation: ticker 28s linear infinite; }

  .proof-ring-1 { animation: pulse-ring 2s ease-out infinite; }
  .proof-ring-2 { animation: pulse-ring 2s ease-out infinite 0.7s; }
  .proof-ring-3 { animation: pulse-ring 2s ease-out infinite 1.4s; }

  .orbit-1 { animation: spin-slow 12s linear infinite; }
  .orbit-2 { animation: spin-reverse 8s linear infinite; }

  .dash-path { animation: dash 3s linear infinite; }

  .cursor-blink { animation: blink 1s step-end infinite; }

  .shimmer-bar {
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--border-glow) 50%, var(--surface-2) 75%);
    background-size: 400px 100%;
    animation: shimmer 1.5s infinite;
  }

  .card-hover {
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }
  .card-hover:hover {
    border-color: var(--border-glow);
    box-shadow: 0 0 0 1px var(--border-glow), 0 8px 32px rgba(0,0,0,0.4);
    transform: translateY(-2px);
  }

  .accent-glow-btn {
    box-shadow: 0 0 0 0 rgba(0,229,160,0);
    transition: box-shadow 0.3s ease;
  }
  .accent-glow-btn:hover {
    box-shadow: 0 0 24px rgba(0,229,160,0.35);
  }

  .grid-bg {
    background-image:
      linear-gradient(rgba(28,28,46,0.5) 1px, transparent 1px),
      linear-gradient(90deg, rgba(28,28,46,0.5) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  .noise::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 1;
  }

  .proof-node { animation: node-pulse 2s ease-in-out infinite; }
`

// ============================================================
// SUB-COMPONENTS (inline for hackathon, one-file rule)
// ============================================================

function ZKOrb({ state }: { state: ProofState }) {
  const color =
    state === "done"
      ? "#00E5A0"
      : state === "generating"
        ? "#7B6EF6"
        : "#2A2A50"
  const glowColor =
    state === "done"
      ? "rgba(0,229,160,0.4)"
      : state === "generating"
        ? "rgba(123,110,246,0.4)"
        : "transparent"

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 180, height: 180 }}
    >
      {state === "generating" && (
        <>
          <div
            className="proof-ring-1 absolute rounded-full"
            style={{
              width: 60,
              height: 60,
              background: "rgba(123,110,246,0.15)",
              border: "1px solid rgba(123,110,246,0.3)",
            }}
          />
          <div
            className="proof-ring-2 absolute rounded-full"
            style={{
              width: 60,
              height: 60,
              background: "rgba(123,110,246,0.15)",
              border: "1px solid rgba(123,110,246,0.3)",
            }}
          />
          <div
            className="proof-ring-3 absolute rounded-full"
            style={{
              width: 60,
              height: 60,
              background: "rgba(123,110,246,0.15)",
              border: "1px solid rgba(123,110,246,0.3)",
            }}
          />
        </>
      )}
      {state !== "idle" && (
        <div
          className="orbit-1 absolute rounded-full"
          style={{ width: 130, height: 130, border: `1px dashed ${color}50` }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 8,
              height: 8,
              background: color,
              top: -4,
              left: "50%",
              transform: "translateX(-50%)",
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        </div>
      )}
      {state !== "idle" && (
        <div
          className="orbit-2 absolute rounded-full"
          style={{ width: 100, height: 100, border: `1px dashed ${color}30` }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 6,
              height: 6,
              background: glowColor,
              bottom: -3,
              left: "50%",
              transform: "translateX(-50%)",
              boxShadow: `0 0 6px ${glowColor}`,
            }}
          />
        </div>
      )}
      <div
        className="absolute rounded-full transition-all duration-700"
        style={{
          width: 64,
          height: 64,
          background: `radial-gradient(circle at 35% 35%, ${color}40, ${color}10)`,
          border: `2px solid ${color}`,
          boxShadow:
            state !== "idle"
              ? `0 0 30px ${glowColor}, 0 0 60px ${glowColor}50`
              : "none",
        }}
      >
        {state === "idle" && (
          <span
            style={{
              fontSize: 22,
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
            }}
          >
            🔒
          </span>
        )}
        {state === "generating" && (
          <span
            style={{
              fontSize: 22,
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
            }}
          >
            ⚡
          </span>
        )}
        {state === "done" && (
          <span
            style={{
              fontSize: 22,
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
            }}
          >
            ✓
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function LandingPage() {
  // ----------------------------------------------------------
  // State — swap MOCK_ constants with API responses here
  // ----------------------------------------------------------
  const [stats, setStats] = useState<Stats>(MOCK_STATS)
  const [requests, setRequests] = useState<MarketplaceRequest[]>(
    MOCK_MARKETPLACE_REQUESTS
  )
  const [credentials] = useState<Credential[]>(MOCK_USER_CREDENTIALS)
  const [proofState, setProofState] = useState<ProofState>("idle")
  const [activeProofId, setActiveProofId] = useState<string | null>(null)
  const [proofHash, setProofHash] = useState<string>("")
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddr] = useState("0xA3f2...8e1D") // TODO: get from wagmi useAccount
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ----------------------------------------------------------
  // Data fetching — TODO: uncomment and wire to real endpoints
  // ----------------------------------------------------------
  useEffect(() => {
    // TODO: fetchStats().then(setStats);
    // TODO: fetchMarketplaceRequests().then(setRequests);

    // Mock: live counter tick
    statsTimerRef.current = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        totalProofsGenerated:
          prev.totalProofsGenerated + Math.floor(Math.random() * 3),
      }))
    }, 2000)
    return () => {
      if (statsTimerRef.current) clearInterval(statsTimerRef.current)
    }
  }, [])

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------

  // TODO: Replace with actual zkSNARK proof generation + on-chain verify
  const handleGenerateProof = async (credId: string, condition: string) => {
    setActiveProofId(credId)
    setProofState("generating")
    setProofHash("")
    const hash = await generateProof(credId, condition)
    setProofHash(hash)
    setProofState("done")
  }

  // TODO: Replace with smart contract interaction (wagmi writeContract)
  const handleAcceptRequest = async (reqId: string) => {
    if (!proofHash) return
    await acceptMarketplaceRequest(reqId, proofHash)
    setRequests((prev) => prev.filter((r) => r.id !== reqId))
  }

  // TODO: Replace with wagmi connect modal (e.g., RainbowKit)
  const handleConnectWallet = () => setWalletConnected(true)

  const resetProof = () => {
    setProofState("idle")
    setActiveProofId(null)
    setProofHash("")
  }

  const urgencyColor: Record<string, string> = {
    high: "#FF6B6B",
    medium: "#FFB347",
    low: "#00E5A0",
  }

  return (
    <div
      className={`${syne.variable} ${mono.variable} relative min-h-screen overflow-x-hidden`}
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font-display)",
      }}
    >
      <style>{GLOBAL_STYLES}</style>

      {/* ======================================================
          NAV
      ====================================================== */}
      <nav
        className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(3,3,10,0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 34,
              height: 34,
              background: "var(--accent)",
              boxShadow: "var(--accent-glow)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="4" fill="#03030A" />
              <circle
                cx="9"
                cy="9"
                r="7.5"
                stroke="#03030A"
                strokeWidth="1.5"
              />
              <path
                d="M9 1.5v3M9 13.5v3M1.5 9h3M13.5 9h3"
                stroke="#03030A"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "-0.02em",
            }}
          >
            Meridian
          </span>
        </div>

        <div
          className="hidden items-center gap-8 md:flex"
          style={{
            fontFamily: "var(--font-code)",
            fontSize: 13,
            color: "var(--text-2)",
          }}
        >
          <a href="#how" className="transition-colors hover:text-white">
            How It Works
          </a>
          <a href="#demo" className="transition-colors hover:text-white">
            Demo
          </a>
          <a href="#marketplace" className="transition-colors hover:text-white">
            Marketplace
          </a>
          <a
            href="#architecture"
            className="transition-colors hover:text-white"
          >
            Architecture
          </a>
        </div>

        <div className="flex items-center gap-3">
          {walletConnected ? (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{
                background: "var(--accent-dim)",
                border: "1px solid var(--accent)30",
                fontFamily: "var(--font-code)",
                fontSize: 12,
                color: "var(--accent)",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 0 6px var(--accent)",
                }}
              />
              {walletAddr}
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              className="accent-glow-btn rounded-lg px-4 py-2 text-sm font-semibold transition-all"
              style={{
                background: "var(--accent)",
                color: "#03030A",
                fontFamily: "var(--font-code)",
                fontSize: 13,
              }}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* ======================================================
          HERO
      ====================================================== */}
      <section
        id="hero"
        className="grid-bg noise relative flex min-h-screen flex-col items-center justify-evenly overflow-hidden px-6 pt-24 text-center"
        style={{ paddingTop: "8rem", paddingBottom: "6rem" }}
      >
        {/* Glow blobs */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 500,
            height: 500,
            background:
              "radial-gradient(circle, rgba(123,110,246,0.08) 0%, transparent 70%)",
            top: "10%",
            left: "5%",
          }}
        />
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 400,
            height: 400,
            background:
              "radial-gradient(circle, rgba(0,229,160,0.07) 0%, transparent 70%)",
            bottom: "10%",
            right: "5%",
          }}
        />

        <div className="animate-fade-up mb-5 delay-1">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs tracking-widest uppercase"
            style={{
              background: "var(--accent-dim)",
              border: "1px solid rgba(0,229,160,0.25)",
              color: "var(--accent)",
              fontFamily: "var(--font-code)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            Zero Knowledge · Verifiable Credentials · On-chain
          </span>
        </div>

        <h1
          className="animate-fade-up leading-none font-black tracking-tighter delay-2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3rem, 8vw, 7rem)",
            maxWidth: 900,
          }}
        >
          Prove Without
          <br />
          <span
            style={{
              color: "var(--accent)",
              textShadow: "0 0 60px rgba(0,229,160,0.3)",
            }}
          >
            Revealing.
          </span>
        </h1>

        <p
          className="animate-fade-up mx-auto mt-6 max-w-xl leading-relaxed delay-3"
          style={{
            color: "var(--text-2)",
            fontSize: "clamp(1rem, 2vw, 1.15rem)",
          }}
        >
          Generate cryptographic proofs for your attributes. Companies get{" "}
          <span style={{ color: "var(--text)" }}>verified trust.</span> You keep{" "}
          <span style={{ color: "var(--accent)" }}>complete privacy.</span>
        </p>

        <div className="animate-fade-up mt-10 flex flex-wrap items-center justify-center gap-4 delay-4">
          <button
            onClick={handleConnectWallet}
            className="accent-glow-btn rounded-xl px-6 py-3 text-sm font-bold"
            style={{
              background: "var(--accent)",
              color: "#03030A",
              fontFamily: "var(--font-code)",
            }}
          >
            {walletConnected ? "Open Dashboard →" : "Start Proving →"}
          </button>
          <a
            href="#marketplace"
            className="rounded-xl px-6 py-3 text-sm font-semibold transition-all"
            style={{
              border: "1px solid var(--border-glow)",
              color: "var(--text-2)",
              fontFamily: "var(--font-code)",
            }}
          >
            View Marketplace
          </a>
        </div>
      </section>

      {/* ======================================================
          LIVE STATS TICKER
      ====================================================== */}
      <div
        className="relative overflow-hidden py-3"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="ticker-track flex gap-16 whitespace-nowrap"
          style={{
            width: "max-content",
            fontFamily: "var(--font-code)",
            fontSize: 13,
          }}
        >
          {[...Array(2)].map((_, i) => (
            <span key={i} className="flex items-center gap-16">
              <span
                className="flex items-center gap-2"
                style={{ color: "var(--text-2)" }}
              >
                <span style={{ color: "var(--accent)" }}>⬡</span>
                Total Proofs Generated
                <span className="font-bold" style={{ color: "var(--text)" }}>
                  {stats.totalProofsGenerated.toLocaleString("en-IN")}
                </span>
              </span>
              <span style={{ color: "var(--text-3)" }}>·</span>
              <span
                className="flex items-center gap-2"
                style={{ color: "var(--text-2)" }}
              >
                Active Users
                <span className="font-bold" style={{ color: "var(--text)" }}>
                  {stats.activeUsers.toLocaleString("en-IN")}
                </span>
              </span>
              <span style={{ color: "var(--text-3)" }}>·</span>
              <span
                className="flex items-center gap-2"
                style={{ color: "var(--text-2)" }}
              >
                Companies Onboarded
                <span className="font-bold" style={{ color: "var(--text)" }}>
                  {stats.companiesOnboarded}
                </span>
              </span>
              <span style={{ color: "var(--text-3)" }}>·</span>
              <span
                className="flex items-center gap-2"
                style={{ color: "var(--text-2)" }}
              >
                Total Payouts
                <span className="font-bold" style={{ color: "var(--accent)" }}>
                  {stats.totalPayouts}
                </span>
              </span>
              <span style={{ color: "var(--text-3)" }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ======================================================
          PROBLEM → SOLUTION
      ====================================================== */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="grid items-start gap-8 md:grid-cols-2">
          {/* Problem */}
          <div
            className="card-hover rounded-2xl p-8"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <span
                className="rounded px-2 py-0.5 text-xs font-bold tracking-widest uppercase"
                style={{
                  background: "rgba(255,107,107,0.12)",
                  color: "#FF6B6B",
                  fontFamily: "var(--font-code)",
                }}
              >
                Today
              </span>
              <span
                style={{
                  color: "var(--text-3)",
                  fontFamily: "var(--font-code)",
                  fontSize: 12,
                }}
              >
                The broken status quo
              </span>
            </div>
            <h3
              className="mb-4 leading-tight font-black"
              style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem" }}
            >
              You share everything. Companies store everything.
            </h3>
            <ul
              className="space-y-3"
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 13,
                color: "var(--text-2)",
              }}
            >
              {[
                "Submit full Aadhaar to prove you exist",
                "Upload salary slips to prove income",
                "Share DOB just to prove you're 23+",
                "Repeat this for every company",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span style={{ color: "#FF6B6B", marginTop: 2 }}>✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div
            className="card-hover rounded-2xl p-8"
            style={{
              background: "var(--surface)",
              border: "1px solid rgba(0,229,160,0.25)",
              boxShadow: "0 0 40px rgba(0,229,160,0.04)",
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <span
                className="rounded px-2 py-0.5 text-xs font-bold tracking-widest uppercase"
                style={{
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                  fontFamily: "var(--font-code)",
                }}
              >
                Meridian
              </span>
              <span
                style={{
                  color: "var(--text-3)",
                  fontFamily: "var(--font-code)",
                  fontSize: 12,
                }}
              >
                Proof, not disclosure
              </span>
            </div>
            <h3
              className="mb-4 leading-tight font-black"
              style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem" }}
            >
              Prove the claim.{" "}
              <span style={{ color: "var(--accent)" }}>Keep the data.</span>
            </h3>
            <ul
              className="space-y-3"
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 13,
                color: "var(--text-2)",
              }}
            >
              {[
                "Prove age ≥ 23 without revealing your birthdate",
                "Prove income ≥ ₹21 LPA without salary slips",
                "Prove Aadhaar ownership without the number",
                "One credential. Infinite proofs.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span style={{ color: "var(--accent)", marginTop: 2 }}>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ======================================================
          HOW IT WORKS
      ====================================================== */}
      <section
        id="how"
        className="px-6 py-20"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p
              className="mb-3 text-xs tracking-widest uppercase"
              style={{ fontFamily: "var(--font-code)", color: "var(--text-3)" }}
            >
              Protocol
            </p>
            <h2
              className="font-black tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
              }}
            >
              How Meridian Works
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              {
                step: "01",
                title: "Attribute Issuance",
                desc: "Trusted issuers (UIDAI, CBDT, DigiLocker) verify you once and mint a non-transferable soulbound credential on-chain.",
                icon: "🪪",
                accent: "#7B6EF6",
              },
              {
                step: "02",
                title: "Proof Generation",
                desc: "Your browser generates a zkSNARK proof locally. The raw document never leaves your device.",
                icon: "⚡",
                accent: "#00E5A0",
              },
              {
                step: "03",
                title: "On-chain Verification",
                desc: "Smart contracts verify the proof and register a nullifier, preventing double use without revealing data.",
                icon: "⛓",
                accent: "#FFB347",
              },
              {
                step: "04",
                title: "Consent & Payment",
                desc: "You approve company requests. Escrowed payment auto-releases on successful verification.",
                icon: "💸",
                accent: "#FF6B6B",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="card-hover flex flex-col gap-4 rounded-xl p-6"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{item.icon}</span>
                  <span
                    style={{
                      fontFamily: "var(--font-code)",
                      fontSize: 11,
                      color: "var(--text-3)",
                    }}
                  >
                    {item.step}
                  </span>
                </div>
                <div>
                  <h4
                    className="mb-2 font-bold"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1rem",
                      color: item.accent,
                    }}
                  >
                    {item.title}
                  </h4>
                  <p
                    style={{
                      fontFamily: "var(--font-code)",
                      fontSize: 12,
                      color: "var(--text-2)",
                      lineHeight: 1.6,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          INTERACTIVE PROOF DEMO
      ====================================================== */}
      <section id="demo" className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p
              className="mb-3 text-xs tracking-widest uppercase"
              style={{ fontFamily: "var(--font-code)", color: "var(--text-3)" }}
            >
              Try It
            </p>
            <h2
              className="font-black tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
              }}
            >
              Generate a Proof
            </h2>
            <p
              className="mt-3"
              style={{
                color: "var(--text-2)",
                fontFamily: "var(--font-code)",
                fontSize: 13,
              }}
            >
              Select a credential and generate a zero-knowledge proof locally
            </p>
          </div>

          <div
            className="overflow-hidden rounded-2xl"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            {/* Terminal header */}
            <div
              className="flex items-center gap-2 px-5 py-3"
              style={{
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: "#FF5F56" }}
              />
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: "#FFBD2E" }}
              />
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: "#27C93F" }}
              />
              <span
                className="ml-3"
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: 12,
                  color: "var(--text-3)",
                }}
              >
                meridian-proof-engine v0.1.0
              </span>
            </div>

            <div className="grid items-center gap-8 p-6 md:grid-cols-2 md:p-8">
              {/* Left: credential picker */}
              <div>
                <p
                  className="mb-4"
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: 12,
                    color: "var(--text-2)",
                  }}
                >
                  // Select credential to prove
                </p>
                <div className="space-y-3">
                  {credentials.map((cred) => {
                    const isActive = activeProofId === cred.id
                    return (
                      <button
                        key={cred.id}
                        onClick={() =>
                          proofState !== "generating" &&
                          handleGenerateProof(cred.id, cred.label)
                        }
                        disabled={proofState === "generating"}
                        className="w-full rounded-xl p-4 text-left transition-all"
                        style={{
                          background: isActive
                            ? "var(--accent-dim)"
                            : "var(--surface-2)",
                          border: `1px solid ${isActive ? "rgba(0,229,160,0.4)" : "var(--border)"}`,
                          cursor:
                            proofState === "generating"
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className="font-bold"
                            style={{
                              fontFamily: "var(--font-display)",
                              fontSize: 14,
                              color: isActive ? "var(--accent)" : "var(--text)",
                            }}
                          >
                            {cred.label}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-code)",
                              fontSize: 10,
                              color: "var(--text-3)",
                            }}
                          >
                            {cred.confidence}% conf
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-code)",
                            fontSize: 11,
                            color: "var(--text-3)",
                          }}
                        >
                          Issuer: {cred.issuer}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right: proof visualizer */}
              <div className="flex flex-col items-center gap-5">
                <ZKOrb state={activeProofId ? proofState : "idle"} />

                <div
                  className="text-center"
                  style={{ fontFamily: "var(--font-code)", fontSize: 12 }}
                >
                  {proofState === "idle" && (
                    <p style={{ color: "var(--text-3)" }}>
                      ← Select a credential to begin
                    </p>
                  )}
                  {proofState === "generating" && (
                    <p style={{ color: "#7B6EF6" }}>
                      Generating zkSNARK proof
                      <span className="cursor-blink">_</span>
                    </p>
                  )}
                  {proofState === "done" && (
                    <div>
                      <p style={{ color: "var(--accent)", marginBottom: 8 }}>
                        ✓ Proof generated successfully
                      </p>
                      <div
                        className="rounded-lg px-3 py-2 text-left"
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <p
                          style={{
                            color: "var(--text-3)",
                            fontSize: 10,
                            marginBottom: 4,
                          }}
                        >
                          PROOF HASH
                        </p>
                        <p
                          style={{
                            color: "var(--text-2)",
                            fontSize: 11,
                            wordBreak: "break-all",
                          }}
                        >
                          {proofHash}
                        </p>
                      </div>
                      <button
                        onClick={resetProof}
                        className="mt-3 text-xs"
                        style={{
                          color: "var(--text-3)",
                          textDecoration: "underline",
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          MARKETPLACE
      ====================================================== */}
      <section
        id="marketplace"
        className="px-6 py-20"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p
                className="mb-2 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "var(--font-code)",
                  color: "var(--text-3)",
                }}
              >
                Data Request Marketplace
              </p>
              <h2
                className="font-black tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)",
                }}
              >
                Companies Want Your Proofs
              </h2>
            </div>
            <span
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 12,
                color: "var(--text-3)",
              }}
            >
              {requests.length} active request{requests.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div
            className="overflow-hidden rounded-2xl"
            style={{ border: "1px solid var(--border)" }}
          >
            {/* Table header */}
            <div
              className="grid px-5 py-3 text-xs tracking-widest uppercase"
              style={{
                gridTemplateColumns: "1fr 1fr 1fr auto auto",
                gap: "1rem",
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--border)",
                fontFamily: "var(--font-code)",
                color: "var(--text-3)",
              }}
            >
              <span>Company</span>
              <span>Attribute</span>
              <span>Category</span>
              <span>Expires</span>
              <span>Reward</span>
            </div>

            {requests.length === 0 ? (
              <div
                className="py-16 text-center"
                style={{
                  fontFamily: "var(--font-code)",
                  color: "var(--text-3)",
                  fontSize: 13,
                }}
              >
                No active requests. Check back soon.
              </div>
            ) : (
              requests.map((req, i) => (
                <div
                  key={req.id}
                  className="card-hover grid items-center px-5 py-4 transition-all"
                  style={{
                    gridTemplateColumns: "1fr 1fr 1fr auto auto",
                    gap: "1rem",
                    borderBottom:
                      i < requests.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    background: "var(--bg)",
                  }}
                >
                  <span
                    className="font-bold"
                    style={{ fontFamily: "var(--font-display)", fontSize: 14 }}
                  >
                    {req.company}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-code)",
                      fontSize: 13,
                      color: "var(--text-2)",
                    }}
                  >
                    {req.attribute}
                  </span>
                  <span
                    className="inline-block rounded px-2 py-0.5 text-xs"
                    style={{
                      fontFamily: "var(--font-code)",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-2)",
                      width: "fit-content",
                    }}
                  >
                    {req.category}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-code)",
                      fontSize: 12,
                      color: urgencyColor[req.urgency],
                    }}
                  >
                    {req.expiry}
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      className="font-bold"
                      style={{
                        fontFamily: "var(--font-code)",
                        fontSize: 14,
                        color: "var(--accent)",
                      }}
                    >
                      {req.reward}
                    </span>
                    <button
                      onClick={() => handleAcceptRequest(req.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
                      style={{
                        background:
                          proofState === "done"
                            ? "var(--accent)"
                            : "var(--surface-2)",
                        color:
                          proofState === "done" ? "#03030A" : "var(--text-3)",
                        border: `1px solid ${proofState === "done" ? "var(--accent)" : "var(--border)"}`,
                        cursor:
                          proofState === "done" ? "pointer" : "not-allowed",
                        fontFamily: "var(--font-code)",
                      }}
                      title={
                        proofState !== "done"
                          ? "Generate a proof first"
                          : "Accept and earn"
                      }
                    >
                      {proofState === "done" ? "Accept →" : "Locked"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <p
            className="mt-4 text-center"
            style={{
              fontFamily: "var(--font-code)",
              fontSize: 12,
              color: "var(--text-3)",
            }}
          >
            Generate a proof in the demo above to unlock Accept buttons
          </p>
        </div>
      </section>

      {/* ======================================================
          ARCHITECTURE
      ====================================================== */}
      <section id="architecture" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p
              className="mb-3 text-xs tracking-widest uppercase"
              style={{ fontFamily: "var(--font-code)", color: "var(--text-3)" }}
            >
              System Design
            </p>
            <h2
              className="font-black tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
              }}
            >
              Architecture
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                layer: "Frontend",
                color: "#7B6EF6",
                items: [
                  "Next.js + Wagmi wallet integration",
                  "Local zkSNARK proof generation",
                  "Credential dashboard",
                  "Marketplace UI",
                ],
              },
              {
                layer: "On-chain",
                color: "#00E5A0",
                items: [
                  "Contract A: Soulbound Attribute Tokens",
                  "Contract B: Escrow & Approvals",
                  "ZK Verifier with nullifier registry",
                  "Proof replay prevention",
                ],
              },
              {
                layer: "Off-chain Services",
                color: "#FFB347",
                items: [
                  "DigiLocker / UIDAI verification APIs",
                  "Document AI fallback verifier",
                  "Request matching engine",
                  "Issuer oracle network",
                ],
              },
            ].map((col, i) => (
              <div
                key={i}
                className="card-hover rounded-xl p-6"
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${col.color}30`,
                }}
              >
                <div className="mb-5 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background: col.color,
                      boxShadow: `0 0 8px ${col.color}`,
                    }}
                  />
                  <span
                    className="text-xs font-bold tracking-widest uppercase"
                    style={{ fontFamily: "var(--font-code)", color: col.color }}
                  >
                    {col.layer}
                  </span>
                </div>
                <ul className="space-y-3">
                  {col.items.map((item, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2"
                      style={{
                        fontFamily: "var(--font-code)",
                        fontSize: 12,
                        color: "var(--text-2)",
                      }}
                    >
                      <span style={{ color: col.color, marginTop: 2 }}>›</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          USE CASE PROOFS
      ====================================================== */}
      <section
        className="px-6 py-20"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p
              className="mb-3 text-xs tracking-widest uppercase"
              style={{ fontFamily: "var(--font-code)", color: "var(--text-3)" }}
            >
              Use Cases
            </p>
            <h2
              className="font-black tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
              }}
            >
              What You Can Prove
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                emoji: "🎂",
                title: "Age Verification",
                proof: "age ≥ 23",
                from: "DOB: 14 Mar 2001",
                useCase: "Fintech KYC, alcohol e-commerce, financial products",
                issuer: "DigiLocker",
              },
              {
                emoji: "💰",
                title: "Income Threshold",
                proof: "income ≥ ₹21 LPA",
                from: "Salary: ₹2,10,000/mo",
                useCase: "Loan eligibility, premium card access, trading",
                issuer: "CBDT",
              },
              {
                emoji: "🪪",
                title: "Identity Proof",
                proof: "Aadhaar ownership = true",
                from: "Aadhaar: XXXX-XXXX-8821",
                useCase: "Onboarding, government services, e-KYC",
                issuer: "UIDAI",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="card-hover overflow-hidden rounded-2xl"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* From: raw data */}
                <div
                  className="px-5 pt-5 pb-4"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <p
                    className="mb-2 text-xs tracking-wider uppercase"
                    style={{
                      fontFamily: "var(--font-code)",
                      color: "var(--text-3)",
                    }}
                  >
                    Raw Input (stays private)
                  </p>
                  <div
                    className="rounded-lg px-3 py-2"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-code)",
                        fontSize: 13,
                        color: "#FF6B6B",
                      }}
                    >
                      {item.from}
                    </p>
                  </div>
                </div>

                {/* ZK transformation */}
                <div
                  className="py-3 text-center"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-code)",
                      fontSize: 11,
                      color: "var(--text-3)",
                    }}
                  >
                    ↓ zkSNARK circuit
                  </p>
                </div>

                {/* Proof output */}
                <div
                  className="px-5 py-4"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <p
                    className="mb-2 text-xs tracking-wider uppercase"
                    style={{
                      fontFamily: "var(--font-code)",
                      color: "var(--text-3)",
                    }}
                  >
                    Proof Output (public)
                  </p>
                  <div
                    className="rounded-lg px-3 py-2"
                    style={{
                      background: "var(--accent-dim)",
                      border: "1px solid rgba(0,229,160,0.3)",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-code)",
                        fontSize: 13,
                        color: "var(--accent)",
                        fontWeight: 700,
                      }}
                    >
                      ✓ {item.proof}
                    </p>
                  </div>
                </div>

                {/* Meta */}
                <div className="px-5 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xl">{item.emoji}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-code)",
                        fontSize: 11,
                        color: "var(--text-3)",
                      }}
                    >
                      Issuer: {item.issuer}
                    </span>
                  </div>
                  <h4
                    className="mb-1 font-bold"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1rem",
                    }}
                  >
                    {item.title}
                  </h4>
                  <p
                    style={{
                      fontFamily: "var(--font-code)",
                      fontSize: 11,
                      color: "var(--text-2)",
                    }}
                  >
                    {item.useCase}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          WHY IT MATTERS
      ====================================================== */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2
              className="font-black tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
              }}
            >
              Why This Matters
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: "🔒",
                title: "Privacy",
                body: "Sensitive documents never leave your device. Companies get proof, not data.",
                color: "#7B6EF6",
              },
              {
                icon: "🛡",
                title: "Security",
                body: "Companies no longer need to store personal data. No breach, no liability.",
                color: "#00E5A0",
              },
              {
                icon: "⚖️",
                title: "Compliance",
                body: "Proof-based verification drastically reduces regulatory exposure.",
                color: "#FFB347",
              },
              {
                icon: "👤",
                title: "Ownership",
                body: "You control when, how, and to whom your attributes are verified.",
                color: "#FF6B6B",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="card-hover rounded-xl p-6"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <span className="mb-4 block text-3xl">{item.icon}</span>
                <h4
                  className="mb-2 font-bold"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.1rem",
                    color: item.color,
                  }}
                >
                  {item.title}
                </h4>
                <p
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: 12,
                    color: "var(--text-2)",
                    lineHeight: 1.6,
                  }}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          CTA / FOOTER
      ====================================================== */}
      <footer
        className="relative overflow-hidden px-6 py-24"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {/* Glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,229,160,0.05) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2
            className="mb-6 font-black tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
              lineHeight: 1.05,
            }}
          >
            From document sharing to{" "}
            <span
              style={{
                color: "var(--accent)",
                textShadow: "0 0 40px rgba(0,229,160,0.4)",
              }}
            >
              cryptographic proofs.
            </span>
          </h2>
          <p
            className="mb-10"
            style={{
              color: "var(--text-2)",
              fontFamily: "var(--font-code)",
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            Join the privacy-preserving verification network. Be among the first
            to monetize your verified attributes without revealing them.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleConnectWallet}
              className="accent-glow-btn rounded-xl px-8 py-4 text-sm font-bold"
              style={{
                background: "var(--accent)",
                color: "#03030A",
                fontFamily: "var(--font-code)",
                fontSize: 14,
              }}
            >
              {walletConnected
                ? "✓ Wallet Connected"
                : "Connect Wallet & Start →"}
            </button>
            <a
              href="https://github.com" // TODO: replace with actual repo link
              className="rounded-xl px-8 py-4 text-sm font-semibold transition-all"
              style={{
                border: "1px solid var(--border-glow)",
                color: "var(--text-2)",
                fontFamily: "var(--font-code)",
                fontSize: 14,
              }}
            >
              View on GitHub
            </a>
          </div>

          <div
            className="mt-16 flex flex-wrap items-center justify-between gap-4 pt-8"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 28, height: 28, background: "var(--accent)" }}
              >
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="4" fill="#03030A" />
                  <path
                    d="M9 1.5v3M9 13.5v3M1.5 9h3M13.5 9h3"
                    stroke="#03030A"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                Meridian
              </span>
            </div>
            <span
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 12,
                color: "var(--text-3)",
              }}
            >
              Built for the privacy-first internet · {new Date().getFullYear()}
            </span>
            <div
              className="flex gap-5"
              style={{
                fontFamily: "var(--font-code)",
                fontSize: 12,
                color: "var(--text-3)",
              }}
            >
              <a href="#how" className="transition-colors hover:text-white">
                Docs
              </a>
              <a href="#" className="transition-colors hover:text-white">
                Twitter
              </a>
              <a href="#" className="transition-colors hover:text-white">
                Discord
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
