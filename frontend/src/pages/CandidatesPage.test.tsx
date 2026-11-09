import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import type { Candidate } from "../api/types"
import { getCandidateCounts, listCandidates, listRoles } from "../api/client"
import { CandidatesPage } from "./CandidatesPage"

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return { ...actual, listCandidates: vi.fn(), listRoles: vi.fn(), getCandidateCounts: vi.fn() }
})

const EMPTY_COUNTS = {
  total: 0,
  by_stage: { Applied: 0, Screening: 0, Interview: 0, Offer: 0, Rejected: 0 },
}

beforeEach(() => {
  vi.mocked(listCandidates).mockResolvedValue([])
  vi.mocked(listRoles).mockResolvedValue([])
  vi.mocked(getCandidateCounts).mockResolvedValue(EMPTY_COUNTS)
})

// Testing Library only cleans up automatically when globals are enabled, so do it here.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <CandidatesPage />
    </MemoryRouter>,
  )
}

function searchBox() {
  return screen.getByRole("searchbox", { name: "Search name or email" }) as HTMLInputElement
}

// The search values the list was requested with, in order.
function requestedSearches() {
  return vi.mocked(listCandidates).mock.calls.map(([filters]) => filters?.search)
}

describe("CandidatesPage filters", () => {
  it("keeps the filters from the URL, so a refresh shows the same results", async () => {
    renderAt("/candidates?stage=Interview&q=ann&sort=stage")

    await waitFor(() =>
      expect(listCandidates).toHaveBeenCalledWith({
        stage: "Interview",
        roleId: undefined,
        search: "ann",
        sort: "stage",
      }),
    )
    expect(searchBox().value).toBe("ann")
  })

  it("ignores a stage in the URL that the backend would reject", async () => {
    renderAt("/candidates?stage=interview")

    await waitFor(() => expect(listCandidates).toHaveBeenCalled())
    expect(vi.mocked(listCandidates).mock.calls[0][0]?.stage).toBeUndefined()
  })

  it("waits for the user to stop typing before it searches", async () => {
    renderAt("/candidates")
    await waitFor(() => expect(listCandidates).toHaveBeenCalledTimes(1))

    fireEvent.change(searchBox(), { target: { value: "a" } })
    fireEvent.change(searchBox(), { target: { value: "an" } })
    fireEvent.change(searchBox(), { target: { value: "ann" } })

    await waitFor(() => expect(listCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ search: "ann" })))
    // Only the first load and the settled search were requested. "a" and "an" were never sent.
    expect(requestedSearches()).toEqual(["", "ann"])
  })

  it("clears the search box and cancels a pending search", async () => {
    renderAt("/candidates")
    await waitFor(() => expect(listCandidates).toHaveBeenCalledTimes(1))

    fireEvent.change(searchBox(), { target: { value: "bob" } })
    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }))
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(searchBox().value).toBe("")
    expect(requestedSearches()).not.toContain("bob")
  })

  it("shows the whole-pipeline counts, with zeros for empty stages", async () => {
    vi.mocked(getCandidateCounts).mockResolvedValue({
      total: 3,
      by_stage: { Applied: 2, Screening: 0, Interview: 1, Offer: 0, Rejected: 0 },
    })
    renderAt("/candidates")

    expect(await screen.findByText("Showing 0 of 3 candidates")).toBeTruthy()
  })

  it("opens the candidate when anywhere on the row is clicked", async () => {
    const candidate: Candidate = {
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
    vi.mocked(listCandidates).mockResolvedValue([candidate])
    render(
      <MemoryRouter initialEntries={["/candidates"]}>
        <Routes>
          <Route path="/candidates" element={<CandidatesPage />} />
          <Route path="/candidates/:candidateId" element={<p>Candidate detail stub</p>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByText("ben@example.com"))

    expect(await screen.findByText("Candidate detail stub")).toBeTruthy()
  })
})
