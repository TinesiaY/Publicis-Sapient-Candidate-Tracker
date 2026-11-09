// Shapes of the JSON the backend returns. Keep these in line with backend/app/schemas.py.

export const STAGES = ["Applied", "Screening", "Interview", "Offer", "Rejected"] as const

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
}
