import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { getRole, listCandidates } from "../api/client"
import type { Candidate } from "../api/types"
import { JobDetailPage } from "./JobDetailPage"

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return { ...actual, getRole: vi.fn(), listCandidates: vi.fn() }
})

const frontendCandidate: Candidate = {
  id: 7,
  name: "Ben Lee",
  email: "ben@example.com",
  phone: null,
  role_id: 2,
  role_name: "Frontend Engineer",
  source: "LinkedIn",
  stage: "Screening",
  created_at: "2026-11-02T09:00:00Z",
  archived_at: null,
}

beforeEach(() => {
  vi.mocked(getRole).mockResolvedValue({
    id: 2,
    name: "Frontend Engineer",
    candidate_count: 1,
    jd_text: "Build React interfaces in TypeScript.",
  })
  vi.mocked(listCandidates).mockResolvedValue([frontendCandidate])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderJob(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("JobDetailPage", () => {
  it("asks the API for only this job's candidates", async () => {
    renderJob("/jobs/2")

    expect(await screen.findByText("Ben Lee")).toBeTruthy()
    expect(listCandidates).toHaveBeenCalledWith({ roleId: 2 })
  })

  it("shows the job description", async () => {
    renderJob("/jobs/2")

    expect(await screen.findByText("Build React interfaces in TypeScript.")).toBeTruthy()
  })
})
