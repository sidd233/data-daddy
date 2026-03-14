import { formatEther } from "viem"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ATTRIBUTE_LABELS, ATTRIBUTE_TIERS } from "@/lib/attributeKeys"

export interface MatchedRequest {
  id: number
  on_chain_id: number
  attribute_key: string
  price_per_user: string
  lease_duration_sec: number
  buyer_address: string
  min_confidence: number
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function durationLabel(sec: number) {
  const days = Math.floor(sec / 86400)
  return days > 0 ? `${days}d` : `${Math.floor(sec / 3600)}h`
}

interface Props {
  request: MatchedRequest
  approving: boolean
  onApprove: (request: MatchedRequest) => void
}

export function MatchedRequestRow({ request, approving, onApprove }: Props) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {ATTRIBUTE_LABELS[request.attribute_key as keyof typeof ATTRIBUTE_LABELS] ?? request.attribute_key}
          </Badge>
          {(() => {
            const tier = ATTRIBUTE_TIERS[request.attribute_key as keyof typeof ATTRIBUTE_TIERS]
            if (tier === 1) return <Badge variant="secondary">Tier 1 · On-chain</Badge>
            if (tier === 2) return <Badge variant="secondary" className="text-[#00E5A0] border-[#00E5A0]/30">Tier 2 · ZK</Badge>
            return <Badge variant="outline">Tier 3 · AI</Badge>
          })()}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatEther(BigInt(request.price_per_user))} ETH ·{" "}
          {durationLabel(request.lease_duration_sec)} lease · Buyer:{" "}
          {shortAddr(request.buyer_address)}
        </p>
      </div>
      <Button size="sm" onClick={() => onApprove(request)} disabled={approving}>
        {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
      </Button>
    </div>
  )
}
