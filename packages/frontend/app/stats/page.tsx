"use client"

import { useState, useEffect } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { formatEther } from "viem"
import { BarChart3, CheckCircle, TrendingUp, Wallet, ShieldCheck, FileText, Zap } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useWallet } from "@/contexts/WalletContext"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { ATTRIBUTE_LABELS } from "@/lib/attributeKeys"
import type { LeaseItem } from "@/components/lease-row"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000"

interface VerifiedAttr {
  attribute: string
  verified: boolean
  confidence: number
  method: string
  certificate_token_id: number | null
}

interface LeaseStats {
  active_requests: number
  pending_matches: number
  potential_earnings: number
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  onchain:     <Zap className="h-4 w-4 text-[#00E5A0]" />,
  zk:          <ShieldCheck className="h-4 w-4 text-[#00E5A0]" />,
  ai_document: <FileText className="h-4 w-4 text-[#00E5A0]" />,
}

const METHOD_LABEL: Record<string, string> = {
  onchain:     "On-chain",
  zk:          "ZK Proof",
  ai_document: "AI Document",
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function StatsPage() {
  const { address, isConnected } = useWallet()

  const [attrs, setAttrs] = useState<VerifiedAttr[]>([])
  const [leases, setLeases] = useState<LeaseItem[]>([])
  const [summary, setSummary] = useState<LeaseStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isConnected || !address) return

    setLoading(true)
    Promise.all([
      fetch(`${BACKEND}/api/verify/status?address=${address}`).then((r) => r.json()),
      fetch(`${BACKEND}/api/lease/history?address=${address}`).then((r) => r.json()),
      fetch(`${BACKEND}/api/lease/stats?address=${address}`).then((r) => r.json()),
    ])
      .then(([a, l, s]) => {
        setAttrs(Array.isArray(a) ? a : [])
        setLeases(Array.isArray(l) ? l : [])
        setSummary(s)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isConnected, address])

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">DataDaddy</h1>
          <p className="text-muted-foreground">Connect your wallet to view stats.</p>
        </div>
        <ConnectButton />
        <Toaster />
      </main>
    )
  }

  const verifiedCount = attrs.filter((a) => a.verified).length
  const settledLeases = leases.filter((l) => l.status === "Settled")
  const activeLeases  = leases.filter((l) => l.status === "Active")
  const revokedLeases = leases.filter((l) => l.status === "Revoked")

  const totalEarned = settledLeases.reduce(
    (sum, l) => sum + BigInt(l.paid_amount ?? "0"),
    0n
  )

  // Group settled leases by attribute for breakdown
  const earningsByAttr = settledLeases.reduce<Record<string, { count: number; total: bigint }>>(
    (acc, l) => {
      const key = l.attribute_key
      if (!acc[key]) acc[key] = { count: 0, total: 0n }
      acc[key].count++
      acc[key].total += BigInt(l.paid_amount ?? "0")
      return acc
    },
    {}
  )

  return (
    <main className="min-h-screen bg-background max-w-4xl mx-auto px-6">
      <Toaster />
      <SiteHeader />

      <div className="space-y-6 pb-12">
        {/* Summary cards */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={<CheckCircle className="h-5 w-5" />}
              label="Verified Attributes"
              value={verifiedCount}
              sub={`of ${attrs.length} checked`}
            />
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Active Leases"
              value={activeLeases.length}
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Total Earned"
              value={`${formatEther(totalEarned)} ETH`}
              sub={`${settledLeases.length} settled lease${settledLeases.length !== 1 ? "s" : ""}`}
            />
            <StatCard
              icon={<BarChart3 className="h-5 w-5" />}
              label="Potential Earnings"
              value={summary ? `${formatEther(BigInt(Math.round(summary.potential_earnings)))} ETH` : "—"}
              sub={`${summary?.pending_matches ?? 0} matched request${(summary?.pending_matches ?? 0) !== 1 ? "s" : ""}`}
            />
          </div>
        )}

        {/* Verified attributes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[#00E5A0]" />
              Verified Credentials
            </CardTitle>
            <CardDescription>All attributes verified across on-chain, ZK, and AI sources.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : attrs.filter((a) => a.verified).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No verified attributes yet. Go to the Dashboard or Verify Identity to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {attrs
                  .filter((a) => a.verified)
                  .map((attr) => (
                    <div
                      key={attr.attribute}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {METHOD_ICON[attr.method] ?? <CheckCircle className="h-4 w-4 text-[#00E5A0]" />}
                        <div>
                          <p className="text-sm font-medium">
                            {(ATTRIBUTE_LABELS as Record<string, string>)[attr.attribute] ?? attr.attribute}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {METHOD_LABEL[attr.method] ?? attr.method} · {Math.round(attr.confidence * 100)}% confidence
                            {attr.certificate_token_id ? ` · Token #${attr.certificate_token_id}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{METHOD_LABEL[attr.method] ?? attr.method}</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Earnings breakdown */}
        {Object.keys(earningsByAttr).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#00E5A0]" />
                Earnings by Attribute
              </CardTitle>
              <CardDescription>Revenue from settled leases, grouped by credential type.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(earningsByAttr).map(([key, { count, total }]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {(ATTRIBUTE_LABELS as Record<string, string>)[key] ?? key}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {count} lease{count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="text-sm font-mono">{formatEther(total)} ETH</p>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between px-3">
                <p className="text-sm font-medium">Total</p>
                <p className="text-sm font-mono font-semibold">{formatEther(totalEarned)} ETH</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lease summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#00E5A0]" />
              Lease Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))
            ) : (
              [
                { label: "Active",  count: activeLeases.length,  variant: "secondary" },
                { label: "Settled", count: settledLeases.length, variant: "default" },
                { label: "Revoked", count: revokedLeases.length, variant: "destructive" },
              ].map(({ label, count, variant }) => (
                <div key={label} className="flex flex-col items-center rounded-lg border p-4 gap-1">
                  <p className="text-2xl font-bold">{count}</p>
                  <Badge variant={variant as "secondary" | "default" | "destructive"}>{label}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
