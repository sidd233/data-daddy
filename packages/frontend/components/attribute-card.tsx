import { CheckCircle, XCircle } from "lucide-react"
import { ATTRIBUTE_LABELS } from "@/lib/attributeKeys"

interface Props {
  attribute: string
  verified: boolean
  evidence: string
}

export function AttributeCard({ attribute, verified, evidence }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      {verified ? (
        <CheckCircle className="h-5 w-5 text-[#00E5A0] mt-0.5 shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
      )}
      <div className="space-y-0.5">
        <p className="text-sm font-medium">
          {ATTRIBUTE_LABELS[attribute as keyof typeof ATTRIBUTE_LABELS] ?? attribute}
        </p>
        <p className="text-xs text-muted-foreground">{evidence}</p>
      </div>
    </div>
  )
}
