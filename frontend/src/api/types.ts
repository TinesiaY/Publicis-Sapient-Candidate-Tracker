// Shapes of the JSON the backend returns. Keep these in line with backend/app/schemas.py.

export const STAGES = ["Applied", "Screening", "Interview", "Offer", "Rejected"] as const

export type StageName = (typeof STAGES)[number]

export const SOURCES = ["Referral", "LinkedIn", "Careers page", "Wellfound", "Job board", "Website", "Other"] as const

// The backend calls these roles. The UI calls them jobs.
export interface Role {
  id: number
  name: string
  candidate_count: number
}

export interface RoleDetail extends Role {
  jd_text: string
}

export interface NewRoleInput {
  name: string
  jd_text: string
}

export interface Candidate {
  id: number
  name: string
  email: string
  phone: string | null
  role_id: number
  role_name: string
  source: string | null
  stage: string
  created_at: string
  archived_at: string | null
}

// GET /candidates/{id}. The detail adds the resume text.
export interface CandidateDetail extends Candidate {
  resume_text: string
}

export interface CandidateCounts {
  total: number
  by_stage: Record<string, number>
}

export type SortOrder = "added" | "stage"

export interface CandidateFilters {
  stage?: string
  roleId?: number
  search?: string
  sort?: SortOrder
  // false lists active candidates only. true lists archived candidates only.
  archived?: boolean
}

// GET /candidates/{id}/notes. Notes are append-only: they cannot be edited or removed.
export interface Note {
  id: number
  candidate_id: number
  body: string
  created_at: string
}

export type SummaryStatus = "pending" | "ready" | "failed"

export interface SummaryHighlight {
  text: string
  quote: string
}

// GET /candidates/{id}/summary. The result fields are null unless the status is ready.
export interface SummaryRead {
  status: SummaryStatus
  input_hash: string
  created_at: string
  // False when the server has no Gemini key.
  provider_configured: boolean
  error_code: string | null
  summary: string | null
  skills: string[] | null
  highlights: SummaryHighlight[] | null
  suspicious_input: boolean | null
}
