import { ArrowUpRight, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router"
import { listRoles } from "../api/client"
import type { Role } from "../api/types"
import { AppShell } from "../components/AppShell"

export function JobsPage() {
  const [jobs, setJobs] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let current = true
    listRoles()
      .then((rows) => {
        if (current) setJobs(rows)
      })
      .catch((error: unknown) => {
        if (current) setLoadError(error instanceof Error ? error.message : "Could not load jobs.")
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [reloadKey])

  // Try again shows loading first, so the effect itself never sets state.
  function retryLoad() {
    setLoading(true)
    setLoadError("")
    setReloadKey((key) => key + 1)
  }

  return (
    <AppShell breadcrumbs={[{ label: "Workspace" }, { label: "Jobs" }]}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-2 text-muted">Open a job to read its description and see who has applied.</p>
        </div>
        <Link
          to="/jobs/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-hover"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add new job
        </Link>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span>{loadError}</span>
          <button type="button" onClick={retryLoad} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      {loading && <p className="mt-8 text-muted">Loading jobs...</p>}

      {!loading && !loadError && jobs.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center text-muted">
          No jobs yet. <Link to="/jobs/new" className="font-medium text-brand">Add the first job</Link>.
        </div>
      )}

      {jobs.length > 0 && (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                to={`/jobs/${job.id}`}
                className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-page"
              >
                <div>
                  <p className="font-medium">{job.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {job.candidate_count === 1 ? "1 candidate" : `${job.candidate_count} candidates`}
                  </p>
                </div>
                <ArrowUpRight className="size-4 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
