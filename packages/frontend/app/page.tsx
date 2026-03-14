"use client"

import { useState, useEffect, useCallback } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { decodeEventLog } from "viem"
import { toast } from "sonner"
import { Loader2, Zap, Wallet } from "lucide-react"
import { useWallet } from "@/contexts/WalletContext"
import { CERTIFICATE_REGISTRY, LEASE_MANAGER } from "@/lib/contracts"
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "@/lib/attributeKeys"
import { SiteHeader } from "@/components/site-header"
import { AttributeCard } from "@/components/attribute-card"
import { MatchedRequestRow, type MatchedRequest } from "@/components/matched-request-row"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000"
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
  const [loadingMatched, setLoadingMatched] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [matched, setMatched] = useState<MatchedRequest[]>([])
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [pendingApprove, setPendingApprove] = useState<MatchedRequest | null>(null)

  const { writeContract: writeApprove, data: approveHash } = useWriteContract()
  const { isSuccess: approveSuccess, data: approveReceipt } =
    useWaitForTransactionReceipt({ hash: approveHash })

  useEffect(() => {
    if (!approveSuccess || !approveReceipt || !address || !pendingApprove) return

    let leaseId: number | null = null
    for (const log of approveReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: LEASE_MANAGER.abi,
          eventName: "LeaseApproved",
          topics: log.topics,
          data: log.data,
        })
        leaseId = Number((decoded.args as { leaseId: bigint }).leaseId)
        break
      } catch { /* not this log */ }
    }

    const req = pendingApprove
    setPendingApprove(null)
    setApprovingId(null)

    const attrIndex = ATTR_NAMES.findIndex(
      (a) => a === req.attribute_key || ATTRIBUTE_KEYS[a] === req.attribute_key
    )
    const tokenId = attrIndex >= 0 ? (tokenIds?.[attrIndex]?.result as bigint) : undefined

    fetch(`${BACKEND}/api/lease/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leaseId: leaseId ?? req.on_chain_id,
        requestOnChainId: req.on_chain_id,
        userAddress: address,
        certificateTokenId: tokenId ? Number(tokenId) : 0,
      }),
    }).catch(console.error)

    toast.success("Lease approved! Buyer now has access.")
    fetchMatched()
  }, [approveSuccess])

  // Read token IDs from contract for all attributes
  const { data: tokenIds, refetch: refetchTokenIds } = useReadContracts({
    contracts: ATTR_NAMES.map((attr) => ({
      ...CERTIFICATE_REGISTRY,
      functionName: "getTokenId" as const,
      args: [address ?? "0x0000000000000000000000000000000000000000", ATTRIBUTE_KEYS[attr]],
    })),
    query: { enabled: isConnected && !!address },
  })

  const fetchMatched = useCallback(async () => {
    if (!address) return
    setLoadingMatched(true)
    const res = await fetch(`${BACKEND}/api/match/requests?address=${address}`)
    if (res.ok) setMatched(await res.json())
    setLoadingMatched(false)
  }, [address])

  const fetchExistingAttributes = useCallback(async () => {
    if (!address) return
    const res = await fetch(`${BACKEND}/api/verify/status?address=${address}`)
    if (res.ok) {
      const data = await res.json()
      if (data.length > 0) setAttributes(data)
    }
    setLoadingAttrs(false)
  }, [address])

  useEffect(() => {
    if (!isConnected || !address) return
    fetchExistingAttributes()
    fetchMatched()
    const interval = setInterval(() => { fetchMatched(); fetchExistingAttributes() }, 15_000)
    return () => clearInterval(interval)
  }, [isConnected, address, fetchMatched, fetchExistingAttributes])

  async function handleVerify() {
    if (!address) return
    setVerifying(true)
    try {
      const res = await fetch(`${BACKEND}/api/verify/onchain?address=${address}`)
      if (!res.ok) throw new Error("Verification failed")
      const data: OnChainAttribute[] = await res.json()
      setAttributes(data)
      await refetchTokenIds()
      const count = data.filter((a) => a.verified).length
      toast.success(`Verified — ${count} attribute${count !== 1 ? "s" : ""} confirmed`)
      fetchMatched()
    } catch {
      toast.error("Verification failed. Check console.")
    } finally {
      setVerifying(false)
    }
  }

  function handleApprove(request: MatchedRequest) {
    if (!address || !tokenIds) return

    const attrIndex = ATTR_NAMES.findIndex(
      (a) => a === request.attribute_key || ATTRIBUTE_KEYS[a] === request.attribute_key
    )
    const tokenId = attrIndex >= 0 ? (tokenIds[attrIndex]?.result as bigint) : undefined

    if (!tokenId || tokenId === 0n) {
      toast.error("No certificate found. Verify your wallet first.")
      return
    }

    setApprovingId(request.on_chain_id)
    setPendingApprove(request)
    writeApprove({
      ...LEASE_MANAGER,
      functionName: "approveLease",
      args: [BigInt(request.on_chain_id), tokenId],
    })
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">DataDaddy</h1>
          <p className="text-muted-foreground text-lg">Privacy-first on-chain data leasing</p>
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
        {/* Step 1: Verify */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#00E5A0]" />
              Step 1 — Verify Your Wallet
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

        {/* Step 2: Matched Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#00E5A0]" />
              Step 2 — Matched Lease Requests
            </CardTitle>
            <CardDescription>
              Buyers looking for your verified attributes. Approve to grant access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMatched ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : matched.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No matching requests yet. Verify your attributes first, or check back later.
              </p>
            ) : (
              <div className="space-y-3">
                {matched.map((req) => (
                  <MatchedRequestRow
                    key={req.id}
                    request={req}
                    approving={approvingId === req.on_chain_id}
                    onApprove={handleApprove}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
