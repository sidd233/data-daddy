"use client"

import { useState, useEffect, useCallback } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { keccak256, toHex, formatEther } from "viem"
import { toast } from "sonner"
import { Loader2, Tag, Clock, Coins, CheckCircle, XCircle, Hourglass } from "lucide-react"
import { useWallet } from "@/contexts/WalletContext"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { LABELLING_POOL } from "@/lib/contracts"

interface LabelTask {
  id: number
  attribute_keys: string[]
  label_task_spec: {
    labels: string[]
    instructions: string
  }
  stake_required: string
  voting_period_sec: number
  on_chain_task_id: string
  created_at: string
  labelled_count: number
  total_submissions: number
}

interface DataSubmission {
  id: number
  fileverse_cid: string
  attribute_keys: string[]
  content_preview: string
  created_at: string
}

interface MyLabel {
  id: number
  task_id: number
  data_id: number
  submitted_label: string
  on_chain_tx: string | null
  created_at: string
  attribute_keys: string[]
  label_task_spec: { labels: string[]; instructions: string } | null
  stake_required: string
  voting_period_sec: number
  task_created_at: string
  winning_label: string | null
  total_labellers: number | null
  majority_count: number | null
  settled_at: string | null
  result: "pending" | "won" | "lost"
}

let pendingLabel: { taskId: number; dataId: number; label: string } | null = null

