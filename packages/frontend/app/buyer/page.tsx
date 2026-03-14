"use client"

import { useState, useEffect, useCallback } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import { formatEther } from "viem"
import { useWallet } from "@/contexts/WalletContext"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { PlusCircle, Download, List, Loader2, Database, Trash2, Plus } from "lucide-react"
import { INDIA_STATES } from "@/lib/india-states"

// On-chain boolean attributes → Switch toggle
const BOOLEAN_ATTRIBUTES = [
  { key: "defi_user", label: "DeFi User" },
  { key: "asset_holder", label: "Asset Holder" },
  { key: "active_wallet", label: "Active Wallet" },
  { key: "long_term_holder", label: "Long-term Holder" },
  { key: "nft_holder", label: "NFT Holder" },
]

// ZK attributes with refined filters
const ZK_ATTRIBUTES = [
  { key: "age_range", label: "Age Range (ZK verified)" },
  { key: "state_of_residence", label: "State of Residence (ZK verified)" },
]

interface QuestionnaireQuestion {
  id: string
  question: string
  type: "text" | "select"
  options: string[] // only for select type
}

interface DataRequest {
  id: number
  attribute_keys: string[]
  attribute_filters: Record<string, unknown> | null
  questionnaire: QuestionnaireQuestion[] | null
  min_confidence: number
  max_records: number
  price_per_record: string
  request_type: "raw" | "labelled"
  label_task_spec: { labels: string[]; instructions: string } | null
  stake_required: string | null
  voting_period_sec: number | null
  on_chain_task_id: string | null
  status: string
  created_at: string
  submission_count: number
}

interface DownloadResult {
  type: "raw" | "labelled"
  records: {
    id?: number
    fileverse_cid: string
    fileverse_url: string
    content_preview?: string
    winning_label?: string
    total_labellers?: number
    majority_count?: number
  }[]
}

function newQuestion(): QuestionnaireQuestion {
  return { id: crypto.randomUUID(), question: "", type: "text", options: [] }
}

