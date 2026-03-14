"use client"

import { useState, useEffect } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAnonAadhaar, LogInWithAnonAadhaar } from "@anon-aadhaar/react"
import { toast } from "sonner"
import { CheckCircle, ShieldCheck, Loader2, FileText } from "lucide-react"
import { useWallet } from "@/contexts/WalletContext"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000"

interface ZKResult {
  attributeKey: string
  extractedValue: string
  valid: boolean
  confidence: number
}

const ATTR_LABELS: Record<string, string> = {
  age_range: "Age Range",
  state_of_residence: "State of Residence",
}

export default function VerifyPage() {
  const { address, isConnected } = useWallet()
  const [anonAadhaar] = useAnonAadhaar()
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<ZKResult[]>([])

  // When proof is generated, automatically submit to backend
  useEffect(() => {
    if (anonAadhaar.status !== "logged-in" || !address) return
    if (results.length > 0) return // already submitted

    const state = anonAadhaar as {
      status: "logged-in"
      anonAadhaarProofs: Record<number, { type: string; pcd: string }>
    }
    const proofs = Object.values(state.anonAadhaarProofs ?? {})
    if (proofs.length === 0) return
    // SerializedPCD.pcd is the inner JSON string containing claim + proof
    const pcd = proofs[0].pcd

    setSubmitting(true)
    fetch(`${BACKEND}/api/verify/zk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof: pcd,
        providerKey: "anon_aadhaar",
        walletAddress: address,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setResults(data.results ?? [])
        const verified = (data.results ?? []).filter((r: ZKResult) => r.valid).length
        toast.success(`ZK proof verified — ${verified} attribute${verified !== 1 ? "s" : ""} confirmed`)
      })
      .catch((err) => {
        toast.error("ZK verification failed.")
        console.error(err)
      })
      .finally(() => setSubmitting(false))
  }, [anonAadhaar.status, address])

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Meridian</h1>
          <p className="text-muted-foreground">Connect your wallet to verify identity.</p>
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
        {/* ZK Identity — Anon Aadhaar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#00E5A0]" />
              ZK Identity Verification
            </CardTitle>
            <CardDescription>
              Prove your age and state of residence using a zero-knowledge proof.
              Your Aadhaar details are never revealed — only the proof.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Anon Aadhaar</p>
              <p className="text-xs text-muted-foreground">
                Generate a ZK proof from your Aadhaar QR code. Proves age (18+) and
                state of residence without revealing any personal data.
              </p>

              {anonAadhaar.status === "logged-out" && (
                <LogInWithAnonAadhaar
                  nullifierSeed={Math.floor(Math.random() * 2 ** 32)}
                  fieldsToReveal={["revealAgeAbove18", "revealState"]}
                />
              )}

              {anonAadhaar.status === "logging-in" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating proof… this may take a minute while the circuit loads.
                </div>
              )}

              {anonAadhaar.status === "logged-in" && !submitting && results.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting proof to backend…
                </div>
              )}

              {submitting && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying and minting certificates…
                </div>
              )}
            </div>

            {results.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <p className="text-sm font-medium">Verified Attributes</p>
                {results.map((r) => (
                  <div
                    key={r.attributeKey}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-[#00E5A0] shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {ATTR_LABELS[r.attributeKey] ?? r.attributeKey}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Value: {r.extractedValue}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">ZK Proof</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document verification teaser */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              Document Verification
              <Badge variant="outline" className="text-xs">Coming next</Badge>
            </CardTitle>
            <CardDescription>
              Upload a document for AI-powered verification of custom attributes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  )
}