export default function LabelPage() {
  const { address, isConnected } = useWallet()

  const [tasks, setTasks] = useState<LabelTask[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [selectedTask, setSelectedTask] = useState<LabelTask | null>(null)
  const [submissions, setSubmissions] = useState<DataSubmission[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<DataSubmission | null>(null)
  const [selectedLabel, setSelectedLabel] = useState<string>("")
  const [submittingLabel, setSubmittingLabel] = useState(false)
  const [settling, setSettling] = useState(false)

  const [myLabels, setMyLabels] = useState<MyLabel[]>([])
  const [loadingMyLabels, setLoadingMyLabels] = useState(false)

  const { writeContract, data: labelHash, isError: writeError, error: writeErrorObj } = useWriteContract()
  const { isSuccess: labelSuccess, isError: receiptError, error: receiptErrorObj, data: labelReceipt } =
    useWaitForTransactionReceipt({ hash: labelHash })

  const fetchTasks = useCallback(async () => {
    if (!address) return
    setLoadingTasks(true)
    const res = await fetch(`/api/label/tasks?address=${address}`)
    if (res.ok) setTasks(await res.json())
    setLoadingTasks(false)
  }, [address])

  const fetchMyLabels = useCallback(async () => {
    if (!address) return
    setLoadingMyLabels(true)
    const res = await fetch(`/api/label/my-labels?address=${address}`)
    if (res.ok) setMyLabels(await res.json())
    setLoadingMyLabels(false)
  }, [address])

  useEffect(() => {
    if (isConnected && address) fetchTasks()
  }, [isConnected, address, fetchTasks])

  async function fetchSubmissionsForTask(task: LabelTask) {
    setLoadingSubmissions(true)
    const keysParam = task.attribute_keys.join(",")
    const res = await fetch(`/api/pool/query?attribute_keys=${keysParam}`)
    if (res.ok) {
      const data: DataSubmission[] = await res.json()
      setSubmissions(data)
      setSelectedSubmission(data[0] ?? null)
    }
    setLoadingSubmissions(false)
  }

  function handleSelectTask(task: LabelTask) {
    setSelectedTask(task)
    setSelectedLabel("")
    setSelectedSubmission(null)
    fetchSubmissionsForTask(task)
  }

  function handleSubmitLabel() {
    if (!selectedTask || !selectedSubmission || !selectedLabel || !address) return

    const taskIdBytes32 = selectedTask.on_chain_task_id as `0x${string}`
    const dataIdBytes32 = keccak256(toHex(selectedSubmission.id.toString())) as `0x${string}`
    const stakeWei = BigInt(selectedTask.stake_required)

    pendingLabel = {
      taskId: selectedTask.id,
      dataId: selectedSubmission.id,
      label: selectedLabel,
    }

    setSubmittingLabel(true)

    writeContract({
      ...LABELLING_POOL,
      functionName: "stakeAndLabel",
      args: [taskIdBytes32, dataIdBytes32, selectedLabel],
      value: stakeWei,
    })
  }

  useEffect(() => {
    if (!labelSuccess || !labelReceipt || !address || !pendingLabel) return

    const pending = pendingLabel
    pendingLabel = null

    fetch("/api/label/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: pending.taskId,
        dataId: pending.dataId,
        labellerAddress: address,
        label: pending.label,
        onChainTx: labelReceipt.transactionHash,
      }),
    })
      .then(() => {
        toast.success("Label submitted! Stake locked until voting ends.")
        setSelectedLabel("")
        setSubmittingLabel(false)
        fetchTasks()
      })
      .catch(() => toast.error("Recorded on-chain but DB sync failed"))
      .finally(() => setSubmittingLabel(false))
  }, [labelSuccess])

  useEffect(() => {
    if (!writeError && !receiptError) return
    const msg = (writeErrorObj ?? receiptErrorObj)?.message ?? "Transaction failed"
    const short = msg.includes("User rejected") ? "Transaction rejected." : "Label failed — " + msg.split("\n")[0]
    toast.error(short)
    setSubmittingLabel(false)
    pendingLabel = null
  }, [writeError, receiptError])

  function isVotingClosed(task: LabelTask) {
    const deadline = new Date(task.created_at).getTime() + task.voting_period_sec * 1000
    return Date.now() >= deadline
  }

  async function handleSettle(taskId: number, dataId: number) {
    setSettling(true)
    try {
      const res = await fetch("/api/label/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, dataId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Settlement failed")
      toast.success(`Settled! Winning label: "${data.winningLabel}"`)
      fetchTasks()
      fetchMyLabels()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settlement failed")
    } finally {
      setSettling(false)
    }
  }

  function deadlineText(task: LabelTask) {
    const deadline = new Date(task.created_at).getTime() + task.voting_period_sec * 1000
    const remaining = deadline - Date.now()
    if (remaining <= 0) return "Voting closed"
    const hours = Math.floor(remaining / 3_600_000)
    const mins = Math.floor((remaining % 3_600_000) / 60_000)
    return `${hours}h ${mins}m remaining`
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">DataDaddy</h1>
          <p className="text-muted-foreground">Connect your wallet to label tasks.</p>
        </div>
        <ConnectButton />
        <Toaster />
      </main>
    )
  }

  const wonCount = myLabels.filter((l) => l.result === "won").length
  const pendingCount = myLabels.filter((l) => l.result === "pending").length
  const lostCount = myLabels.filter((l) => l.result === "lost").length

  // Split tasks: votable = voting still open; awaitingSettle = deadline passed
  const votableTasks = tasks.filter((t) => !isVotingClosed(t))
  const awaitingSettleTasks = tasks.filter((t) => isVotingClosed(t))

  // If selected task's voting just closed, deselect it
  const activeSelectedTask =
    selectedTask && !isVotingClosed(selectedTask) ? selectedTask : null

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 max-w-4xl mx-auto px-6">
      <Toaster />
      <SiteHeader />

      <Tabs defaultValue="tasks">
        <TabsList className="mb-4">
          <TabsTrigger value="tasks">
            <Tag className="h-4 w-4 mr-1.5" />
            Open Tasks {votableTasks.length > 0 && `(${votableTasks.length})`}
          </TabsTrigger>
          <TabsTrigger value="my-labels" onClick={fetchMyLabels}>
            <CheckCircle className="h-4 w-4 mr-1.5" />
            My Labels
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Open label tasks ── */}
        <TabsContent value="tasks" className="space-y-6 pb-12">

          {/* Votable tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-[#00E5A0]" />
                Open Tasks
              </CardTitle>
              <CardDescription>
                Stake ETH and vote on the correct label. Winners earn from losers' stakes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTasks ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : votableTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tasks available to vote on right now.
                </p>
              ) : (
                <div className="space-y-3">
                  {votableTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                        activeSelectedTask?.id === task.id
                          ? "border-[#00E5A0] bg-[#00E5A0]/5 shadow-md ring-1 ring-[#00E5A0]/30"
                          : "hover:bg-muted/30"
                      }`}
                      onClick={() => handleSelectTask(task)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1">
                            {task.attribute_keys.map((k) => (
                              <Badge key={k} variant="outline" className="text-xs">
                                {k.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {task.label_task_spec?.instructions ?? "No instructions"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Labels: {task.label_task_spec?.labels?.join(" · ")}
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                            <Coins className="h-3.5 w-3.5" />
                            {formatEther(BigInt(task.stake_required))} ETH
                          </div>
                          <div className="flex items-center gap-1 text-xs text-[#00E5A0] justify-end">
                            <Clock className="h-3.5 w-3.5" />
                            {deadlineText(task)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Label interface — only for votable selected task */}
          {activeSelectedTask && (
            <Card className="border-[#00E5A0]/20 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Label a Submission</CardTitle>
                <CardDescription>
                  Read the submission and select the correct label. Stake:{" "}
                  {formatEther(BigInt(activeSelectedTask.stake_required))} ETH
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingSubmissions ? (
                  <Skeleton className="h-20 rounded-lg" />
                ) : submissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submissions available for this task.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Data preview
                      </p>
                      <div className="rounded-lg border bg-gradient-to-br from-muted/30 to-muted/10 p-4">
                        <p className="text-sm">{selectedSubmission?.content_preview ?? "—"}</p>
                        {submissions.length > 1 && (
                          <div className="flex gap-2 mt-3">
                            {submissions.slice(0, 5).map((s, i) => (
                              <button
                                key={s.id}
                                onClick={() => { setSelectedSubmission(s); setSelectedLabel("") }}
                                className={`text-xs px-2 py-1 rounded border ${
                                  selectedSubmission?.id === s.id
                                    ? "border-[#00E5A0] text-[#00E5A0]"
                                    : "border-muted text-muted-foreground hover:border-foreground"
                                }`}
                              >
                                #{i + 1}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Select label
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activeSelectedTask.label_task_spec?.labels?.map((label) => (
                          <button
                            key={label}
                            onClick={() => setSelectedLabel(label)}
                            className={`px-4 py-2 rounded-xl border text-sm transition-colors ${
                              selectedLabel === label
                                ? "border-[#00E5A0] bg-[#00E5A0]/10 text-foreground"
                                : "border-muted text-muted-foreground hover:border-foreground hover:text-foreground"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleSubmitLabel}
                      disabled={!selectedLabel || submittingLabel}
                      className="w-full sm:w-auto"
                    >
                      {submittingLabel && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {submittingLabel
                        ? "Waiting for wallet…"
                        : `Stake & Label (${formatEther(BigInt(activeSelectedTask.stake_required))} ETH)`}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Awaiting settlement — voting closed, not yet settled */}
          {awaitingSettleTasks.length > 0 && (
            <Card className="border-orange-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-orange-400">
                  <Clock className="h-4 w-4 text-orange-400" />
                  Awaiting Settlement
                </CardTitle>
                <CardDescription>
                  Voting has closed on these tasks. Anyone can trigger settlement to distribute stakes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {awaitingSettleTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-lg border p-4 gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1">
                        {task.attribute_keys.map((k) => (
                          <Badge key={k} variant="outline" className="text-xs">
                            {k.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {task.label_task_spec?.instructions ?? `Task #${task.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatEther(BigInt(task.stake_required))} ETH stake · voting closed
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        // Need at least one submission to settle against
                        const keysParam = task.attribute_keys.join(",")
                        const res = await fetch(`/api/pool/query?attribute_keys=${keysParam}`)
                        if (!res.ok) { toast.error("Could not load submissions"); return }
                        const subs: DataSubmission[] = await res.json()
                        if (subs.length === 0) { toast.error("No submissions to settle"); return }
                        handleSettle(task.id, subs[0].id)
                      }}
                      disabled={settling}
                      className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    >
                      {settling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Settle"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 2: My Labels dashboard ── */}
        <TabsContent value="my-labels" className="space-y-4 pb-12">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Won", value: wonCount, icon: CheckCircle, color: "text-[#00E5A0]", cardClass: "bg-gradient-to-br from-background to-[#00E5A0]/5" },
              { label: "Pending", value: pendingCount, icon: Hourglass, color: "text-yellow-500", cardClass: "bg-gradient-to-br from-background to-yellow-500/5" },
              { label: "Lost", value: lostCount, icon: XCircle, color: "text-destructive", cardClass: "bg-gradient-to-br from-background to-destructive/5" },
            ].map(({ label, value, icon: Icon, color, cardClass }) => (
              <Card key={label} className={cardClass}>
                <CardContent className="pt-5 flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <div>
                    {loadingMyLabels ? (
                      <Skeleton className="h-6 w-8" />
                    ) : (
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Label history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Label History</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMyLabels ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : myLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No labels submitted yet. Open a task and stake to start earning.
                </p>
              ) : (
                <div className="space-y-3">
                  {myLabels.map((lbl) => (
                    <div key={lbl.id} className="rounded-lg border p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1">
                            {lbl.attribute_keys.map((k) => (
                              <Badge key={k} variant="outline" className="text-xs">
                                {k.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {lbl.label_task_spec?.instructions ?? `Task #${lbl.task_id}`}
                          </p>
                          <div className="flex items-center gap-3 text-xs">
                            <span>
                              Your label:{" "}
                              <span className="font-medium">{lbl.submitted_label}</span>
                            </span>
                            {lbl.winning_label && lbl.result !== "pending" && (
                              <span className="text-muted-foreground">
                                Majority: <span className="font-medium">{lbl.winning_label}</span>
                                {lbl.total_labellers !== null && (
                                  <span className="ml-1">
                                    ({lbl.majority_count}/{lbl.total_labellers})
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Coins className="h-3 w-3" />
                            {formatEther(BigInt(lbl.stake_required))} ETH staked ·{" "}
                            {new Date(lbl.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge
                          variant={
                            lbl.result === "won"
                              ? "default"
                              : lbl.result === "lost"
                              ? "destructive"
                              : "secondary"
                          }
                          className="shrink-0"
                        >
                          {lbl.result === "won" ? "Won" : lbl.result === "lost" ? "Lost" : "Pending"}
                        </Badge>
                      </div>
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
