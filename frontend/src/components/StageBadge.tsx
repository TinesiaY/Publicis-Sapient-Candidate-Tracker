interface StageStyle {
  badge: string
  dot: string
}

const STAGE_STYLES: Record<string, StageStyle> = {
  Applied: { badge: "bg-stone-100 text-stone-600", dot: "bg-stone-400" },
  Screening: { badge: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  Interview: { badge: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  Offer: { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  Rejected: { badge: "bg-rose-50 text-rose-700", dot: "bg-rose-400" },
}

export function StageBadge({ stage }: { stage: string }) {
  const style = STAGE_STYLES[stage] ?? STAGE_STYLES.Applied
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${style.badge}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {stage}
    </span>
  )
}