function renderAttrFilters(filters: Record<string, unknown>) {
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

export default function BuyerPage() {
  const { address, isConnected } = useWallet()

  const [requests, setRequests] = useState<DataRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  // ── Boolean attribute toggles ──
  const [selectedBoolAttrs, setSelectedBoolAttrs] = useState<Set<string>>(new Set())

  // ── ZK attribute toggles + refined filters ──
  const [zkEnabled, setZkEnabled] = useState<Record<string, boolean>>({})
  const [ageMin, setAgeMin] = useState("18")
  const [ageMax, setAgeMax] = useState("65")
  const [selectedState, setSelectedState] = useState("")

  // ── Confidence + common fields ──
  const [minConfidence, setMinConfidence] = useState(0)
  const [maxRecords, setMaxRecords] = useState("100")
  const [pricePerRecord, setPricePerRecord] = useState("0.001")

  // ── Request type ──
  const [requestType, setRequestType] = useState<"raw" | "labelled">("raw")

  // ── Labelled-only ──
  const [labelOptions, setLabelOptions] = useState("")
  const [labelInstructions, setLabelInstructions] = useState("")
  const [stakeEth, setStakeEth] = useState("0.01")
  const [votingDays, setVotingDays] = useState("7")

  // ── Questionnaire builder ──
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([])

  const fetchRequests = useCallback(async () => {
    if (!address) return
    const res = await fetch(`/api/company/requests?address=${address}`)
    if (res.ok) setRequests(await res.json())
    setLoading(false)
  }, [address])

  useEffect(() => {
    if (isConnected && address) fetchRequests()
  }, [isConnected, address, fetchRequests])

  // ── Attribute helpers ──
  function toggleBoolAttr(key: string) {
    setSelectedBoolAttrs((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleZkAttr(key: string) {
    setZkEnabled((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Derive final attributeKeys and attributeFilters from UI state
  function buildAttributePayload() {
    const keys: string[] = [...selectedBoolAttrs]
    const filters: Record<string, unknown> = {}

    if (zkEnabled["age_range"]) {
      keys.push("age_range")
      filters["age_range"] = { min: parseInt(ageMin, 10), max: parseInt(ageMax, 10) }
    }
    if (zkEnabled["state_of_residence"] && selectedState) {
      keys.push("state_of_residence")
      filters["state_of_residence"] = selectedState
    }

    return { keys, filters }
  }

  // ── Questionnaire helpers ──
  function addQuestion() {
    setQuestions((prev) => [...prev, newQuestion()])
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  function updateQuestion(id: string, patch: Partial<QuestionnaireQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  function addOption(questionId: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, options: [...q.options, ""] } : q))
    )
  }

  function updateOption(questionId: string, idx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.map((o, i) => (i === idx ? value : o)) }
          : q
      )
    )
  }

  function removeOption(questionId: string, idx: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, options: q.options.filter((_, i) => i !== idx) } : q
      )
    )
  }

  // ── Post request ──
  async function handlePostRequest() {
    const { keys, filters } = buildAttributePayload()
    if (!address || keys.length === 0) {
      toast.error("Select at least one attribute filter")
      return
    }
    setPosting(true)

    const priceWei = String(BigInt(Math.round(parseFloat(pricePerRecord) * 1e18)))

    const body: Record<string, unknown> = {
      companyAddress: address,
      attributeKeys: keys,
      attributeFilters: filters,
      minConfidence,
      maxRecords: parseInt(maxRecords, 10),
      pricePerRecord: priceWei,
      requestType,
    }

    if (requestType === "labelled") {
      const labels = labelOptions.split(",").map((s) => s.trim()).filter(Boolean)
      if (labels.length < 2) {
        toast.error("Provide at least 2 comma-separated label options")
        setPosting(false)
        return
      }
      body.labelTaskSpec = { labels, instructions: labelInstructions }
      body.stakeRequired = String(BigInt(Math.round(parseFloat(stakeEth) * 1e18)))
      body.votingPeriodSec = parseInt(votingDays, 10) * 86400
    }

    // Only send questionnaire if it has at least one non-empty question
    const validQuestions = questions.filter((q) => q.question.trim())
    if (validQuestions.length > 0) {
      body.questionnaire = validQuestions.map((q) => ({
        id: q.id,
        question: q.question.trim(),
        type: q.type,
        ...(q.type === "select" ? { options: q.options.filter(Boolean) } : {}),
      }))
    }

    try {
      const res = await fetch("/api/company/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to post request")
      }
      toast.success("Request posted!")
      setSelectedBoolAttrs(new Set())
      setZkEnabled({})
      setQuestions([])
      fetchRequests()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Post failed")
    } finally {
      setPosting(false)
    }
  }

  async function handleDownload(req: DataRequest) {
    if (!address) return
    setDownloadingId(req.id)
    setDownloadResult(null)
    try {
      const res = await fetch("/api/company/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: req.id, companyAddress: address }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Download failed (${res.status})`)
      }
      const data: DownloadResult = await res.json()
      if (data.records.length === 0) toast.info("No data available for this request yet.")
      setDownloadResult(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed")
    } finally {
      setDownloadingId(null)
    }
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">DataDaddy</h1>
          <p className="text-muted-foreground">Connect your wallet to post data requests.</p>
        </div>
        <ConnectButton />
        <Toaster />
      </main>
    )
  }

  const { keys: previewKeys } = buildAttributePayload()

  return (
    <main className="min-h-screen bg-background max-w-4xl mx-auto px-6">
      <Toaster />
      <SiteHeader />

      <div className="space-y-6 pb-12">
        <Tabs defaultValue="post">
          <TabsList>
            <TabsTrigger value="post">
              <PlusCircle className="h-4 w-4 mr-1.5" />
              Post Request
            </TabsTrigger>
            <TabsTrigger value="requests">
              <List className="h-4 w-4 mr-1.5" />
              My Requests {requests.length > 0 && `(${requests.length})`}
            </TabsTrigger>
            <TabsTrigger value="download">
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Post Request ── */}
          <TabsContent value="post" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-[#00E5A0]" />
                  Post a Data Request
                </CardTitle>
                <CardDescription>
                  Define contributor requirements, add a questionnaire, and set your price.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* ── Request type ── */}
                <div className="space-y-2">
                  <Label>Request type</Label>
                  <div className="flex gap-3">
                    {(["raw", "labelled"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setRequestType(t)}
                        className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                          requestType === t
                            ? "border-[#00E5A0] bg-[#00E5A0]/10 text-foreground"
                            : "border-muted text-muted-foreground hover:border-foreground"
                        }`}
                      >
                        {t === "raw" ? "Raw Data" : "Labelled Data"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── On-chain boolean attributes ── */}
                <div className="space-y-3">
                  <Label>On-chain verified attributes</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Require contributors to hold these on-chain verified attributes.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {BOOLEAN_ATTRIBUTES.map(({ key, label }) => (
                      <div
                        key={key}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                          selectedBoolAttrs.has(key) ? "border-[#00E5A0] bg-[#00E5A0]/5" : "border-muted"
                        }`}
                      >
                        <Label htmlFor={`sw-${key}`} className="text-sm cursor-pointer">
                          {label}
                        </Label>
                        <Switch
                          id={`sw-${key}`}
                          checked={selectedBoolAttrs.has(key)}
                          onCheckedChange={() => toggleBoolAttr(key)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── ZK attributes with refined filters ── */}
                <div className="space-y-3">
                  <Label>ZK identity attributes</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Filter by ZK-proved identity data. Enable to set the range or value.
                  </p>

                  {/* Age range */}
                  <div
                    className={`rounded-lg border px-4 py-3 space-y-3 transition-colors ${
                      zkEnabled["age_range"] ? "border-[#00E5A0] bg-[#00E5A0]/5" : "border-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sw-age" className="text-sm cursor-pointer">
                        Age Range (ZK verified)
                      </Label>
                      <Switch
                        id="sw-age"
                        checked={!!zkEnabled["age_range"]}
                        onCheckedChange={() => toggleZkAttr("age_range")}
                      />
                    </div>
                    {zkEnabled["age_range"] && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <Label htmlFor="age-min" className="text-xs text-muted-foreground">
                            Min age
                          </Label>
                          <Input
                            id="age-min"
                            type="number"
                            min="0"
                            max="120"
                            value={ageMin}
                            onChange={(e) => setAgeMin(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="age-max" className="text-xs text-muted-foreground">
                            Max age
                          </Label>
                          <Input
                            id="age-max"
                            type="number"
                            min="0"
                            max="120"
                            value={ageMax}
                            onChange={(e) => setAgeMax(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* State of residence */}
                  <div
                    className={`rounded-lg border px-4 py-3 space-y-3 transition-colors ${
                      zkEnabled["state_of_residence"] ? "border-[#00E5A0] bg-[#00E5A0]/5" : "border-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sw-state" className="text-sm cursor-pointer">
                        State of Residence (ZK verified)
                      </Label>
                      <Switch
                        id="sw-state"
                        checked={!!zkEnabled["state_of_residence"]}
                        onCheckedChange={() => toggleZkAttr("state_of_residence")}
                      />
                    </div>
                    {zkEnabled["state_of_residence"] && (
                      <div className="pt-1">
                        <select
                          value={selectedState}
                          onChange={(e) => setSelectedState(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">All states / Any</option>
                          {INDIA_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Leave blank to accept contributors from any Indian state.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Min confidence slider ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Min confidence score</Label>
                    <span className="text-sm font-medium tabular-nums">{minConfidence.toFixed(2)}</span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[minConfidence]}
                    onValueChange={(v) => {
                      const val = Array.isArray(v) ? (v as number[])[0] : (v as number)
                      if (typeof val === "number") setMinConfidence(val)
                    }}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = any confidence · 1.0 = on-chain verified only
                  </p>
                </div>

                {/* ── Common fields ── */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="max-records">Max records</Label>
                    <Input
                      id="max-records"
                      type="number"
                      min="1"
                      value={maxRecords}
                      onChange={(e) => setMaxRecords(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="price">Price per record (ETH)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.001"
                      min="0"
                      value={pricePerRecord}
                      onChange={(e) => setPricePerRecord(e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Labelled-only fields ── */}
                {requestType === "labelled" && (
                  <div className="rounded-lg border p-4 space-y-4">
                    <p className="text-sm font-medium">Labelling configuration</p>
                    <div className="space-y-1">
                      <Label htmlFor="labels">Label options (comma-separated)</Label>
                      <Input
                        id="labels"
                        placeholder="e.g. positive, negative, neutral"
                        value={labelOptions}
                        onChange={(e) => setLabelOptions(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="instructions">Instructions for labellers</Label>
                      <Textarea
                        id="instructions"
                        placeholder="Describe what labellers should look for…"
                        rows={3}
                        value={labelInstructions}
                        onChange={(e) => setLabelInstructions(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="stake">Stake per labeller (ETH)</Label>
                        <Input
                          id="stake"
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={stakeEth}
                          onChange={(e) => setStakeEth(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="voting-days">Voting period (days)</Label>
                        <Input
                          id="voting-days"
                          type="number"
                          min="1"
                          value={votingDays}
                          onChange={(e) => setVotingDays(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Questionnaire builder ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Questionnaire</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ask contributors specific questions. Answers are uploaded to Fileverse.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Question
                    </Button>
                  </div>

                  {questions.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No questions added — contributors will see a free-text answer box.
                    </p>
                  )}

                  <div className="space-y-3">
                    {questions.map((q, qi) => (
                      <div key={q.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-muted-foreground mt-2.5 shrink-0 w-5">
                            Q{qi + 1}
                          </span>
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Question text…"
                              value={q.question}
                              onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                            />
                            <div className="flex items-center gap-3">
                              <Label className="text-xs text-muted-foreground">Type:</Label>
                              <div className="flex gap-2">
                                {(["text", "select"] as const).map((t) => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => updateQuestion(q.id, { type: t, options: t === "text" ? [] : q.options })}
                                    className={`px-3 py-1 rounded border text-xs transition-colors ${
                                      q.type === t
                                        ? "border-[#00E5A0] bg-[#00E5A0]/10"
                                        : "border-muted text-muted-foreground hover:border-foreground"
                                    }`}
                                  >
                                    {t === "text" ? "Free text" : "Multiple choice"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {q.type === "select" && (
                              <div className="space-y-2">
                                {q.options.map((opt, oi) => (
                                  <div key={oi} className="flex gap-2">
                                    <Input
                                      placeholder={`Option ${oi + 1}`}
                                      value={opt}
                                      onChange={(e) => updateOption(q.id, oi, e.target.value)}
                                      className="text-sm"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="shrink-0 h-9 w-9"
                                      onClick={() => removeOption(q.id, oi)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addOption(q.id)}
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1" />
                                  Add option
                                </Button>
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-8 w-8 mt-0.5"
                            onClick={() => removeQuestion(q.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Preview + submit ── */}
                {previewKeys.length > 0 && (
                  <div className="rounded-lg bg-muted/30 px-4 py-3 text-xs space-y-1">
                    <p className="font-medium">Request summary</p>
                    <p className="text-muted-foreground">
                      Attributes: {previewKeys.map((k) => k.replace(/_/g, " ")).join(", ")}
                    </p>
                    {zkEnabled["age_range"] && (
                      <p className="text-muted-foreground">Age: {ageMin}–{ageMax}</p>
                    )}
                    {zkEnabled["state_of_residence"] && selectedState && (
                      <p className="text-muted-foreground">State: {selectedState}</p>
                    )}
                    {questions.filter((q) => q.question).length > 0 && (
                      <p className="text-muted-foreground">
                        {questions.filter((q) => q.question).length} questionnaire question(s)
                      </p>
                    )}
                  </div>
                )}

                <Button onClick={handlePostRequest} disabled={posting || previewKeys.length === 0}>
                  {posting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {posting ? "Posting…" : "Post Request"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 2: My Requests ── */}
          <TabsContent value="requests" className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests posted yet.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div key={req.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {req.attribute_keys.map((k) => (
                            <Badge key={k} variant="outline" className="text-xs">
                              {k.replace(/_/g, " ")}
                            </Badge>
                          ))}
                          <Badge variant={req.request_type === "raw" ? "secondary" : "default"}>
                            {req.request_type}
                          </Badge>
                        </div>
                        {/* Show refined filters if present */}
                        {req.attribute_filters && Object.keys(req.attribute_filters).length > 0 && (
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {renderAttrFilters(req.attribute_filters).map((p) => (
                              <span key={p}>{p}</span>
                            ))}
                          </div>
                        )}
                        {req.questionnaire && req.questionnaire.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {req.questionnaire.length} question questionnaire
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {Number(req.submission_count)} submissions ·{" "}
                          {formatEther(BigInt(req.price_per_record))} ETH/record · max {req.max_records}
                        </p>
                      </div>
                      <Badge variant={req.status === "active" ? "default" : "secondary"}>
                        {req.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tab 3: Download ── */}
          <TabsContent value="download" className="mt-4 space-y-4">
            {loading ? (
              <Skeleton className="h-20 rounded-lg" />
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests to download from yet.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Select a request to download its matching data.
                </p>
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {req.attribute_keys.slice(0, 3).map((k) => (
                            <Badge key={k} variant="outline" className="text-xs">
                              {k.replace(/_/g, " ")}
                            </Badge>
                          ))}
                          <Badge variant="secondary">{req.request_type}</Badge>
                          <Badge
                            variant={req.status === "active" ? "default" : "outline"}
                            className="text-xs"
                          >
                            {req.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {Number(req.submission_count)} submissions available
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(req)}
                        disabled={downloadingId !== null}
                      >
                        {downloadingId === req.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Download"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>

                {downloadResult && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm font-medium">
                      {downloadResult.records.length} record
                      {downloadResult.records.length !== 1 ? "s" : ""} ({downloadResult.type})
                    </p>
                    {downloadResult.records.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No data has been submitted for this request yet.
                      </p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto space-y-2">
                        {downloadResult.records.map((r, i) => (
                          <div
                            key={i}
                            className="rounded-lg bg-muted/30 px-3 py-2 text-xs space-y-1"
                          >
                            <p className="font-mono text-[10px] text-muted-foreground">
                              CID: {r.fileverse_cid}
                            </p>
                            {r.content_preview && (
                              <p className="text-muted-foreground">{r.content_preview}</p>
                            )}
                            {r.winning_label && (
                              <p>
                                Label:{" "}
                                <span className="font-medium text-[#00E5A0]">{r.winning_label}</span>
                                {r.total_labellers !== undefined && (
                                  <span className="text-muted-foreground ml-1">
                                    ({r.majority_count}/{r.total_labellers} votes)
                                  </span>
                                )}
                              </p>
                            )}
                            <a
                              href={r.fileverse_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#00E5A0] hover:underline"
                            >
                              Open in Fileverse →
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
