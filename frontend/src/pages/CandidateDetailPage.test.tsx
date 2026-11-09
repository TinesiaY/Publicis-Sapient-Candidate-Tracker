import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { ApiError, archiveCandidate, getCandidate, listNotes, restoreCandidate, updateCandidateStage } from "../api/client"
import type { CandidateDetail } from "../api/types"
import { CandidateDetailPage } from "./CandidateDetailPage"

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return {
    ...actual,
    getCandidate: vi.fn(),
    updateCandidateStage: vi.fn(),
    archiveCandidate: vi.fn(),
    restoreCandidate: vi.fn(),
    listNotes: vi.fn(),
  }
})

// A request we resolve by hand, so a test can look at the page while it is still running.
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const ACTIVE: CandidateDetail = {
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
  resume_text: "Front-end developer, 1 year.",
}

const ARCHIVED: CandidateDetail = { ...ACTIVE, archived_at: "2026-11-09T10:00:00Z" }

beforeEach(() => {
  vi.mocked(getCandidate).mockResolvedValue(ACTIVE)
  vi.mocked(listNotes).mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderAt(path = "/candidates/7") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/candidates/:candidateId" element={<CandidateDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function stageButton(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement
}

describe("CandidateDetailPage", () => {
  it("shows the candidate and their resume", async () => {
    renderAt()

    expect(await screen.findByRole("heading", { name: "Ben Lee" })).toBeTruthy()
    expect(screen.getByText("Front-end developer, 1 year.")).toBeTruthy()
  })

  it("changes the stage only after the server confirms, and disables the controls while it runs", async () => {
    const pending = deferred<CandidateDetail>()
    vi.mocked(updateCandidateStage).mockReturnValue(pending.promise)
    renderAt()
    await screen.findByRole("heading", { name: "Ben Lee" })

    fireEvent.click(stageButton("Interview"))

    expect(updateCandidateStage).toHaveBeenCalledWith(7, "Interview")
    expect(stageButton("Interview").disabled).toBe(true)
    expect(stageButton("Offer").disabled).toBe(true)
    // Nothing has changed yet.
    expect(stageButton("Screening").getAttribute("aria-pressed")).toBe("true")

    pending.resolve({ ...ACTIVE, stage: "Interview" })

    await waitFor(() => expect(stageButton("Interview").getAttribute("aria-pressed")).toBe("true"))
    expect(stageButton("Offer").disabled).toBe(false)
  })

  it("keeps the old stage and shows the error when the stage change fails", async () => {
    vi.mocked(updateCandidateStage).mockRejectedValue(
      new ApiError("Restore this candidate before changing their stage", 409),
    )
    renderAt()
    await screen.findByRole("heading", { name: "Ben Lee" })

    fireEvent.click(stageButton("Offer"))

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Restore this candidate before changing their stage",
    )
    expect(stageButton("Screening").getAttribute("aria-pressed")).toBe("true")
  })

  it("archives only after the server confirms, and disables the confirm button while it runs", async () => {
    const pending = deferred<CandidateDetail>()
    vi.mocked(archiveCandidate).mockReturnValue(pending.promise)
    renderAt()
    await screen.findByRole("heading", { name: "Ben Lee" })

    fireEvent.click(screen.getByRole("button", { name: "Archive candidate" }))
    fireEvent.click(screen.getByRole("button", { name: "Yes, archive" }))

    expect(archiveCandidate).toHaveBeenCalledWith(7)
    expect(stageButton("Offer").disabled).toBe(true)
    expect((screen.getByRole("button", { name: "Yes, archive" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole("button", { name: "Restore candidate" })).toBeNull()

    pending.resolve(ARCHIVED)

    expect(await screen.findByRole("button", { name: "Restore candidate" })).toBeTruthy()
    expect(stageButton("Offer").disabled).toBe(true)
  })

  it("keeps the candidate active and shows the error when archiving fails", async () => {
    vi.mocked(archiveCandidate).mockRejectedValue(new ApiError("Could not archive this candidate.", 500))
    renderAt()
    await screen.findByRole("heading", { name: "Ben Lee" })

    fireEvent.click(screen.getByRole("button", { name: "Archive candidate" }))
    fireEvent.click(screen.getByRole("button", { name: "Yes, archive" }))

    expect((await screen.findByRole("alert")).textContent).toContain("Could not archive this candidate.")
    expect(screen.queryByRole("button", { name: "Restore candidate" })).toBeNull()
    expect(stageButton("Offer").disabled).toBe(false)
  })

  it("restores an archived candidate and shows the active controls", async () => {
    vi.mocked(getCandidate).mockResolvedValue(ARCHIVED)
    vi.mocked(restoreCandidate).mockResolvedValue(ACTIVE)
    renderAt()

    fireEvent.click(await screen.findByRole("button", { name: "Restore candidate" }))

    expect(await screen.findByRole("button", { name: "Archive candidate" })).toBeTruthy()
    expect(stageButton("Offer").disabled).toBe(false)
  })

  it("shows a not-found message for an unknown candidate", async () => {
    vi.mocked(getCandidate).mockRejectedValue(new ApiError("Candidate not found", 404))
    renderAt("/candidates/999")

    expect(await screen.findByText("This candidate does not exist.")).toBeTruthy()
  })
})
