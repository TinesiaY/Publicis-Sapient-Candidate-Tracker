import { Info, LoaderCircle, RefreshCw, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { getSummary, regenerateSummary, retrySummary } from "../api/client"
import type { SummaryRead } from "../api/types"
import { formatDate } from "../lib/format"
import { canRetry, failureMessage } from "../lib/summary"

// How long to wait between checks while a summary is pending.
const POLL_INTERVAL_MS = 2000

interface SummaryPanelProps {
  candidateId: number
  isArchived: boolean
  pollIntervalMs?: number
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function SummaryPanel({ candidateId, isArchived, pollIntervalMs = POLL_INTERVAL_MS }: SummaryPanelProps) {
  const [summary, setSummary] = useState<SummaryRead | null>(null)
  const [loadError, setLoadError] = useState("")
  // Each change runs one more check. A pending summary schedules one, and Try again runs one.
  const [checkNumber, setCheckNumber] = useState(0)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState("")

  // Cleanup cancels the timer and ignores a reply that arrives late, so a stale reply cannot overwrite a newer state.
  useEffect(() => {
    let current = true
    let timer: number | undefined
    getSummary(candidateId).then(
      (next) => {
        if (!current) return
        setSummary(next)
        setLoadError("")
        if (next.status === "pending") {
          timer = window.setTimeout(() => setCheckNumber((number) => number + 1), pollIntervalMs)
        }
      },
      (error: unknown) => {
        // A failed check stops polling and keeps the last state on screen. The user can try again.
        if (!current) return
        setLoadError(messageOf(error, "Could not check the summary."))
      },
    )
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [candidateId, checkNumber, pollIntervalMs])

  function tryAgain() {
    setLoadError("")
    setCheckNumber((number) => number + 1)
  }

  async function startNewSummary(start: (id: number) => Promise<SummaryRead>) {
    setActionBusy(true)
    setActionError("")
    try {
      setSummary(await start(candidateId))
      setLoadError("")
      setCheckNumber((number) => number + 1)
    } catch (error) {
      // The last state stays on screen, and the message says what went wrong.
      setActionError(messageOf(error, "Could not start the summary. Try again."))
    } finally {
      setActionBusy(false)
    }
  }

  const canAct =
    summary !== null &&
    (summary.status === "ready" ||
      (summary.status === "failed" && canRetry(summary.error_code, summary.provider_configured)))

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <header className="flex items-center justify-between gap-4 bg-brand-soft px-6 py-4">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold text-brand">
          <Sparkles className="size-5" aria-hidden="true" />
          Resume summary
        </h2>
        <span className="text-xs font-semibold tracking-wider text-brand uppercase">AI generated</span>
      </header>

      <div className="space-y-5 px-6 py-5">
        {loadError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span>{loadError}</span>
            <button type="button" onClick={tryAgain} className="font-medium underline">
              Try again
            </button>
          </div>
        )}

        {summary === null && !loadError && <p className="text-muted">Loading summary...</p>}

        {summary?.status === "pending" && (
          <div className="flex items-start gap-3">
            <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-brand" aria-hidden="true" />
            <div>
              <p className="font-medium">Generating summary...</p>
              <p className="mt-1 text-sm text-muted">
                This usually takes under a minute. The summary appears here when it is ready.
              </p>
            </div>
          </div>
        )}

        {summary?.status === "failed" && (
          <p className="text-ink">{failureMessage(summary.error_code, summary.provider_configured)}</p>
        )}

        {summary?.status === "ready" && <ReadyContent summary={summary} />}

        {actionError && (
          <p role="alert" className="text-sm text-rose-700">
            {actionError}
          </p>
        )}
      </div>

      {summary !== null && canAct && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4 text-sm">
          <span className="text-muted">
            {summary.status === "ready" ? `Generated ${formatDate(summary.created_at)}` : ""}
          </span>
          {isArchived ? (
            <span className="text-muted">
              Restore this candidate to {summary.status === "ready" ? "regenerate" : "retry"} their summary.
            </span>
          ) : (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void startNewSummary(summary.status === "ready" ? regenerateSummary : retrySummary)}
              className="inline-flex items-center gap-2 font-medium text-ink hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {summary.status === "ready" ? "Regenerate" : "Retry"}
            </button>
          )}
        </div>
      )}

      <p className="flex items-start gap-2 px-6 pt-4 pb-5 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        AI can miss context. Review against the original resume before making a decision.
      </p>
    </section>
  )
}

function ReadyContent({ summary }: { summary: SummaryRead }) {
  const skills = summary.skills ?? []
  const highlights = summary.highlights ?? []

  return (
    <div className="space-y-5">
      {summary.suspicious_input && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Possible instructions in the resume</p>
          <p className="mt-1">The summary ignores them. Check the resume yourself.</p>
        </div>
      )}

      <p className="whitespace-pre-line leading-relaxed text-ink">{summary.summary}</p>

      {skills.length === 0 && highlights.length === 0 ? (
        <p className="text-sm text-muted">No clear skills or experience found.</p>
      ) : (
        <>
          {skills.length > 0 && (
            <ul aria-label="Skills" className="flex flex-wrap gap-2">
              {skills.map((skill, index) => (
                <li key={`${index}-${skill}`} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-ink">
                  {skill}
                </li>
              ))}
            </ul>
          )}

          {highlights.length > 0 && (
            <ul className="space-y-3">
              {highlights.map((highlight, index) => (
                <li key={index} className="border-l-2 border-brand-soft pl-4">
                  <p className="font-medium text-ink">{highlight.text}</p>
                  <p className="mt-1 text-sm text-muted">“{highlight.quote}”</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
