import { Ban, ChevronDown, CircleCheck, Inbox, MessagesSquare, Plus, ScanSearch, Search, ArrowDown, ArrowUpRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { listCandidates } from "../api/client"
import type { Candidate } from "../api/types"
import { STAGES } from "../api/types"
import { AppShell } from "../components/AppShell"
import { Avatar } from "../components/Avatar"
import { StageBadge } from "../components/StageBadge"
import { formatDate } from "../lib/format"

const STAGE_ICONS: Record<string, LucideIcon> = {
  Applied: Inbox,
  Screening: ScanSearch,
  Interview: MessagesSquare,
  Offer: CircleCheck,
  Rejected: Ban,
}

type SortKey = "added" | "stage"

function stageRank(stage: string): number {
  return (STAGES as readonly string[]).indexOf(stage)
}

function newestFirst(a: Candidate, b: Candidate): number {
  return Date.parse(b.created_at) - Date.parse(a.created_at)
}

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("added")

  const loadCandidates = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      setCandidates(await listCandidates())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load candidates.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCandidates()
  }, [loadCandidates])

  const roleNames = useMemo(
    () => [...new Set(candidates.map((candidate) => candidate.role_name))].sort(),
    [candidates],
  )

  const stageCounts = useMemo(
    () => STAGES.map((stage) => ({ stage, count: candidates.filter((c) => c.stage === stage).length })),
    [candidates],
  )

  // Filtering and sorting run in the browser for now. Milestone 4 moves them to the backend.
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = candidates.filter(
      (candidate) =>
        (query === "" ||
          candidate.name.toLowerCase().includes(query) ||
          candidate.email.toLowerCase().includes(query)) &&
        (stageFilter === "" || candidate.stage === stageFilter) &&
        (roleFilter === "" || candidate.role_name === roleFilter),
    )
    if (sortKey === "stage") {
      return [...matches].sort((a, b) => stageRank(a.stage) - stageRank(b.stage) || newestFirst(a, b))
    }
    return [...matches].sort(newestFirst)
  }, [candidates, search, stageFilter, roleFilter, sortKey])

  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const hasFilters = search !== "" || stageFilter !== "" || roleFilter !== ""

  return (
    <AppShell
      breadcrumbs={[{ label: "Workspace" }, { label: "Candidates" }]}
      candidateCount={candidates.length}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Candidates</h1>
        <Link
          to="/candidates/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-hover"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add candidate
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stageCounts.map(({ stage, count }) => {
          const Icon = STAGE_ICONS[stage]
          return (
            <div key={stage} className="rounded-xl border border-line bg-white p-5">
              <div className="flex items-center justify-between text-sm text-muted">
                <span>{stage}</span>
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <div className="mt-6 flex items-end justify-between">
                <span className="text-3xl font-semibold">{count}</span>
                <span className="text-xs text-muted">{count === 1 ? "candidate" : "candidates"}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">All candidates</h2>
          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-sm text-muted">{candidates.length}</span>
        </div>
        <span className="text-sm text-muted">
          {roleFilter || "All roles"} · {monthLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search name or email"
            placeholder="Search name or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-line bg-white py-2.5 pr-3.5 pl-10 text-sm shadow-xs focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
          />
        </div>

        <SelectFilter label="Filter by stage" value={stageFilter} onChange={setStageFilter}>
          <option value="">All stages</option>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </SelectFilter>

        <SelectFilter label="Filter by role" value={roleFilter} onChange={setRoleFilter}>
          <option value="">All roles</option>
          {roleNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectFilter>

        <div className="ml-auto flex items-center gap-2 text-sm text-muted">
          <span>Sort by</span>
          <div role="group" aria-label="Sort by" className="flex rounded-lg bg-stone-100 p-1">
            <SortButton active={sortKey === "added"} onClick={() => setSortKey("added")}>
              Date added
              {sortKey === "added" && <ArrowDown className="size-3.5" aria-hidden="true" />}
            </SortButton>
            <SortButton active={sortKey === "stage"} onClick={() => setSortKey("stage")}>
              Stage
            </SortButton>
          </div>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadCandidates()} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs tracking-wide text-muted uppercase">
            <tr className="border-b border-line">
              <th scope="col" className="px-5 py-3 font-medium">Candidate</th>
              <th scope="col" className="px-5 py-3 font-medium">Role applied for</th>
              <th scope="col" className="px-5 py-3 font-medium">Stage</th>
              <th scope="col" className="px-5 py-3 font-medium">Source</th>
              <th scope="col" className="px-5 py-3 font-medium">Date added</th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  Loading candidates...
                </td>
              </tr>
            )}

            {!loading && !loadError && candidates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  No candidates yet. <Link to="/candidates/new" className="font-medium text-brand">Add the first one</Link>.
                </td>
              </tr>
            )}

            {!loading && candidates.length > 0 && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  No candidates match these filters.
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("")
                        setStageFilter("")
                        setRoleFilter("")
                      }}
                      className="ml-2 font-medium text-brand"
                    >
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            )}

            {visible.map((candidate) => (
              <tr key={candidate.id} className="border-b border-line last:border-b-0 hover:bg-page">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={candidate.name} />
                    <div>
                      <p className="font-medium">{candidate.name}</p>
                      <p className="text-muted">{candidate.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-ink">{candidate.role_name}</td>
                <td className="px-5 py-4">
                  <StageBadge stage={candidate.stage} />
                </td>
                <td className="px-5 py-4 text-muted">{candidate.source ?? "—"}</td>
                <td className="px-5 py-4 text-muted">{formatDate(candidate.created_at)}</td>
                <td className="px-5 py-4 text-right text-muted">
                  <ArrowUpRight className="ml-auto size-4" aria-hidden="true" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && candidates.length > 0 && (
          <div className="border-t border-line px-5 py-3 text-sm text-muted">
            Showing {visible.length} of {candidates.length} candidates
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-muted">Sort by date added or stage to find the next candidate to move forward.</p>
    </AppShell>
  )
}

function SelectFilter({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none rounded-lg border border-line bg-white py-2.5 pr-9 pl-3.5 text-sm shadow-xs focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  )
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  )
}
