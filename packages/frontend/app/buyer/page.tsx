"use client"

import { useState, useEffect, useCallback } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import { formatEther, decodeEventLog, keccak256, toHex, parseEther } from "viem"
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { useWallet } from "@/contexts/WalletContext"
import { SiteHeader } from "@/components/site-header"
import { RequestForm } from "@/components/request-form"
import { BuyerRequestCard, type BuyerRequest } from "@/components/buyer-request-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Toaster } from "@/components/ui/sonner"
import { ATTRIBUTE_LABELS } from "@/lib/attributeKeys"
import { LEASE_MANAGER } from "@/lib/contracts"
import { PlusCircle, Users, Loader2, Database, ShieldCheck } from "lucide-react"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000"

interface BuyerLease {
  id: number
  on_chain_id: number
  user_address: string
  status: string
  started_at: string
  expires_at: string
  paid_amount: string
  attribute_key: string
}

interface AccessGroup {
  request_id: number
  attribute_key: string
  users: {
    wallet: string
    lease_id: number
    expires_at: string
    started_at: string
    confidence: number
    certificate_token_id: number | null
  }[]
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// Pending form values saved while waiting for tx
let pendingRequest: {
  attributeKey: string
  minConfidence: number
  pricePerUserEth: string
  leaseDurationSec: number
  expiryDays: number
  maxUsers: number
  aiAllowed: boolean
} | null = null

export default function BuyerPage() {
  const { address, isConnected } = useWallet()
  const [requests, setRequests] = useState<BuyerRequest[]>([])
  const [leases, setLeases] = useState<BuyerLease[]>([])
  const [access, setAccess] = useState<AccessGroup[]>([])
  const [posting, setPosting] = useState(false)

  const { writeContract, data: postHash } = useWriteContract()
  const { isSuccess: postSuccess, isLoading: postConfirming, data: postReceipt } =
    useWaitForTransactionReceipt({ hash: postHash })

  const fetchRequests = useCallback(async () => {
    if (!address) return
    const res = await fetch(`${BACKEND}/api/buyer/requests?address=${address}`)
    if (res.ok) setRequests(await res.json())
  }, [address])

  const fetchLeases = useCallback(async () => {
    if (!address) return
    const res = await fetch(`${BACKEND}/api/buyer/leases?address=${address}`)
    if (res.ok) setLeases(await res.json())
  }, [address])

  const fetchAccess = useCallback(async () => {
    if (!address) return
    const res = await fetch(`${BACKEND}/api/content/deliver?buyer=${address}`)
    if (res.ok) setAccess(await res.json())
  }, [address])

  useEffect(() => {
    if (!isConnected || !address) return
    fetchRequests()
    fetchLeases()
    fetchAccess()
  }, [isConnected, address, fetchRequests, fetchLeases, fetchAccess])

  // After postRequest tx confirms — record in DB
  useEffect(() => {
    if (!postSuccess || !postReceipt || !address || !pendingRequest) return

    let requestId: number | null = null
    for (const log of postReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: LEASE_MANAGER.abi,
          eventName: "RequestPosted",
          topics: log.topics,
          data: log.data,
        })
        requestId = Number((decoded.args as { requestId: bigint }).requestId)
        break
      } catch { /* not this log */ }
    }

    if (requestId == null) {
      toast.error("Could not parse request ID from transaction.")
      setPosting(false)
      return
    }

    const req = pendingRequest
    pendingRequest = null

