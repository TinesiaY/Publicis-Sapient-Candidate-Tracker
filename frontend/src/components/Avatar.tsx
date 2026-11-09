import { initials } from "../lib/format"

export function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-medium text-muted"
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
