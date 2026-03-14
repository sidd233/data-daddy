"use client"

import { useState, useEffect, useCallback } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import { formatEther } from "viem"
import { Loader2, Database, CheckCircle, ClipboardList, History, Coins } from "lucide-react"
import { useWallet } from "@/contexts/WalletContext"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"

interface VerifiedAttribute {
  attribute: string
  verified: boolean
  confidence: number
}

interface QuestionnaireQuestion {
  id: string
  question: string
  type: "text" | "select"
  options?: string[]
}

interface CompanyRequest {
  id: number
  attribute_keys: string[]
  attribute_filters: Record<string, unknown> | null
  questionnaire: QuestionnaireQuestion[] | null
  min_confidence: number
  max_records: number
  price_per_record: string
  request_type: "raw" | "labelled"
  label_task_spec: { labels: string[]; instructions: string } | null
  status: string
  created_at: string
}

interface PastSubmission {
  id: number
  fileverse_cid: string
  fileverse_url: string
  attribute_keys: string[]
  content_preview: string
  created_at: string
}

interface SubmitResult {
  id: number
  cid: string
  createdAt: string
}

function renderAttrFilters(filters: Record<string, unknown>): string[] {
  const parts: string[] = []
  if (filters["age_range"]) {
    const af = filters["age_range"] as { min: number; max: number }
    parts.push(`Age ${af.min}–${af.max}`)
  }
  if (filters["state_of_residence"]) {
    parts.push(`State: ${String(filters["state_of_residence"])}`)
  }
  return parts
}

