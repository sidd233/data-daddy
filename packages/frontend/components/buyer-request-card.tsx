import { formatEther } from "viem"
import { Badge } from "@/components/ui/badge"
import { ATTRIBUTE_LABELS } from "@/lib/attributeKeys"
import { Users } from "lucide-react"

export interface BuyerRequest {
  id: number
  on_chain_id: number
  attribute_key: string
  price_per_user: string
  lease_duration_sec: number
  expires_at: string
  max_users: number
  filled_count: number
  approved_count: number
  active: boolean
}

function durationLabel(sec: number) {
  const days = Math.floor(sec / 86400)
  return days > 0 ? `${days}d` : `${Math.floor(sec / 3600)}h`
}

export function BuyerRequestCard({ req }: { req: BuyerRequest }) {
  const expired = new Date(req.expires_at) <= new Date()
  const fill = Math.min(100, Math.round((req.approved_count / req.max_users) * 100))

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">
            {ATTRIBUTE_LABELS[req.attribute_key as keyof typeof ATTRIBUTE_LABELS] ?? req.attribute_key}
          </p>
          <Badge variant={expired || !req.active ? "outline" : "secondary"}>
            {expired ? "Expired" : req.active ? "Active" : "Closed"}
          </Badge>
        </div>
        <p className="text-sm font-medium text-[#00E5A0]">
          {formatEther(BigInt(req.price_per_user))} ETH
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Lease: {durationLabel(req.lease_duration_sec)}</span>
        <span>Expires: {new Date(req.expires_at).toLocaleDateString()}</span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" />
            {req.approved_count} / {req.max_users} users
          </span>
          <span className="text-muted-foreground">{fill}% filled</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-[#00E5A0] transition-all"
            style={{ width: `${fill}%` }}
          />
        </div>
      </div>
    </div>
  )
}
