import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ApiError, getSummary, regenerateSummary, retrySummary } from "../api/client"
import type { SummaryRead } from "../api/types"
import { SummaryPanel } from "./SummaryPanel"

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return { ...actual, getSummary: vi.fn(), retrySummary: vi.fn(), regenerateSummary: vi.fn() }
})

// Short enough that the tests do not wait for the real two-second interval.
const POLL_MS = 5

const SUMMARY_TEXT = "Full-stack engineer with two years of Python and React."

const PENDING: SummaryRead = {
  status: "pending",
  input_hash: "abc",
  created_at: "2026-11-08T10:00:00Z",
  provider_configured: true,
  error_code: null,
  summary: null,
  skills: null,
  highlights: null,
  suspicious_input: null,
}

const READY: SummaryRead = {
  ...PENDING,
  status: "ready",
  summary: SUMMARY_TEXT,
  skills: ["Python", "React"],
  highlights: [{ text: "Built a dashboard", quote: "Built and maintain a shipment tracking dashboard" }],
  suspicious_input: false,
}

function failed(code: string, providerConfigured = true): SummaryRead {
  return { ...PENDING, status: "failed", error_code: code, provider_configured: providerConfigured }
}

function renderPanel(isArchived = false) {
  return render(<SummaryPanel candidateId={7} isArchived={isArchived} pollIntervalMs={POLL_MS} />)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("SummaryPanel", () => {
  it("shows the pending state, then the ready summary, and stops checking", async () => {
    vi.mocked(getSummary).mockResolvedValueOnce(PENDING).mockResolvedValueOnce(PENDING).mockResolvedValue(READY)
    renderPanel()

    expect(await screen.findByText("Generating summary...")).toBeTruthy()
    expect(await screen.findByText(SUMMARY_TEXT)).toBeTruthy()

    const checks = vi.mocked(getSummary).mock.calls.length
    await wait(40)
    expect(vi.mocked(getSummary).mock.calls.length).toBe(checks)
  })

  it("shows the ready content with the AI label, the skills, the highlight quote and the note from the design", async () => {
    vi.mocked(getSummary).mockResolvedValue(READY)
    renderPanel()

    expect(await screen.findByText(SUMMARY_TEXT)).toBeTruthy()
    expect(screen.getByText("AI generated")).toBeTruthy()
    expect(screen.getByText("Python")).toBeTruthy()
    expect(screen.getByText("Built a dashboard")).toBeTruthy()
    expect(screen.getByText(/Built and maintain a shipment tracking dashboard/)).toBeTruthy()
    expect(screen.getByText("Generated Nov 8, 2026")).toBeTruthy()
    expect(screen.getByText("AI can miss context. Review against the original resume before making a decision.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeTruthy()
  })

  it("says so when the summary found no skills or experience", async () => {
    vi.mocked(getSummary).mockResolvedValue({ ...READY, skills: [], highlights: [] })
    renderPanel()

    expect(await screen.findByText("No clear skills or experience found.")).toBeTruthy()
  })

  it("shows the badge when the resume looked like it contained instructions", async () => {
    vi.mocked(getSummary).mockResolvedValue({ ...READY, suspicious_input: true })
    renderPanel()

    expect(await screen.findByText("Possible instructions in the resume")).toBeTruthy()
  })

  it("shows the reason for a failure and retries, then shows the new summary", async () => {
    vi.mocked(getSummary).mockResolvedValueOnce(failed("rate_limited")).mockResolvedValue(READY)
    vi.mocked(retrySummary).mockResolvedValue(PENDING)
    renderPanel()

    expect(await screen.findByText(/The AI service is busy/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(retrySummary).toHaveBeenCalledWith(7)
    expect(await screen.findByText(SUMMARY_TEXT)).toBeTruthy()
  })

  it("gives no retry button when the key is missing, and says to add the key and restart the backend", async () => {
    vi.mocked(getSummary).mockResolvedValue(failed("not_configured", false))
    renderPanel()

    expect(await screen.findByText(/Add GEMINI_API_KEY to backend\/\.env, then restart the backend/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
  })

  it("offers retry for a summary that failed without a key, once the server has one", async () => {
    vi.mocked(getSummary).mockResolvedValueOnce(failed("not_configured", true)).mockResolvedValue(READY)
    vi.mocked(retrySummary).mockResolvedValue(PENDING)
    renderPanel()

    expect(await screen.findByText(/This summary was not made, because the server had no key/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(retrySummary).toHaveBeenCalledWith(7)
    expect(await screen.findByText(SUMMARY_TEXT)).toBeTruthy()
  })

  it("does not offer retry or regenerate for an archived candidate", async () => {
    vi.mocked(getSummary).mockResolvedValueOnce(failed("timeout"))
    const first = renderPanel(true)
    expect(await screen.findByText("Restore this candidate to retry their summary.")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
    first.unmount()

    vi.mocked(getSummary).mockResolvedValue(READY)
    renderPanel(true)
    expect(await screen.findByText("Restore this candidate to regenerate their summary.")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull()
  })

  it("keeps the last state when a check fails, stops checking, and checks again only on Try again", async () => {
    vi.mocked(getSummary)
      .mockResolvedValueOnce(PENDING)
      .mockRejectedValueOnce(new ApiError("Cannot reach the server. Check that the backend is running.", 0))
      .mockResolvedValue(READY)
    renderPanel()

    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(screen.getByText("Generating summary...")).toBeTruthy()

    const checks = vi.mocked(getSummary).mock.calls.length
    await wait(40)
    expect(vi.mocked(getSummary).mock.calls.length).toBe(checks)

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText(SUMMARY_TEXT)).toBeTruthy()
  })

  it("keeps the failure on screen and shows the message when a retry is refused", async () => {
    vi.mocked(getSummary).mockResolvedValue(failed("timeout"))
    vi.mocked(retrySummary).mockRejectedValue(new ApiError("Only a failed summary can be retried", 409))
    renderPanel()

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }))

    expect((await screen.findByRole("alert")).textContent).toContain("Only a failed summary can be retried")
    expect(screen.getByText("The summary took longer than three minutes.")).toBeTruthy()
  })

  it("regenerates a ready summary and shows the new one", async () => {
    vi.mocked(getSummary).mockResolvedValueOnce(READY).mockResolvedValue({ ...READY, summary: "A fresh summary." })
    vi.mocked(regenerateSummary).mockResolvedValue(PENDING)
    renderPanel()

    fireEvent.click(await screen.findByRole("button", { name: "Regenerate" }))

    expect(regenerateSummary).toHaveBeenCalledWith(7)
    expect(await screen.findByText("A fresh summary.")).toBeTruthy()
  })

  it("stops checking when the panel is removed from the page", async () => {
    vi.mocked(getSummary).mockResolvedValue(PENDING)
    const { unmount } = renderPanel()
    await waitFor(() => expect(vi.mocked(getSummary).mock.calls.length).toBeGreaterThan(1))

    unmount()
    const checks = vi.mocked(getSummary).mock.calls.length
    await wait(40)

    expect(vi.mocked(getSummary).mock.calls.length).toBe(checks)
  })
})