export default function ContributePage() {
  const { address, isConnected } = useWallet()

  const [verifiedAttrs, setVerifiedAttrs] = useState<VerifiedAttribute[]>([])
  const [loadingAttrs, setLoadingAttrs] = useState(true)

  const [requests, setRequests] = useState<CompanyRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<CompanyRequest | null>(null)

  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([])
  const [answer, setAnswer] = useState("")
  // questionnaire mode: answers keyed by question id
  const [qAnswers, setQAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null)

  const [pastSubmissions, setPastSubmissions] = useState<PastSubmission[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [earnings, setEarnings] = useState<{ total_wins: number } | null>(null)

  const fetchAttrs = useCallback(async () => {
    if (!address) return
    const res = await fetch(`/api/verify/status?address=${address}`)
    if (res.ok) {
      const data: VerifiedAttribute[] = await res.json()
      setVerifiedAttrs(data.filter((a) => a.verified))
    }
    setLoadingAttrs(false)
  }, [address])

  const fetchRequests = useCallback(async (attrs: VerifiedAttribute[]) => {
    setLoadingRequests(true)
    const keys = attrs.map((a) => a.attribute)
    const q = keys.length ? `?attribute_keys=${keys.join(",")}` : ""
    const res = await fetch(`/api/contributor/requests${q}`)
    if (res.ok) setRequests(await res.json())
    setLoadingRequests(false)
  }, [])

  const fetchHistory = useCallback(async () => {
    if (!address) return
    setLoadingHistory(true)
    const [subRes, earningsRes] = await Promise.all([
      fetch(`/api/contributor/submissions?address=${address}`),
      fetch(`/api/label/earnings?address=${address}`),
    ])
    if (subRes.ok) setPastSubmissions(await subRes.json())
    if (earningsRes.ok) setEarnings(await earningsRes.json())
    setLoadingHistory(false)
  }, [address])

  useEffect(() => {
    if (isConnected && address) {
      fetchAttrs().then(() => {})
    }
  }, [isConnected, address, fetchAttrs])

  // Fetch requests once attrs are loaded
  useEffect(() => {
    if (!loadingAttrs) fetchRequests(verifiedAttrs)
  }, [loadingAttrs, verifiedAttrs, fetchRequests])

  function toggleAttr(key: string) {
    setSelectedAttrs((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  function handleSelectRequest(req: CompanyRequest) {
    setSelectedRequest((prev) => (prev?.id === req.id ? null : req))
    setAnswer("")
    setQAnswers({})
    setSelectedAttrs([])
    setLastResult(null)
  }

  async function handleSubmit() {
    const hasQuestionnaire = (selectedRequest?.questionnaire?.length ?? 0) > 0
    const questionnaireComplete = hasQuestionnaire
      ? selectedRequest!.questionnaire!.every((q) => (qAnswers[q.id] ?? "").trim())
      : true

    if (!address || selectedAttrs.length === 0 || !selectedRequest) return
    if (!hasQuestionnaire && !answer.trim()) return
    if (!questionnaireComplete) {
      toast.error("Please answer all questionnaire questions before submitting.")
      return
    }

    setSubmitting(true)

    // Build the answer payload
    let finalAnswer: string
    let finalQuestion: string

    if (hasQuestionnaire) {
      const structured = selectedRequest!.questionnaire!.map((q) => ({
        question: q.question,
        answer: qAnswers[q.id] ?? "",
      }))
      finalAnswer = JSON.stringify(structured)
      finalQuestion = `Questionnaire for request #${selectedRequest.id}`
    } else {
      finalAnswer = answer.trim()
      finalQuestion =
        selectedRequest.label_task_spec?.instructions ??
        `Provide data for request #${selectedRequest.id} — attributes: ${selectedRequest.attribute_keys.join(", ")}`
    }

    try {
      const res = await fetch("/api/pool/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          question: finalQuestion,
          answer: finalAnswer,
          attributeKeys: selectedAttrs,
          requestId: selectedRequest.id,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Submission failed")
      }
      const data: SubmitResult = await res.json()
      setLastResult(data)
      setAnswer("")
      setQAnswers({})
      setSelectedAttrs([])
      toast.success("Response submitted! CID: " + data.cid.slice(0, 12) + "…")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">DataDaddy</h1>
          <p className="text-muted-foreground">Connect your wallet to contribute data.</p>
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

      <Tabs defaultValue="browse">
        <TabsList className="mb-4">
          <TabsTrigger value="browse">
            <ClipboardList className="h-4 w-4 mr-1.5" />
            Browse Requests
          </TabsTrigger>
          <TabsTrigger value="history" onClick={fetchHistory}>
            <History className="h-4 w-4 mr-1.5" />
            My Activity
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Browse company requests ── */}
        <TabsContent value="browse" className="space-y-4 pb-12">
          <p className="text-sm text-muted-foreground">
            Choose a request below, read what the buyer needs, and submit your response.
          </p>

          {loadingAttrs || loadingRequests ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  No open requests match your verified attributes.{" "}
                  <a href="/verify" className="text-[#00E5A0] hover:underline">
                    Verify more attributes →
                  </a>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => handleSelectRequest(req)}
                  className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                    selectedRequest?.id === req.id
                      ? "border-[#00E5A0] bg-[#00E5A0]/5"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1">
                        {req.attribute_keys.map((k) => (
                          <Badge key={k} variant="outline" className="text-xs">
                            {k.replace(/_/g, " ")}
                          </Badge>
                        ))}
                        <Badge
                          variant={req.request_type === "raw" ? "secondary" : "default"}
                          className="text-xs"
                        >
                          {req.request_type}
                        </Badge>
                      </div>

                      {req.label_task_spec?.instructions ? (
                        <p className="text-sm">{req.label_task_spec.instructions}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Provide data matching the attributes above.
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#00E5A0]">
                        <Coins className="h-3.5 w-3.5" />
                        {formatEther(BigInt(req.price_per_record))} ETH per response
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {req.questionnaire?.length
                          ? `${req.questionnaire.length} question questionnaire`
                          : "Free text response"}{" "}
                        · max {req.max_records} responses
                      </p>
                      {/* Show refined filters */}
                      {req.attribute_filters && Object.keys(req.attribute_filters).length > 0 && (
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          {renderAttrFilters(req.attribute_filters).map((p) => (
                            <span key={p}>{p}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="text-xs font-medium shrink-0 text-[#00E5A0]">
                      {selectedRequest?.id === req.id ? "▲ Selected" : "Select →"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Answer form (shown when a request is selected) ── */}
          {selectedRequest && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-[#00E5A0]" />
                  Your Response
                </CardTitle>
                <CardDescription>
                  {selectedRequest.label_task_spec?.instructions ??
                    `Provide data for: ${selectedRequest.attribute_keys.map((k) => k.replace(/_/g, " ")).join(", ")}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedRequest.questionnaire && selectedRequest.questionnaire.length > 0 ? (
                  // ── Questionnaire mode ──
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Questionnaire</Label>
                      <span className="text-xs text-muted-foreground">
                        {selectedRequest.questionnaire.filter((q) => (qAnswers[q.id] ?? "").trim()).length}
                        /{selectedRequest.questionnaire.length} answered
                      </span>
                    </div>
                    {selectedRequest.questionnaire.map((q, qi) => (
                      <div key={q.id} className="space-y-1.5">
                        <Label className="text-sm">
                          <span className="text-muted-foreground mr-1.5">Q{qi + 1}.</span>
                          {q.question}
                        </Label>
                        {q.type === "select" && q.options && q.options.length > 0 ? (
                          <select
                            value={qAnswers[q.id] ?? ""}
                            onChange={(e) => setQAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            disabled={submitting}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="">Select an option…</option>
                            {q.options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <Textarea
                            placeholder="Your answer…"
                            rows={3}
                            value={qAnswers[q.id] ?? ""}
                            onChange={(e) => setQAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            disabled={submitting}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  // ── Free text mode ──
                  <div className="space-y-1">
                    <Label htmlFor="answer">Write your response</Label>
                    <Textarea
                      id="answer"
                      placeholder="Share your experience and perspective…"
                      rows={5}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={submitting}
                    />
                    <p className="text-xs text-muted-foreground">{answer.length}/2000 characters</p>
                  </div>
                )}

                {verifiedAttrs.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Tag verified attributes</Label>
                    <p className="text-xs text-muted-foreground">
                      Select attributes that apply to this response.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {verifiedAttrs.map((attr) => (
                        <div
                          key={attr.attribute}
                          className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/30"
                          onClick={() => toggleAttr(attr.attribute)}
                        >
                          <Checkbox
                            id={`attr-${attr.attribute}`}
                            checked={selectedAttrs.includes(attr.attribute)}
                            onCheckedChange={() => toggleAttr(attr.attribute)}
                          />
                          <Label htmlFor={`attr-${attr.attribute}`} className="cursor-pointer text-xs">
                            {attr.attribute.replace(/_/g, " ")}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    You need at least one verified attribute.{" "}
                    <a href="/verify" className="text-[#00E5A0] hover:underline">Verify now →</a>
                  </p>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    selectedAttrs.length === 0 ||
                    (!(selectedRequest?.questionnaire?.length) && !answer.trim())
                  }
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {submitting ? "Uploading…" : "Submit Response"}
                </Button>

                {lastResult && (
                  <div className="flex items-start gap-3 rounded-lg border border-[#00E5A0]/30 bg-[#00E5A0]/5 p-4">
                    <CheckCircle className="h-5 w-5 text-[#00E5A0] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Submitted successfully</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        CID: <span className="font-mono">{lastResult.cid}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Submission #{lastResult.id}</p>
                    </div>
                    <Badge variant="secondary" className="ml-auto shrink-0">Stored</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 2: My Activity ── */}
        <TabsContent value="history" className="space-y-4 pb-12">
          {/* Earnings summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                {loadingHistory ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <>
                    <p className="text-2xl font-bold">{pastSubmissions.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Submissions</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                {loadingHistory ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-[#00E5A0]">
                      {earnings?.total_wins ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Winning labels</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Submission history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submission History</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : pastSubmissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No submissions yet. Browse requests to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {pastSubmissions.map((sub) => (
                    <div key={sub.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1">
                            {sub.attribute_keys.map((k) => (
                              <Badge key={k} variant="outline" className="text-xs">
                                {k.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                          {sub.content_preview && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {sub.content_preview}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground font-mono">
                            {sub.fileverse_cid.slice(0, 24)}…
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <a
                        href={sub.fileverse_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#00E5A0] hover:underline"
                      >
                        View on Fileverse →
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
