import { Archive, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { ApiError, archiveCandidate, getCandidate, restoreCandidate, updateCandidateStage } from "../api/client"
import type { CandidateDetail, StageName } from "../api/types"
import { STAGES } from "../api/types"
import { AppShell } from "../components/AppShell"
import { Avatar } from "../components/Avatar"
import { NotesPanel } from "../components/NotesPanel"
import { ReplaceResumePanel } from "../components/ReplaceResumePanel"
import { StageBadge } from "../components/StageBadge"
import { formatDate } from "../lib/format"

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

const CANDIDATES_CRUMB = { label: "Candidates", to: "/candidates" }

export function CandidateDetailPage() {
  const { candidateId } = useParams()
  const id = Number(candidateId)

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  // Each action has its own pending flag and error, so one failure does not hide another.
  const [stageSaving, setStageSaving] = useState(false)
  const [stageError, setStageError] = useState("")
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveError, setArchiveError] = useState("")
  const [replacingResume, setReplacingResume] = useState(false)

  useEffect(() => {
    let current = true
    setLoading(true)
    setNotFound(false)
    setLoadError("")
    setStageError("")
    setArchiveError("")
    setConfirmingArchive(false)
    setReplacingResume(false)

    getCandidate(id)
      .then((value) => {
        if (current) setCandidate(value)
      })
      .catch((error: unknown) => {
        if (!current) return
        if (error instanceof ApiError && error.status === 404) {
          setNotFound(true)
        } else {
          setLoadError(messageOf(error, "Could not load this candidate."))
        }
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
    }
  }, [id, reloadKey])

  const busy = stageSaving || archiveBusy

  // The page changes only after the server confirms, so it never shows a change that was not saved.
  async function changeStage(stage: StageName) {
    if (!candidate || busy || stage === candidate.stage) return
    setStageSaving(true)
    setStageError("")
    try {
      setCandidate(await updateCandidateStage(candidate.id, stage))
    } catch (error) {
      setStageError(messageOf(error, "Could not change the stage. Try again."))
    } finally {
      setStageSaving(false)
    }
  }

  async function archive() {
    if (!candidate || busy) return
    setArchiveBusy(true)
    setArchiveError("")
    try {
      setCandidate(await archiveCandidate(candidate.id))
      setConfirmingArchive(false)
      setReplacingResume(false)
    } catch (error) {
      setArchiveError(messageOf(error, "Could not archive this candidate. Try again."))
    } finally {
      setArchiveBusy(false)
    }
  }

  async function restore() {
    if (!candidate || busy) return
    setArchiveBusy(true)
    setArchiveError("")
    try {
      setCandidate(await restoreCandidate(candidate.id))
    } catch (error) {
      setArchiveError(messageOf(error, "Could not restore this candidate. Try again."))
    } finally {
      setArchiveBusy(false)
    }
  }

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "Workspace" }, CANDIDATES_CRUMB]}>
        <p className="text-muted">Loading candidate...</p>
      </AppShell>
    )
  }

  if (!candidate) {
    return (
      <AppShell breadcrumbs={[{ label: "Workspace" }, CANDIDATES_CRUMB]}>
        {notFound ? (
          <p className="text-muted">This candidate does not exist.</p>
        ) : (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span>{loadError}</span>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="font-medium underline">
              Try again
            </button>
          </div>
        )}
        <Link to="/candidates" className="mt-4 inline-block font-medium text-brand">
          Back to candidates
        </Link>
      </AppShell>
    )
  }

  const isArchived = candidate.archived_at !== null

  return (
    <AppShell breadcrumbs={[{ label: "Workspace" }, CANDIDATES_CRUMB, { label: candidate.name }]}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <Avatar name={candidate.name} />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{candidate.name}</h1>
              <StageBadge stage={candidate.stage} />
              {isArchived && (
                <span className="rounded-full bg-stone-200 px-2.5 py-1 text-sm font-medium text-stone-700">
                  Archived
                </span>
              )}
            </div>
            <p className="mt-1 text-muted">{candidate.role_name}</p>
          </div>
        </div>

        <div className="flex max-w-md flex-col items-end gap-3">
          {isArchived ? (
            <button
              type="button"
              onClick={() => void restore()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Restore candidate
            </button>
          ) : confirmingArchive ? (
            <div className="rounded-lg border border-line bg-white p-4 text-sm">
              <p>
                Archive {candidate.name}? They will be hidden from Candidates. You can restore them from the
                archive, with their stage and notes unchanged.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingArchive(false)}
                  disabled={archiveBusy}
                  className="rounded-lg border border-line bg-white px-3 py-2 font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void archive()}
                  disabled={archiveBusy}
                  className="rounded-lg bg-brand px-3 py-2 font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Yes, archive
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingArchive(true)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Archive className="size-4" aria-hidden="true" />
              Archive candidate
            </button>
          )}

          {archiveError && (
            <p role="alert" className="text-sm text-rose-700">
              {archiveError}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-8 grid gap-6 rounded-xl border border-line bg-white p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Email address</dt>
          <dd className="mt-1 text-sm">{candidate.email}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Phone number</dt>
          <dd className="mt-1 text-sm">{candidate.phone ?? "Not given"}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Source</dt>
          <dd className="mt-1 text-sm">{candidate.source ?? "Not given"}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Date added</dt>
          <dd className="mt-1 text-sm">{formatDate(candidate.created_at)}</dd>
        </div>
      </dl>

      <section className="mt-6 rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Hiring stage</h2>
              {stageSaving && <span className="text-sm text-muted">Saving...</span>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {isArchived ? "Restore this candidate to change their stage." : "Move to any stage, at any time."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((name) => {
              const selected = candidate.stage === name
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => void changeStage(name)}
                  disabled={busy || isArchived}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:bg-stone-50"
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>

        {stageError && (
          <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {stageError}
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-line bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Resume &amp; application</h2>
            {!replacingResume && (
              <button
                type="button"
                onClick={() => setReplacingResume(true)}
                disabled={busy || isArchived}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Replace resume
              </button>
            )}
          </div>
          {isArchived && <p className="mt-2 text-sm text-muted">Restore this candidate to replace their resume.</p>}

          {replacingResume && (
            <ReplaceResumePanel
              candidateId={candidate.id}
              onSaved={(updated) => {
                setCandidate(updated)
                setReplacingResume(false)
              }}
              onCancel={() => setReplacingResume(false)}
            />
          )}

          <p className="mt-4 whitespace-pre-wrap leading-relaxed">{candidate.resume_text}</p>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-dashed border-line bg-white p-6">
            <h2 className="text-lg font-semibold">Resume summary</h2>
            <p className="mt-2 text-sm text-muted">AI summaries arrive in a later milestone.</p>
          </section>
          <NotesPanel candidateId={candidate.id} />
        </div>
      </div>
    </AppShell>
  )
}
