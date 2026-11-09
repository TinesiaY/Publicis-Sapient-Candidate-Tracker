import { RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router"
import { listCandidates, restoreCandidate } from "../api/client"
import type { Candidate } from "../api/types"
import { AppShell } from "../components/AppShell"
import { Avatar } from "../components/Avatar"
import { StageBadge } from "../components/StageBadge"
import { formatDate } from "../lib/format"

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function ArchivePage() {
  const [rows, setRows] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})

  useEffect(() => {
    let current = true
    setLoading(true)
    setLoadError("")
    // archived=true asks for archived candidates only.
    listCandidates({ archived: true })
      .then((value) => {
        if (current) setRows(value)
      })
      .catch((error: unknown) => {
        if (current) setLoadError(messageOf(error, "Could not load the archive."))
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [reloadKey])

  async function restore(candidate: Candidate) {
    setRestoringId(candidate.id)
    setRowErrors((previous) => ({ ...previous, [candidate.id]: "" }))
    try {
      await restoreCandidate(candidate.id)
      // The row leaves the archive only after the server confirms the restore.
      setRows((current) => current.filter((row) => row.id !== candidate.id))
    } catch (error) {
      setRowErrors((previous) => ({
        ...previous,
        [candidate.id]: messageOf(error, "Could not restore this candidate. Try again."),
      }))
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <AppShell breadcrumbs={[{ label: "Workspace" }, { label: "Archive" }]}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Archive</h1>
            {!loading && !loadError && (
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-sm text-muted">{rows.length}</span>
            )}
          </div>
          <p className="mt-2 text-muted">
            Archived candidates are hidden from Candidates. Restore one to bring them back with their stage and
            notes unchanged.
          </p>
        </div>
        <Link to="/candidates" className="text-sm font-medium text-brand">
          Back to candidates
        </Link>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span>{loadError}</span>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      {loading && <p className="mt-8 text-muted">Loading archive...</p>}

      {!loading && !loadError && rows.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center text-muted">
          No archived candidates.
        </div>
      )}

      {rows.length > 0 && (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {rows.map((candidate) => {
            const busy = restoringId === candidate.id
            const error = rowErrors[candidate.id]
            return (
              <li key={candidate.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar name={candidate.name} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/candidates/${candidate.id}`} className="font-medium hover:text-brand">
                      {candidate.name}
                    </Link>
                    <p className="text-sm text-muted">{candidate.email}</p>
                  </div>
                  <p className="text-sm text-muted">{candidate.role_name}</p>
                  <StageBadge stage={candidate.stage} />
                  {candidate.archived_at && (
                    <p className="text-sm text-muted">Archived {formatDate(candidate.archived_at)}</p>
                  )}
                  <button
                    type="button"
                    aria-label={`Restore ${candidate.name}`}
                    onClick={() => void restore(candidate)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {busy ? "Restoring..." : "Restore"}
                  </button>
                </div>
                {error && (
                  <p role="alert" className="mt-3 text-sm text-rose-700">
                    {error}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </AppShell>
  )
}
