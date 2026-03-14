"use client"

import { useState, useEffect, useCallback } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useReadContracts } from "wagmi"
import { toast } from "sonner"
import { Loader2, Zap, Database, Tag } from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/contexts/WalletContext"
import { CERTIFICATE_REGISTRY } from "@/lib/contracts"
import { ATTRIBUTE_KEYS } from "@/lib/attributeKeys"
import { SiteHeader } from "@/components/site-header"
import { AttributeCard } from "@/components/attribute-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"

const ATTR_NAMES = Object.keys(ATTRIBUTE_KEYS) as (keyof typeof ATTRIBUTE_KEYS)[]

interface OnChainAttribute {
  attribute: string
  verified: boolean
  confidence: number
  evidence: string
  method?: string
}

export default function Home() {
  const { address, isConnected } = useWallet()

  const [attributes, setAttributes] = useState<OnChainAttribute[]>([])
  const [loadingAttrs, setLoadingAttrs] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [earnings, setEarnings] = useState<{ total_wins: number } | null>(null)

  // Read token IDs from contract for all attributes
  const { refetch: refetchTokenIds } = useReadContracts({
    contracts: ATTR_NAMES.map((attr) => ({
      ...CERTIFICATE_REGISTRY,
      functionName: "getTokenId" as const,
      args: [address ?? "0x0000000000000000000000000000000000000000", ATTRIBUTE_KEYS[attr]],
    })),
    query: { enabled: isConnected && !!address },
  })

  const fetchExistingAttributes = useCallback(async () => {
    if (!address) return
    const res = await fetch(`/api/verify/status?address=${address}`)
    if (res.ok) {
      const data = await res.json()
      if (data.length > 0) setAttributes(data)
    }
    setLoadingAttrs(false)
  }, [address])

  const fetchEarnings = useCallback(async () => {
    if (!address) return
    const res = await fetch(`/api/label/earnings?address=${address}`)
    if (res.ok) setEarnings(await res.json())
  }, [address])

  useEffect(() => {
    if (!isConnected || !address) return
    fetchExistingAttributes()
    fetchEarnings()
  }, [isConnected, address, fetchExistingAttributes, fetchEarnings])

  async function handleVerify() {
    if (!address) return
    setVerifying(true)
    try {
      const res = await fetch(`/api/verify/onchain?address=${address}`)
      if (!res.ok) throw new Error("Verification failed")
      const data: OnChainAttribute[] = await res.json()
      setAttributes(data)
      await refetchTokenIds()
      const count = data.filter((a) => a.verified).length
      toast.success(`Verified — ${count} attribute${count !== 1 ? "s" : ""} confirmed`)
    } catch {
      toast.error("Verification failed. Check console.")
    } finally {
      setVerifying(false)
    }
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">DataDaddy</h1>
          <p className="text-muted-foreground text-lg">Privacy-first AI training data marketplace</p>
        </div>
        <ConnectButton />
        <Toaster />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background max-w-4xl mx-auto px-6">
      <Toaster />
      <SiteHeader />

      <div className="space-y-6 pb-12">
        {/* Verify wallet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#00E5A0]" />
              Verify Your Wallet
            </CardTitle>
            <CardDescription>
              Scan your on-chain activity to confirm DeFi, NFT, and holding attributes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleVerify} disabled={verifying}>
              {verifying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {verifying ? "Verifying…" : "Verify My Wallet"}
            </Button>

            {loadingAttrs ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : attributes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attributes.map((attr) => (
                  <AttributeCard
                    key={attr.attribute}
                    attribute={attr.attribute}
                    verified={attr.verified}
                    evidence={attr.evidence}
                    method={attr.method}
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-5 w-5 text-[#00E5A0]" />
                Contribute Data
              </CardTitle>
              <CardDescription>
                Answer questions and upload your responses to the training data pool. Earn rewards.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/contribute" className={buttonVariants()}>
                Contribute Data →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-5 w-5 text-[#00E5A0]" />
                Label Tasks
              </CardTitle>
              <CardDescription>
                Stake ETH, label data submissions, and earn rewards when your labels match the majority.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/label" className={buttonVariants()}>
                Label Tasks →
              </Link>
              {earnings && earnings.total_wins > 0 && (
                <p className="text-xs text-muted-foreground">
                  You have {earnings.total_wins} winning label{earnings.total_wins !== 1 ? "s" : ""}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
