import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import {
  ApiError,
  archiveCandidate,
  getCandidate,
  getSummary,
  listNotes,
  replaceCandidateResume,
  restoreCandidate,
  updateCandidateStage,
} from "../api/client"
import type { CandidateDetail, SummaryRead } from "../api/types"
import { CandidateDetailPage } from "./CandidateDetailPage"

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return {
    ...actual,
    getCandidate: vi.fn(),
    updateCandidateStage: vi.fn(),
    archiveCandidate: vi.fn(),
    restoreCandidate: vi.fn(),
    replaceCandidateResume: vi.fn(),
    listNotes: vi.fn(),
    getSummary: vi.fn(),
    retrySummary: vi.fn(),
    regenerateSummary: vi.fn(),
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

const READY_SUMMARY: SummaryRead = {
  status: "ready",
  input_hash: "abc",
  created_at: "2026-11-02T09:00:00Z",
  provider_configured: true,
  error_code: null,
  summary: "Front-end developer with one year of React.",
  skills: ["React"],
  highlights: [],
  suspicious_input: false,
}

beforeEach(() => {
  vi.mocked(getCandidate).mockResolvedValue(ACTIVE)
  vi.mocked(listNotes).mockResolvedValue([])
  vi.mocked(getSummary).mockResolvedValue(READY_SUMMARY)
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

  it("shows the new resume only after the server confirms the replacement", async () => {
    const pending = deferred<CandidateDetail>()
    vi.mocked(replaceCandidateResume).mockReturnValue(pending.promise)
    renderAt()
    await screen.findByRole("heading", { name: "Ben Lee" })

    fireEvent.click(screen.getByRole("button", { name: "Replace resume" }))
    fireEvent.change(screen.getByLabelText(/new resume/i), { target: { value: "Senior front-end developer, 5 years." } })
    fireEvent.click(screen.getByRole("button", { name: "Save resume" }))

    expect(replaceCandidateResume).toHaveBeenCalledWith(7, { text: "Senior front-end developer, 5 years.", file: null })
    // Nothing has changed on the page yet.
    expect(screen.getByText("Front-end developer, 1 year.")).toBeTruthy()
    expect((screen.getByRole("button", { name: "Saving..." }) as HTMLButtonElement).disabled).toBe(true)

    pending.resolve({ ...ACTIVE, resume_text: "Senior front-end developer, 5 years." })

    expect(await screen.findByText("Senior front-end developer, 5 years.")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Save resume" })).toBeNull()
  })

  it("keeps the old resume and the typed text when the replacement fails", async () => {
    vi.mocked(replaceCandidateResume).mockRejectedValue(
      new ApiError("Restore this candidate before replacing their resume", 409),
    )
    renderAt()
    await screen.findByRole("heading", { name: "Ben Lee" })

    fireEvent.click(screen.getByRole("button", { name: "Replace resume" }))
    fireEvent.change(screen.getByLabelText(/new resume/i), { target: { value: "Senior front-end developer." } })
    fireEvent.click(screen.getByRole("button", { name: "Save resume" }))

    expect((await screen.findByRole("alert")).textContent).toContain("Restore this candidate before replacing their resume")
    expect(screen.getByText("Front-end developer, 1 year.")).toBeTruthy()
    expect((screen.getByLabelText(/new resume/i) as HTMLTextAreaElement).value).toBe("Senior front-end developer.")
  })

  it("does not allow replacing the resume of an archived candidate", async () => {
    vi.mocked(getCandidate).mockResolvedValue(ARCHIVED)
    renderAt()
    await screen.findByRole("heading", { name: "Ben Lee" })

    expect((screen.getByRole("button", { name: "Replace resume" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText("Restore this candidate to replace their resume.")).toBeTruthy()
  })

  it("shows the resume summary for the candidate", async () => {
    renderAt()

    expect(await screen.findByText("Front-end developer with one year of React.")).toBeTruthy()
    expect(getSummary).toHaveBeenCalledWith(7)
  })

  it("checks the summary again after the resume is replaced", async () => {
    vi.mocked(replaceCandidateResume).mockResolvedValue({
      ...ACTIVE,
      resume_text: "Senior front-end developer, 5 years.",
    })
    renderAt()
    await screen.findByRole("heading", { name: "Ben Lee" })
    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole("button", { name: "Replace resume" }))
    fireEvent.change(screen.getByLabelText(/new resume/i), {
      target: { value: "Senior front-end developer, 5 years." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save resume" }))

    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(2))
  })
})
