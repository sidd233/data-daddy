import Link from "next/link"
import { Database, Tag, ShieldCheck, Zap, ArrowRight, Github, Lock, TrendingUp } from "lucide-react"
import { Logo } from "@/components/logo"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-sm bg-[#0a0a0a]/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-[#00E5A0] to-emerald-400 bg-clip-text text-transparent">
              DataDaddy
            </span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00E5A0] text-black text-sm font-semibold hover:bg-emerald-400 transition-colors"
          >
            Launch App
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-[88vh] flex items-center">
        {/* Layered background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `linear-gradient(#00E5A0 1px, transparent 1px), linear-gradient(90deg, #00E5A0 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
          {/* Primary orb */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[#00E5A0]/12 rounded-full blur-[140px]" />
          {/* Secondary orb left */}
          <div className="absolute top-1/3 -left-32 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px]" />
          {/* Tertiary orb right */}
          <div className="absolute top-1/4 -right-32 w-[350px] h-[350px] bg-teal-500/8 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 py-24 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: copy */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00E5A0]/30 bg-[#00E5A0]/5 text-[#00E5A0] text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00E5A0] animate-pulse" />
                Live on Base Sepolia
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.08]">
                  Own Your Data.{" "}
                  <span className="relative inline-block">
                    <span className="bg-gradient-to-r from-[#00E5A0] via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                      Earn From It.
                    </span>
                    {/* underline accent */}
                    <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-[#00E5A0]/60 to-transparent" />
                  </span>
                </h1>

                <p className="text-lg text-white/55 leading-relaxed max-w-lg">
                  The first privacy-first AI training data marketplace. Prove your credentials with ZK proofs.
                  Get paid for your verified data.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  href="/contribute"
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#00E5A0] text-black font-semibold hover:bg-emerald-400 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Start Contributing
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/buyer"
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-white font-semibold hover:bg-white/5 hover:border-white/20 transition-all"
                >
                  Buy Data
                </Link>
              </div>

              {/* Trust pills */}
              <div className="flex flex-wrap gap-3 pt-2">
                {[
                  { icon: Lock, label: "ZK Privacy" },
                  { icon: ShieldCheck, label: "On-chain Provenance" },
                  { icon: TrendingUp, label: "Schelling Point Accuracy" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/4 border border-white/8 text-xs text-white/60">
                    <Icon className="h-3 w-3 text-[#00E5A0]" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: mock "data card" visual */}
            <div className="relative hidden lg:block">
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-3xl bg-[#00E5A0]/5 blur-2xl scale-110" />

              <div className="relative rounded-3xl border border-white/10 bg-[#111]/80 backdrop-blur-sm overflow-hidden p-6 space-y-5 shadow-2xl">
                {/* Header bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#00E5A0]/80" />
                  </div>
                  <span className="text-[10px] text-white/30 font-mono">data-request.json</span>
                </div>

                {/* Mock JSON */}
                <pre className="text-[11px] font-mono leading-relaxed text-white/50 overflow-hidden">
                  <span className="text-white/25">{"{"}</span>{"\n"}
                  {"  "}<span className="text-[#00E5A0]/80">"attribute_filters"</span>
                  <span className="text-white/25">{": {"}</span>{"\n"}
                  {"    "}<span className="text-emerald-400/70">"defi_user"</span>
                  <span className="text-white/25">{": "}</span>
                  <span className="text-teal-300/80">true</span>
                  <span className="text-white/25">{","}</span>{"\n"}
                  {"    "}<span className="text-emerald-400/70">"age_range"</span>
                  <span className="text-white/25">{": "}</span>
                  <span className="text-teal-300/80">{"[18, 35]"}</span>{"\n"}
                  {"  "}<span className="text-white/25">{"}"}</span>{"\n"}
                  {"  "}<span className="text-[#00E5A0]/80">"bounty_eth"</span>
                  <span className="text-white/25">{": "}</span>
                  <span className="text-yellow-300/80">0.05</span>
                  <span className="text-white/25">{","}</span>{"\n"}
                  {"  "}<span className="text-[#00E5A0]/80">"questionnaire"</span>
                  <span className="text-white/25">{": ["}</span>{"\n"}
                  {"    "}<span className="text-white/30">{"{"} </span>
                  <span className="text-emerald-400/70">"q"</span>
                  <span className="text-white/25">{": "}</span>
                  <span className="text-orange-300/70">"Which DeFi protocols do you use?"</span>
                  <span className="text-white/30">{" }"}</span>{"\n"}
                  {"  "}<span className="text-white/25">{"]"}</span>{"\n"}
                  <span className="text-white/25">{"}"}</span>
                </pre>

                <div className="h-px bg-white/6" />

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Verified", value: "847", color: "text-[#00E5A0]" },
                    { label: "Labelled", value: "1.2k", color: "text-emerald-400" },
                    { label: "Avg payout", value: "0.04 ETH", color: "text-teal-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl bg-white/4 p-3 text-center">
                      <div className={`text-sm font-bold ${color}`}>{value}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                {/* ZK proof badge */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00E5A0]/8 border border-[#00E5A0]/20">
                  <ShieldCheck className="h-4 w-4 text-[#00E5A0] shrink-0" />
                  <span className="text-xs text-[#00E5A0]/80 font-medium">ZK proof verified · identity never revealed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-5xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <p className="text-white/50 mt-2">Three roles, one protocol</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: Database,
              title: "Contributor",
              color: "from-[#00E5A0]/20 to-transparent",
              iconColor: "text-[#00E5A0]",
              iconBg: "bg-[#00E5A0]/10",
              steps: [
                "Verify on-chain credentials",
                "Answer targeted questionnaires",
                "Get paid per verified response",
              ],
            },
            {
              icon: Tag,
              title: "Labeller",
              color: "from-emerald-500/20 to-transparent",
              iconColor: "text-emerald-400",
              iconBg: "bg-emerald-500/10",
              steps: [
                "Browse open labelling tasks",
                "Stake ETH and submit your label",
                "Earn from the minority who guessed wrong",
              ],
            },
            {
              icon: ShieldCheck,
              title: "Buyer",
              color: "from-teal-500/20 to-transparent",
              iconColor: "text-teal-400",
              iconBg: "bg-teal-500/10",
              steps: [
                "Post a data request with filters",
                "Set required attributes & questionnaire",
                "Download verified, labelled data",
              ],
            },
          ].map(({ icon: Icon, title, color, iconColor, iconBg, steps }) => (
            <div
              key={title}
              className={`rounded-2xl border border-white/8 bg-gradient-to-b ${color} p-6 space-y-4 hover:border-white/15 transition-colors`}
            >
              <div className={`inline-flex p-2.5 rounded-xl ${iconBg} ${iconColor}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <ul className="space-y-2">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                    <span className={`mt-0.5 text-xs font-bold ${iconColor}`}>{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why DataDaddy ── */}
      <section className="max-w-5xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Why DataDaddy</h2>
          <p className="text-white/50 mt-2">Built on cryptographic guarantees, not trust</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: ShieldCheck,
              title: "ZK Privacy",
              description:
                "Credentials are proved with zero-knowledge proofs — your personal data never leaves your device. Verifiers learn only what they need to.",
            },
            {
              icon: Database,
              title: "On-chain Provenance",
              description:
                "Every data point is anchored to a soulbound ERC-721 certificate on Base. Buyers can audit the full attribution chain on-chain.",
            },
            {
              icon: Zap,
              title: "Schelling Point Accuracy",
              description:
                "Economic incentives align labellers to the truth. Stakes are redistributed from the minority to the majority — quality emerges naturally.",
            },
          ].map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/8 bg-white/2 p-6 space-y-3 hover:border-[#00E5A0]/30 hover:bg-[#00E5A0]/3 transition-colors"
            >
              <div className="inline-flex p-2.5 rounded-xl bg-[#00E5A0]/10 text-[#00E5A0]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="relative rounded-2xl border border-[#00E5A0]/20 bg-gradient-to-br from-[#00E5A0]/10 to-emerald-900/10 p-10 text-center space-y-5 overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[200px] bg-[#00E5A0]/8 rounded-full blur-[80px]" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight">Ready to get started?</h2>
            <p className="text-white/60 max-w-lg mx-auto mt-3">
              Connect your wallet and start earning from your verified credentials today.
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#00E5A0] text-black font-semibold hover:bg-emerald-400 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Launch App
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <span>Built on Base Sepolia</span>
          </div>
          <span className="flex items-center gap-1">
            <span className="bg-gradient-to-r from-[#00E5A0] to-emerald-400 bg-clip-text text-transparent font-medium">
              DataDaddy
            </span>
            © 2025
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
