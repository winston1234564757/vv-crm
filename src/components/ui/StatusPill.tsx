import { Badge } from "@/components/ui/Badge";
import { labelOf, type LabelMap } from "@/lib/domain-labels";

export interface StatusPillProps {
  /** A map from `@/lib/domain-labels`, e.g. `repairStatus`. */
  map: LabelMap;
  /** The raw database value. */
  value: string | null | undefined;
  /** Leading dot — useful in dense tables where the pill is the only colour. */
  dot?: boolean;
  className?: string;
}

/**
 * Renders a domain status as a Badge, with the label and tone both resolved
 * from a single map. Callers pass data, never a colour — which is the point:
 * the same status can no longer look different in the list and the drawer.
 */
export function StatusPill({ map, value, dot = false, className }: StatusPillProps) {
  const { label, tone } = labelOf(map, value);
  return (
    <Badge tone={tone} dot={dot} className={className}>
      {label}
    </Badge>
  );
}
