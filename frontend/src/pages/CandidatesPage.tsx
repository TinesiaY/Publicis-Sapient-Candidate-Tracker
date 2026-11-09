import { Ban, ChevronDown, CircleCheck, Inbox, MessagesSquare, Plus, ScanSearch, Search, ArrowDown, ArrowUpRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { getCandidateCounts, listCandidates, listRoles } from "../api/client"
import type { Candidate, CandidateCounts, Role, SortOrder } from "../api/types"
import { STAGES } from "../api/types"
import { AppShell } from "../components/AppShell"
import { Avatar } from "../components/Avatar"
import { StageBadge } from "../components/StageBadge"
import { formatDate } from "../lib/format"

// How long the search box waits after the last keystroke before it searches.
const SEARCH_DEBOUNCE_MS = 300

const STAGE_ICONS: Record<string, LucideIcon> = {
  Applied: Inbox,
  Screening: ScanSearch,
  Interview: MessagesSquare,
  Offer: CircleCheck,
  Rejected: Ban,
}

// Changes filter values in the URL. A null or empty value removes that parameter.
function withParams(previous: URLSearchParams, changes: Record<string, string | null>): URLSearchParams {
  const next = new URLSearchParams(previous)
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  }
  return next
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function CandidatesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // The URL is the source of truth for the filters, so a refresh keeps them.
  // Values that the backend would reject are ignored here.
  const stageParam = searchParams.get("stage") ?? ""
  const stage = (STAGES as readonly string[]).includes(stageParam) ? stageParam : ""
  const roleParam = searchParams.get("role") ?? ""
  const roleId = roleParam !== "" && Number.isInteger(Number(roleParam)) ? Number(roleParam) : undefined
  const sort: SortOrder = searchParams.get("sort") === "stage" ? "stage" : "added"
  const appliedSearch = searchParams.get("q") ?? ""

  // What the user is typing. It reaches the URL only after the debounce delay.
  const [searchInput, setSearchInput] = useState(appliedSearch)
  // The last search value this page wrote to the URL. It tells our own writes apart from Back and Forward.
  const lastWrittenSearch = useRef(appliedSearch)

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState("")
  const [counts, setCounts] = useState<CandidateCounts | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  // A URL change that we did not make (Back, Forward) updates the search box.
  useEffect(() => {
    if (appliedSearch !== lastWrittenSearch.current) {
      lastWrittenSearch.current = appliedSearch
      setSearchInput(appliedSearch)
    }
  }, [appliedSearch])

  // Search once the user has stopped typing. Each new keystroke cancels the previous timer.
  useEffect(() => {
    const term = searchInput.trim()
    if (term === appliedSearch) {
      return
    }
    const timer = window.setTimeout(() => {
      lastWrittenSearch.current = term
      setSearchParams((previous) => withParams(previous, { q: term }), { replace: true })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput, appliedSearch, setSearchParams])

  // Fetch the list whenever a filter in the URL changes. A cancelled flag stops an old response from winning.
  useEffect(() => {
    let current = true
    setListLoading(true)
    setListError("")
    listCandidates({ stage: stage || undefined, roleId, search: appliedSearch, sort })
      .then((rows) => {
        if (current) setCandidates(rows)
      })
      .catch((error: unknown) => {
        if (current) {
          setCandidates([])
          setListError(messageOf(error, "Could not load candidates."))
        }
      })
      .finally(() => {
        if (current) setListLoading(false)
      })
    return () => {
      current = false
    }
  }, [stage, roleId, appliedSearch, sort, reloadKey])

  // The counts cover the whole pipeline, so they do not change with the filters.
  useEffect(() => {
    let current = true
    getCandidateCounts()
      .then((value) => {
        if (current) setCounts(value)
      })
      .catch(() => {
        if (current) setCounts(null)
      })
    return () => {
      current = false
    }
  }, [reloadKey])

  useEffect(() => {
    let current = true
    listRoles()
      .then((value) => {
        if (current) setRoles(value)
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [])

  function changeStage(value: string) {
    setSearchParams((previous) => withParams(previous, { stage: value }), { replace: true })
  }

  function changeRole(value: string) {
    setSearchParams((previous) => withParams(previous, { role: value }), { replace: true })
  }

  function changeSort(value: SortOrder) {
    setSearchParams((previous) => withParams(previous, { sort: value === "added" ? null : "stage" }), {
      replace: true,
    })
  }

  function clearFilters() {
    lastWrittenSearch.current = ""
    setSearchInput("")
    setSearchParams(
      (previous) => withParams(previous, { stage: null, role: null, q: null, sort: null }),
      { replace: true },
    )
  }

  const hasFilters = stage !== "" || roleId !== undefined || appliedSearch !== "" || searchInput.trim() !== ""
  const total = counts?.total ?? candidates.length
  const selectedRole = roles.find((role) => role.id === roleId)
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const initialLoad = listLoading && candidates.length === 0

  return (
    <AppShell breadcrumbs={[{ label: "Workspace" }, { label: "Candidates" }]} candidateCount={counts?.total}>
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
        {STAGES.map((name) => {
          const Icon = STAGE_ICONS[name]
          const count = counts?.by_stage[name] ?? 0
          return (
            <div key={name} className="rounded-xl border border-line bg-white p-5">
              <div className="flex items-center justify-between text-sm text-muted">
                <span>{name}</span>
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
          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-sm text-muted">{total}</span>
        </div>
        <span className="text-sm text-muted">
          {selectedRole?.name ?? "All roles"} · {monthLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search name or email"
            placeholder="Search name or email..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full rounded-lg border border-line bg-white py-2.5 pr-3.5 pl-10 text-sm shadow-xs focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
          />
        </div>

        <SelectFilter label="Filter by stage" value={stage} onChange={changeStage}>
          <option value="">All stages</option>
          {STAGES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectFilter>

        <SelectFilter label="Filter by role" value={roleId === undefined ? "" : String(roleId)} onChange={changeRole}>
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role.id} value={String(role.id)}>
              {role.name}
            </option>
          ))}
        </SelectFilter>

        <div className="ml-auto flex items-center gap-2 text-sm text-muted">
          <span>Sort by</span>
          <div role="group" aria-label="Sort by" className="flex rounded-lg bg-stone-100 p-1">
            <SortButton active={sort === "added"} onClick={() => changeSort("added")}>
              Date added
              {sort === "added" && <ArrowDown className="size-3.5" aria-hidden="true" />}
            </SortButton>
            <SortButton active={sort === "stage"} onClick={() => changeSort("stage")}>
              Stage
            </SortButton>
          </div>
        </div>
      </div>

      {listError && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span>{listError}</span>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="font-medium underline">
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
            {initialLoad && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  Loading candidates...
                </td>
              </tr>
            )}

            {!listLoading && !listError && candidates.length === 0 && !hasFilters && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  No candidates yet. <Link to="/candidates/new" className="font-medium text-brand">Add the first one</Link>.
                </td>
              </tr>
            )}

            {!listLoading && !listError && candidates.length === 0 && hasFilters && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  No candidates match these filters.
                  <button type="button" onClick={clearFilters} className="ml-2 font-medium text-brand">
                    Clear filters
                  </button>
                </td>
              </tr>
            )}

            {candidates.map((candidate) => (
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

        {!listError && !initialLoad && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-muted">
            <span>
              Showing {candidates.length} of {total} candidates
            </span>
            {listLoading && <span>Updating...</span>}
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
