"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ATTRIBUTE_LABELS, ATTRIBUTE_TIERS } from "@/lib/attributeKeys"
import { Loader2 } from "lucide-react"

const ATTRIBUTE_OPTIONS = Object.entries(ATTRIBUTE_LABELS) as [string, string][]

const DURATION_OPTIONS = [
  { label: "1 hour",   value: 3600 },
  { label: "1 day",    value: 86400 },
  { label: "7 days",   value: 604800 },
  { label: "30 days",  value: 2592000 },
]

const EXPIRY_OPTIONS = [
  { label: "1 day",   value: 1 },
  { label: "3 days",  value: 3 },
  { label: "7 days",  value: 7 },
  { label: "30 days", value: 30 },
]

interface FormValues {
  attributeKey: string
  minConfidence: number
  pricePerUserEth: string
  leaseDurationSec: number
  expiryDays: number
  maxUsers: number
  aiAllowed: boolean
}

interface Props {
  onSubmit: (values: FormValues) => Promise<void>
}

export function RequestForm({ onSubmit }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [values, setValues] = useState<FormValues>({
    attributeKey: "active_wallet",
    minConfidence: 100,
    pricePerUserEth: "0.01",
    leaseDurationSec: 86400,
    expiryDays: 7,
    maxUsers: 100,
    aiAllowed: false,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Attribute</Label>
          <Select
            value={values.attributeKey}
            onValueChange={(v) => {
              const tier = ATTRIBUTE_TIERS[v as keyof typeof ATTRIBUTE_TIERS]
              setValues((p) => ({
                ...p,
                attributeKey: v,
                minConfidence: tier === 1 || tier === 2 ? 100 : p.minConfidence,
              }))
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTRIBUTE_OPTIONS.map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Minimum tier</Label>
          <Select
            value={String(values.minConfidence)}
            onValueChange={(v) => setValues((p) => ({ ...p, minConfidence: Number(v) }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="100">Tier 1 — On-chain verified (100%)</SelectItem>
              <SelectItem value="50">Tier 2 — ZK verified (50%+)</SelectItem>
              <SelectItem value="1">Tier 3 — AI verified (any)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Price per user (ETH)</Label>
          <Input
            type="number"
            step="0.001"
            min="0.001"
            value={values.pricePerUserEth}
            onChange={(e) => setValues((p) => ({ ...p, pricePerUserEth: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Lease duration</Label>
          <Select
            value={String(values.leaseDurationSec)}
            onValueChange={(v) => setValues((p) => ({ ...p, leaseDurationSec: Number(v) }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Request expires in</Label>
          <Select
            value={String(values.expiryDays)}
            onValueChange={(v) => setValues((p) => ({ ...p, expiryDays: Number(v) }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Max users</Label>
          <Input
            type="number"
            min="1"
            value={values.maxUsers}
            onChange={(e) => setValues((p) => ({ ...p, maxUsers: Number(e.target.value) }))}
            required
          />
        </div>

        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={values.aiAllowed}
            onCheckedChange={(v) => setValues((p) => ({ ...p, aiAllowed: v }))}
          />
          <Label>Allow AI-verified attributes</Label>
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {submitting ? "Posting…" : "Post Request"}
      </Button>
    </form>
  )
}
