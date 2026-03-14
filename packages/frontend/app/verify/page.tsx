"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAnonAadhaar, LogInWithAnonAadhaar } from "@anon-aadhaar/react"
import { toast } from "sonner"
import { CheckCircle, ShieldCheck, Loader2, FileText, Upload, XCircle } from "lucide-react"
import { useWallet } from "@/contexts/WalletContext"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ZKResult {
  attributeKey: string
  extractedValue: string
  valid: boolean
  confidence: number
}

interface DocResult {
  attribute: string
  claimedValue: string
  verified: boolean
  confidence: number
  reasoning: string
  tokenId?: string | null
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

  // Document verification state
  const [docAttribute, setDocAttribute] = useState("")
  const [docClaimedValue, setDocClaimedValue] = useState("")
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docSubmitting, setDocSubmitting] = useState(false)
  const [docResults, setDocResults] = useState<DocResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const zkSubmittedRef = useRef(false)

  async function submitDocument() {
    if (!docFile || !docAttribute.trim() || !docClaimedValue.trim() || !address) return
    setDocSubmitting(true)
    const form = new FormData()
    form.append("file", docFile)
    form.append("attribute", docAttribute.trim())
    form.append("claimedValue", docClaimedValue.trim())
    form.append("walletAddress", address)
    try {
      const res = await fetch(`/api/verify/document`, { method: "POST", body: form })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setDocResults((prev) => [
        { attribute: docAttribute.trim(), claimedValue: docClaimedValue.trim(), ...data },
        ...prev.filter((r) => r.attribute !== docAttribute.trim()),
      ])
      if (data.verified) {
        toast.success(`Document verified — "${docAttribute}" confirmed`)
      } else {
        toast.error(`Document not verified — ${data.reasoning ?? "confidence too low"}`)
      }
      setDocFile(null)
      setDocAttribute("")
      setDocClaimedValue("")
    } catch (err) {
      toast.error("Document verification failed.")
      console.error(err)
    } finally {
      setDocSubmitting(false)
    }
  }

  // When proof is generated, automatically submit to backend
  useEffect(() => {
    if (anonAadhaar.status !== "logged-in" || !address) return
    if (zkSubmittedRef.current) return // already submitted
    zkSubmittedRef.current = true

    const state = anonAadhaar as {
      status: "logged-in"
      anonAadhaarProofs: Record<number, { type: string; pcd: string }>
    }
    const proofs = Object.values(state.anonAadhaarProofs ?? {})
    if (proofs.length === 0) return
    // SerializedPCD.pcd is the inner JSON string containing claim + proof
    const pcd = proofs[0].pcd

    setSubmitting(true)
    fetch(`/api/verify/zk`, {
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
          <h1 className="text-4xl font-bold tracking-tight">DataDaddy</h1>
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

                <div className="flex items-center justify-between rounded-lg border border-[#00E5A0]/30 bg-[#00E5A0]/5 px-4 py-3">
                  <p className="text-sm font-medium">
                    Ready to contribute your data to AI training pools?
                  </p>
                  <Link href="/contribute" className="text-sm font-medium text-[#00E5A0] hover:underline">
                    Contribute Data →
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#00E5A0]" />
              Document Verification
            </CardTitle>
            <CardDescription>
              Upload a document (image or PDF) for AI-powered verification of custom attributes.
              The document is never stored — only the verified result.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-4">
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label htmlFor="doc-attr">Attribute name</Label>
                  <Input
                    id="doc-attr"
                    placeholder="e.g. income_above_50k, employed, student"
                    value={docAttribute}
                    onChange={(e) => setDocAttribute(e.target.value)}
                    disabled={docSubmitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="doc-claim">Claimed value</Label>
                  <Input
                    id="doc-claim"
                    placeholder="e.g. true, yes, INR 80000"
                    value={docClaimedValue}
                    onChange={(e) => setDocClaimedValue(e.target.value)}
                    disabled={docSubmitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Document</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                  />
                  {docFile ? (
                    <div className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">{docFile.name}</span>
                      <button
                        onClick={() => { setDocFile(null); if (fileInputRef.current) fileInputRef.current.value = "" }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={docSubmitting}>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose file
                    </Button>
                  )}
                </div>
              </div>

              <Button
                onClick={submitDocument}
                disabled={!docFile || !docAttribute.trim() || !docClaimedValue.trim() || docSubmitting}
                size="sm"
              >
                {docSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Verify Document"
                )}
              </Button>
            </div>

            {docResults.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <p className="text-sm font-medium">AI-Verified Attributes</p>
                {docResults.map((r) => (
                  <div
                    key={r.attribute}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {r.verified ? (
                        <CheckCircle className="h-5 w-5 text-[#00E5A0] shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{r.attribute}</p>
                        <p className="text-xs text-muted-foreground">
                          Claimed: {r.claimedValue} · Confidence: {Math.round(r.confidence * 100)}%
                        </p>
                        {r.reasoning && (
                          <p className="text-xs text-muted-foreground mt-0.5">{r.reasoning}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={r.verified ? "secondary" : "destructive"}>
                      {r.verified ? "AI Verified" : "Rejected"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
