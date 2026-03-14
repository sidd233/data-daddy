import { formatEther } from "viem"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ATTRIBUTE_LABELS } from "@/lib/attributeKeys"

export interface LeaseItem {
  id: number
  on_chain_id: number
  status: string
  started_at: string
  expires_at: string
  paid_amount: string
  settled_at: string | null
  revoked_at: string | null
  attribute_key: string
  buyer_address: string
  price_per_user: string
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Active:   "secondary",
  Settled:  "default",
  Revoked:  "destructive",
  Cancelled:"outline",
}

interface Props {
  lease: LeaseItem
  actioning: boolean
  onRevoke?: (lease: LeaseItem) => void
  onSettle?: (lease: LeaseItem) => void
}

export function LeaseRow({ lease, actioning, onRevoke, onSettle }: Props) {
  const expired = new Date(lease.expires_at) <= new Date()
  const isActive = lease.status === "Active"

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">
            {ATTRIBUTE_LABELS[lease.attribute_key as keyof typeof ATTRIBUTE_LABELS] ?? lease.attribute_key}
          </p>
          <Badge variant={STATUS_BADGE[lease.status] ?? "outline"}>{lease.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatEther(BigInt(lease.paid_amount))} ETH ·{" "}
          {isActive
            ? expired
              ? "Expired — ready to settle"
              : `Expires ${new Date(lease.expires_at).toLocaleDateString()}`
            : `Started ${new Date(lease.started_at).toLocaleDateString()}`}
        </p>
      </div>

      {isActive && (
        <div className="flex gap-2">
          {expired ? (
            <Button size="sm" onClick={() => onSettle?.(lease)} disabled={actioning}>
              {actioning ? <Loader2 className="h-3 w-3 animate-spin" /> : "Settle"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onRevoke?.(lease)}
              disabled={actioning}
            >
              {actioning ? <Loader2 className="h-3 w-3 animate-spin" /> : "Revoke"}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
