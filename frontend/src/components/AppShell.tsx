import { Archive, Briefcase, Layers, Users } from "lucide-react"
import type { ReactNode } from "react"
import { Link, NavLink } from "react-router"

interface AppShellProps {
  children: ReactNode
  breadcrumbs: { label: string; to?: string }[]
  candidateCount?: number
}

const NAV_ITEM = "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium"

export function AppShell({ children, breadcrumbs, candidateCount }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line bg-page px-6">
        <div className="flex items-center gap-3">
          <Link to="/candidates" className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand text-white">
              <Layers className="size-5" aria-hidden="true" />
            </div>
            <span className="text-lg font-medium">Candidate Tracker</span>
          </Link>
          <span className="text-muted" aria-hidden="true">
            /
          </span>
          <span className="text-sm text-muted">Acme workspace</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>Hiring workspace</span>
          <span className="flex size-8 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-ink">
            AC
          </span>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-60 shrink-0 border-r border-line bg-sidebar px-4 py-6">
          <p className="px-3 text-xs font-medium tracking-wide text-muted uppercase">Workspace</p>
          <nav aria-label="Main" className="mt-3 flex flex-col gap-1">
            <NavLink
              to="/candidates"
              className={({ isActive }) =>
                `${NAV_ITEM} ${isActive ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"}`
              }
            >
              <span className="flex items-center gap-3">
                <Users className="size-5" aria-hidden="true" />
                Candidates
              </span>
              {candidateCount !== undefined && <span className="text-xs text-muted">{candidateCount}</span>}
            </NavLink>

            <NavLink
              to="/jobs"
              className={({ isActive }) =>
                `${NAV_ITEM} ${isActive ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"}`
              }
            >
              <span className="flex items-center gap-3">
                <Briefcase className="size-5" aria-hidden="true" />
                Jobs
              </span>
            </NavLink>

            <span
              className={`${NAV_ITEM} cursor-not-allowed text-muted/70`}
              title="Archive arrives in a later milestone"
            >
              <span className="flex items-center gap-3">
                <Archive className="size-5" aria-hidden="true" />
                Archive
              </span>
            </span>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-8 md:px-10">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {index > 0 && <span aria-hidden="true">›</span>}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-ink">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-ink">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
          <div className="mt-4">{children}</div>
        </main>
      </div>
    </div>
  )
}