    fetch(`${BACKEND}/api/buyer/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onChainId: requestId,
        buyerAddress: address,
        attributeKey: req.attributeKey,
        minConfidence: req.minConfidence,
        aiAllowed: req.aiAllowed,
        pricePerUserEth: req.pricePerUserEth,
        leaseDurationSec: req.leaseDurationSec,
        expiryDays: req.expiryDays,
        maxUsers: req.maxUsers,
      }),
    })
      .then(() => {
        toast.success("Request posted on-chain! Eligible users will see it shortly.")
        fetchRequests()
      })
      .catch(() => toast.error("Recorded on-chain but DB sync failed."))
      .finally(() => setPosting(false))
  }, [postSuccess])

  async function handlePostRequest(values: typeof pendingRequest & object) {
    if (!address) return
    setPosting(true)

    const priceWei = parseEther(values!.pricePerUserEth)
    const totalValue = priceWei * BigInt(values!.maxUsers)
    const attrKeyBytes32 = keccak256(toHex(values!.attributeKey))
    const nowSec = Math.floor(Date.now() / 1000)
    const reqExpiry = nowSec + values!.expiryDays * 86400

    pendingRequest = values

    try {
      writeContract({
        ...LEASE_MANAGER,
        functionName: "postRequest",
        args: [
          attrKeyBytes32,
          values!.minConfidence,
          values!.aiAllowed,
          priceWei,
          values!.leaseDurationSec,
          reqExpiry,
          BigInt(values!.maxUsers),
        ],
        value: totalValue,
      })
    } catch {
      toast.error("Transaction rejected.")
      setPosting(false)
      pendingRequest = null
    }
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Meridian</h1>
          <p className="text-muted-foreground">Connect your wallet to post lease requests.</p>
        </div>
        <ConnectButton />
        <Toaster />
      </main>
    )
  }

  const activeLeases = leases.filter((l) => l.status === "Active")
  const pastLeases = leases.filter((l) => l.status !== "Active")

  return (
    <main className="min-h-screen bg-background max-w-4xl mx-auto px-6">
      <Toaster />
      <SiteHeader />

      <div className="space-y-6 pb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-[#00E5A0]" />
              Post a Lease Request
            </CardTitle>
            <CardDescription>
              ETH is locked as escrow in the smart contract. Users with matching verified
              credentials can approve your request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {posting || postConfirming ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                {postConfirming ? "Confirming transaction…" : "Waiting for wallet…"}
              </div>
            ) : (
              <RequestForm onSubmit={handlePostRequest} />
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">
              My Requests {requests.length > 0 && `(${requests.length})`}
            </TabsTrigger>
            <TabsTrigger value="leases">
              Approved Leases {leases.length > 0 && `(${leases.length})`}
            </TabsTrigger>
            <TabsTrigger value="access">
              Data Access {access.length > 0 && `(${access.reduce((n, g) => n + g.users.length, 0)})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-4">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests posted yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {requests.map((req) => (
                  <BuyerRequestCard key={req.id} req={req} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="leases" className="mt-4 space-y-3">
            {leases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users have approved your requests yet.</p>
            ) : (
              <>
                {activeLeases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active</p>
                    {activeLeases.map((lease) => (
                      <div key={lease.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{shortAddr(lease.user_address)}</span>
                            <Badge variant="outline" className="text-xs">
                              {ATTRIBUTE_LABELS[lease.attribute_key as keyof typeof ATTRIBUTE_LABELS] ?? lease.attribute_key}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatEther(BigInt(lease.paid_amount))} ETH ·
                            Expires {new Date(lease.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="secondary">Active</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {pastLeases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Past</p>
                    {pastLeases.map((lease) => (
                      <div key={lease.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{shortAddr(lease.user_address)}</span>
                            <Badge variant="outline" className="text-xs">
                              {ATTRIBUTE_LABELS[lease.attribute_key as keyof typeof ATTRIBUTE_LABELS] ?? lease.attribute_key}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatEther(BigInt(lease.paid_amount))} ETH ·
                            {new Date(lease.started_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={lease.status === "Settled" ? "default" : "destructive"}>
                          {lease.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
          <TabsContent value="access" className="mt-4 space-y-4">
            {access.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active leases yet. Users will appear here once they approve your requests.
              </p>
            ) : (
              access.map((group) => (
                <Card key={group.request_id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4 text-[#00E5A0]" />
                      {ATTRIBUTE_LABELS[group.attribute_key as keyof typeof ATTRIBUTE_LABELS] ?? group.attribute_key}
                      <Badge variant="secondary">{group.users.length} user{group.users.length !== 1 ? "s" : ""}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {group.users.map((user) => (
                      <div
                        key={user.lease_id}
                        className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="h-4 w-4 text-[#00E5A0] shrink-0" />
                          <div>
                            <p className="text-sm font-mono">{user.wallet}</p>
                            <p className="text-xs text-muted-foreground">
                              Confidence {Math.round((user.confidence ?? 1) * 100)}% ·
                              Expires {new Date(user.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {user.certificate_token_id && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Token #{user.certificate_token_id}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
