import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { ApiError, listCandidates, restoreCandidate } from "../api/client"
import type { Candidate, CandidateDetail } from "../api/types"
import { ArchivePage } from "./ArchivePage"

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return { ...actual, listCandidates: vi.fn(), restoreCandidate: vi.fn() }
})

// A request we resolve by hand, so a test can look at the page while it is still running.
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const BEN: Candidate = {
  id: 7,
  name: "Ben Lee",
  email: "ben@example.com",
  phone: null,
  role_id: 2,
  role_name: "Frontend Engineer",
  source: "LinkedIn",
  stage: "Screening",
  created_at: "2026-11-02T09:00:00Z",
  archived_at: "2026-11-09T10:00:00Z",
}

const CARA: Candidate = { ...BEN, id: 8, name: "Cara Diaz", email: "cara@example.com", stage: "Rejected" }

beforeEach(() => {
  vi.mocked(listCandidates).mockResolvedValue([BEN, CARA])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderPage() {
  render(
    <MemoryRouter>
      <ArchivePage />
    </MemoryRouter>,
  )
}

describe("ArchivePage", () => {
  it("lists archived candidates from the API", async () => {
    renderPage()

    expect(await screen.findByText("Ben Lee")).toBeTruthy()
    expect(listCandidates).toHaveBeenCalledWith({ archived: true })
  })

  it("shows an empty message when nothing is archived", async () => {
    vi.mocked(listCandidates).mockResolvedValue([])
    renderPage()

    expect(await screen.findByText("No archived candidates.")).toBeTruthy()
  })

  it("removes a row only after the server confirms the restore", async () => {
    const pending = deferred<CandidateDetail>()
    vi.mocked(restoreCandidate).mockReturnValue(pending.promise)
    renderPage()
    await screen.findByText("Ben Lee")

    const button = screen.getByRole("button", { name: "Restore Ben Lee" }) as HTMLButtonElement
    fireEvent.click(button)

    expect(restoreCandidate).toHaveBeenCalledWith(7)
    expect(button.disabled).toBe(true)
    // Still listed while the request runs.
    expect(screen.getByText("Ben Lee")).toBeTruthy()

    pending.resolve({ ...BEN, archived_at: null, resume_text: "Front-end developer." })

    await waitFor(() => expect(screen.queryByText("Ben Lee")).toBeNull())
    expect(screen.getByText("Cara Diaz")).toBeTruthy()
  })

  it("keeps the row and shows the error inline when the restore fails", async () => {
    vi.mocked(restoreCandidate).mockRejectedValue(new ApiError("Could not restore this candidate.", 500))
    renderPage()
    await screen.findByText("Ben Lee")

    fireEvent.click(screen.getByRole("button", { name: "Restore Ben Lee" }))

    expect((await screen.findByRole("alert")).textContent).toContain("Could not restore this candidate.")
    expect(screen.getByText("Ben Lee")).toBeTruthy()
  })
})
