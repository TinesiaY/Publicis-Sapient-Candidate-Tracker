import type {
  Candidate,
  CandidateCounts,
  CandidateDetail,
  CandidateFilters,
  NewRoleInput,
  Note,
  Role,
  RoleDetail,
  StageName,
} from "./types"
import type { ResumeInputValue } from "../lib/validateCandidate"

// The backend allows requests from http://localhost:5173 (see backend/app/main.py).
const API_URL = "http://127.0.0.1:8000"

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

interface ValidationItem {
  loc?: unknown[]
  msg?: string
}

function describeValidationItem(item: ValidationItem): string {
  const field = Array.isArray(item.loc) ? String(item.loc[item.loc.length - 1]) : ""
  const message = (item.msg ?? "is not valid").replace(/^Value error, /, "")
  return field ? `${field}: ${message}.` : `${message}.`
}

// The backend sends `detail` as a string for business errors (409, 404)
// and as a list for form and body validation errors (422).
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === "string") {
      return body.detail
    }
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => describeValidationItem(item as ValidationItem)).join(" ")
    }
  } catch {
    // The body was not JSON. Fall through to the generic message.
  }
  return `Something went wrong (status ${response.status}).`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new ApiError("Cannot reach the server. Check that the backend is running.", 0)
  }
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status)
  }
  return (await response.json()) as T
}

// Builds the query string the backend reads. Empty values and the default sort are left out.
export function buildCandidateQuery(filters: CandidateFilters): string {
  const params = new URLSearchParams()
  if (filters.stage) {
    params.set("stage", filters.stage)
  }
  if (filters.roleId !== undefined) {
    params.set("role_id", String(filters.roleId))
  }
  const search = filters.search?.trim()
  if (search) {
    params.set("search", search)
  }
  if (filters.sort && filters.sort !== "added") {
    params.set("sort", filters.sort)
  }
  if (filters.archived !== undefined) {
    params.set("archived", String(filters.archived))
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}

export function listCandidates(filters: CandidateFilters = {}): Promise<Candidate[]> {
  return request<Candidate[]>(`/candidates${buildCandidateQuery(filters)}`)
}

export function getCandidate(candidateId: number): Promise<CandidateDetail> {
  return request<CandidateDetail>(`/candidates/${candidateId}`)
}

export function updateCandidateStage(candidateId: number, stage: StageName): Promise<CandidateDetail> {
  return request<CandidateDetail>(`/candidates/${candidateId}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage }),
  })
}

export function archiveCandidate(candidateId: number): Promise<CandidateDetail> {
  return request<CandidateDetail>(`/candidates/${candidateId}/archive`, { method: "POST" })
}

export function restoreCandidate(candidateId: number): Promise<CandidateDetail> {
  return request<CandidateDetail>(`/candidates/${candidateId}/restore`, { method: "POST" })
}

// The resume is sent as either pasted text or one file, never both.
export function appendResume(data: FormData, resume: ResumeInputValue): void {
  if (resume.file) {
    data.append("resume_file", resume.file)
  } else {
    data.append("resume_text", resume.text)
  }
}

// Replaces the resume. The summary is regenerated for the new text, and notes and stage are unchanged.
export function replaceCandidateResume(candidateId: number, resume: ResumeInputValue): Promise<CandidateDetail> {
  const data = new FormData()
  appendResume(data, resume)
  return request<CandidateDetail>(`/candidates/${candidateId}/resume`, { method: "PUT", body: data })
}

// Newest first, as the backend returns them.
export function listNotes(candidateId: number): Promise<Note[]> {
  return request<Note[]>(`/candidates/${candidateId}/notes`)
}

export function addNote(candidateId: number, body: string): Promise<Note> {
  return request<Note>(`/candidates/${candidateId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  })
}

export function getCandidateCounts(): Promise<CandidateCounts> {
  return request<CandidateCounts>("/candidates/counts")
}

// Send FormData without a Content-Type header. The browser adds the multipart boundary.
export function createCandidate(form: FormData): Promise<Candidate> {
  return request<Candidate>("/candidates", { method: "POST", body: form })
}

export function listRoles(): Promise<Role[]> {
  return request<Role[]>("/roles")
}

export function getRole(roleId: number): Promise<RoleDetail> {
  return request<RoleDetail>(`/roles/${roleId}`)
}

export function createRole(input: NewRoleInput): Promise<RoleDetail> {
  return request<RoleDetail>("/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
}
