import type { Candidate, NewRoleInput, Role, RoleDetail } from "./types"

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

export function listCandidates(): Promise<Candidate[]> {
  return request<Candidate[]>("/candidates")
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
