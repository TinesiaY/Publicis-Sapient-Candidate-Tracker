import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { ApiError, createCandidate, createRole, listRoles } from "../api/client"
import type { Candidate } from "../api/types"
import { NewCandidatePage, NEW_ROLE } from "./NewCandidatePage"

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return { ...actual, listRoles: vi.fn(), createCandidate: vi.fn(), createRole: vi.fn() }
})

beforeEach(() => {
  vi.mocked(listRoles).mockResolvedValue([{ id: 1, name: "Backend Engineer", candidate_count: 0 }])
})

// Testing Library only cleans up automatically when globals are enabled, so do it here.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderPage() {
  render(
    <MemoryRouter>
      <NewCandidatePage />
    </MemoryRouter>,
  )
}

function fillCandidate(role: string) {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Ann Tan" } })
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "ann@example.com" } })
  fireEvent.change(screen.getByLabelText(/role applied for/i), { target: { value: role } })
  fireEvent.change(screen.getByLabelText(/resume/i), { target: { value: "Python developer" } })
}

describe("NewCandidatePage", () => {
  it("shows a duplicate-application error inline", async () => {
    vi.mocked(createCandidate).mockRejectedValue(
      new ApiError("This email has already applied for this role", 409),
    )
    renderPage()
    await screen.findByRole("option", { name: "Backend Engineer" })

    fillCandidate("1")
    fireEvent.click(screen.getByRole("button", { name: "+ Add candidate" }))

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("This email has already applied for this role")
  })

  it("shows field errors and does not send the request when the form is incomplete", async () => {
    renderPage()
    await screen.findByRole("option", { name: "Backend Engineer" })

    fireEvent.click(screen.getByRole("button", { name: "+ Add candidate" }))

    expect(await screen.findByText("Enter the candidate's full name.")).toBeTruthy()
    expect(createCandidate).not.toHaveBeenCalled()
  })

  it("lets the user add a new job and applies the candidate to it", async () => {
    vi.mocked(createRole).mockResolvedValue({
      id: 5,
      name: "Data Analyst",
      jd_text: "Analyse data.",
      candidate_count: 0,
    })
    vi.mocked(createCandidate).mockResolvedValue({} as Candidate)
    renderPage()
    await screen.findByRole("option", { name: "Backend Engineer" })

    fillCandidate(NEW_ROLE)
    fireEvent.change(screen.getByLabelText(/job title/i), { target: { value: " Data Analyst " } })
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: "Analyse data." } })
    fireEvent.click(screen.getByRole("button", { name: "+ Add candidate" }))

    await waitFor(() => expect(createCandidate).toHaveBeenCalled())
    expect(createRole).toHaveBeenCalledWith({ name: "Data Analyst", jd_text: "Analyse data." })
  })

  it("asks for the job title and description when adding a new job", async () => {
    renderPage()
    await screen.findByRole("option", { name: "Backend Engineer" })

    fillCandidate(NEW_ROLE)
    fireEvent.click(screen.getByRole("button", { name: "+ Add candidate" }))

    expect(await screen.findByText("Enter the job title.")).toBeTruthy()
    expect(screen.getByText("Write the job description.")).toBeTruthy()
    expect(createRole).not.toHaveBeenCalled()
  })
})
