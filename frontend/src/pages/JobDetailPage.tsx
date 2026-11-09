import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { ApiError, getRole, listCandidates } from "../api/client"
import type { Candidate, RoleDetail } from "../api/types"
import { AppShell } from "../components/AppShell"
import { Avatar } from "../components/Avatar"
import { StageBadge } from "../components/StageBadge"

export function JobDetailPage() {
  const { jobId } = useParams()
  const roleId = Number(jobId)

  const [job, setJob] = useState<RoleDetail | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setError("")

    // The API filters the candidates, so only this job's candidates are sent to the page.
    Promise.all([getRole(roleId), listCandidates({ roleId })])
      .then(([role, jobCandidates]) => {
        if (cancelled) return
        setJob(role)
        setCandidates(jobCandidates)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setError(err instanceof Error ? err.message : "Could not load this job.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [roleId])

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "Workspace" }, { label: "Jobs", to: "/jobs" }]}>
        <p className="text-muted">Loading job...</p>
      </AppShell>
    )
  }

  if (notFound || !job) {
    return (
      <AppShell breadcrumbs={[{ label: "Workspace" }, { label: "Jobs", to: "/jobs" }]}>
        {error ? (
          <p role="alert" className="text-rose-700">
            {error}
          </p>
        ) : (
          <p className="text-muted">This job does not exist.</p>
        )}
        <Link to="/jobs" className="mt-4 inline-block font-medium text-brand">
          Back to jobs
        </Link>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumbs={[{ label: "Workspace" }, { label: "Jobs", to: "/jobs" }, { label: job.name }]}>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{job.name}</h1>
        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-sm text-muted">
          {candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}
        </span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">Job description</h2>
          <p className="mt-4 whitespace-pre-line leading-relaxed text-ink">{job.jd_text}</p>
        </section>

        <section className="rounded-xl border border-line bg-white">
          <div className="border-b border-line px-6 py-5">
            <h2 className="text-lg font-semibold">Candidates</h2>
          </div>
          {candidates.length === 0 ? (
            <div className="px-6 py-8 text-sm text-muted">
              No candidates have applied for this job yet.{" "}
              <Link to="/candidates/new" className="font-medium text-brand">
                Add a candidate
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {candidates.map((candidate) => (
                <li key={candidate.id} className="flex items-center gap-3 px-6 py-4">
                  <Avatar name={candidate.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{candidate.name}</p>
                    <p className="truncate text-sm text-muted">{candidate.email}</p>
                  </div>
                  <StageBadge stage={candidate.stage} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  )
}
