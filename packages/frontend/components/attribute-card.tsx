import { CheckCircle, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ATTRIBUTE_LABELS } from "@/lib/attributeKeys"

interface Props {
  attribute: string
  verified: boolean
  evidence: string
  method?: string
}

function MethodBadge({ method }: { method?: string }) {
  if (!method) return null
  if (method === "zk") return <Badge variant="secondary" className="text-[#00E5A0] border-[#00E5A0]/30">ZK Proof</Badge>
  if (method === "onchain") return <Badge variant="secondary">On-chain</Badge>
  if (method === "ai_document") return <Badge variant="outline">AI Doc</Badge>
  return null
}

export function AttributeCard({ attribute, verified, evidence, method }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      {verified ? (
        <CheckCircle className="h-5 w-5 text-[#00E5A0] mt-0.5 shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
      )}
      <div className="space-y-0.5 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">
            {ATTRIBUTE_LABELS[attribute as keyof typeof ATTRIBUTE_LABELS] ?? attribute}
          </p>
          <MethodBadge method={method} />
        </div>
        <p className="text-xs text-muted-foreground">{evidence}</p>
      </div>
    </div>
  )
}
