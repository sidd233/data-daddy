"use client"

import { useState, useEffect, useCallback } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import { useWallet } from "@/contexts/WalletContext"
import { SiteHeader } from "@/components/site-header"
import { LeaseRow, type LeaseItem } from "@/components/lease-row"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import { ShieldCheck, FileText } from "lucide-react"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000"

export default function LeasesPage() {
  const { address, isConnected } = useWallet()
  const [leases, setLeases] = useState<LeaseItem[]>([])
  const [actioningId, setActioningId] = useState<number | null>(null)

  const fetchLeases = useCallback(async () => {
    if (!address) return
    const res = await fetch(`${BACKEND}/api/lease/history?address=${address}`)
    if (res.ok) setLeases(await res.json())
  }, [address])

  useEffect(() => {
    if (!isConnected || !address) return
    // Auto-settle any expired leases, then refresh
    fetch(`${BACKEND}/api/lease/settle-expired`, { method: "POST" })
      .finally(() => fetchLeases())
  }, [isConnected, address, fetchLeases])

  async function handleAction(lease: LeaseItem, action: "revoke" | "settle") {
    if (action === "revoke") {
      if (!confirm("Revoking forfeits your payment. Are you sure?")) return
    }
    setActioningId(lease.on_chain_id)
    try {
      const res = await fetch(`${BACKEND}/api/lease/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onChainId: lease.on_chain_id, action, userAddress: address }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Request failed")
      }
      toast.success(action === "revoke" ? "Lease revoked." : "Lease settled! Payment released.")
      fetchLeases()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed.")
    } finally {
      setActioningId(null)
    }
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Meridian</h1>
          <p className="text-muted-foreground">Connect your wallet to view leases.</p>
        </div>
        <ConnectButton />
        <Toaster />
      </main>
    )
  }

  const active = leases.filter((l) => l.status === "Active")
  const past = leases.filter((l) => l.status !== "Active")

  return (
    <main className="min-h-screen bg-background max-w-4xl mx-auto px-6">
      <Toaster />
      <SiteHeader />

      <div className="pb-12">
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">
              Active {active.length > 0 && `(${active.length})`}
            </TabsTrigger>
            <TabsTrigger value="history">
              History {past.length > 0 && `(${past.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#00E5A0]" />
                  Active Leases
                </CardTitle>
                <CardDescription>
                  Running leases. Revoking forfeits your payment. Settle once expired to receive it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {active.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active leases.</p>
                ) : (
                  active.map((lease) => (
                    <LeaseRow
                      key={lease.id}
                      lease={lease}
                      actioning={actioningId === lease.on_chain_id}
                      onRevoke={(l) => handleAction(l, "revoke")}
                      onSettle={(l) => handleAction(l, "settle")}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Lease History
                </CardTitle>
                <CardDescription>All completed, settled, and revoked leases.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {past.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No past leases yet.</p>
                ) : (
                  past.map((lease) => (
                    <LeaseRow
                      key={lease.id}
                      lease={lease}
                      actioning={false}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
