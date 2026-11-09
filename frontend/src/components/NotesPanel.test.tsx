import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ApiError, addNote, listNotes } from "../api/client"
import type { Note } from "../api/types"
import { NotesPanel } from "./NotesPanel"

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>()
  return { ...actual, listNotes: vi.fn(), addNote: vi.fn() }
})

// A request we resolve by hand, so a test can look at the panel while it is still running.
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const NEWER: Note = { id: 2, candidate_id: 7, body: "Portfolio review booked", created_at: "2026-11-09T10:42:00Z" }
const OLDER: Note = { id: 1, candidate_id: 7, body: "Screening call went well", created_at: "2026-11-08T14:15:00Z" }

beforeEach(() => {
  vi.mocked(listNotes).mockResolvedValue([NEWER, OLDER])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderPanel() {
  render(<NotesPanel candidateId={7} />)
}

function noteBox() {
  return screen.getByLabelText("New note") as HTMLTextAreaElement
}

function addButton() {
  return screen.getByRole("button", { name: "Add note" }) as HTMLButtonElement
}

describe("NotesPanel", () => {
  it("lists notes newest first, with a count", async () => {
    renderPanel()

    expect(await screen.findByText("Portfolio review booked")).toBeTruthy()
    const items = screen.getAllByRole("listitem")
    expect(items[0].textContent).toContain("Portfolio review booked")
    expect(items[1].textContent).toContain("Screening call went well")
    expect(screen.getByText("2 notes")).toBeTruthy()
  })

  it("shows a message when there are no notes yet", async () => {
    vi.mocked(listNotes).mockResolvedValue([])
    renderPanel()

    expect(await screen.findByText("No notes yet.")).toBeTruthy()
  })

  it("does not allow a blank note to be added", async () => {
    renderPanel()
    await screen.findByText("Portfolio review booked")

    fireEvent.change(noteBox(), { target: { value: "   \n\t" } })

    expect(addButton().disabled).toBe(true)
  })

  it("adds a note to the list only after the server confirms it", async () => {
    const pending = deferred<Note>()
    vi.mocked(addNote).mockReturnValue(pending.promise)
    renderPanel()
    await screen.findByText("Portfolio review booked")

    fireEvent.change(noteBox(), { target: { value: "  Left a voicemail  " } })
    const button = addButton()
    fireEvent.click(button)

    expect(addNote).toHaveBeenCalledWith(7, "Left a voicemail")
    expect(button.disabled).toBe(true)
    expect(noteBox().disabled).toBe(true)
    expect(screen.getAllByRole("listitem")).toHaveLength(2)

    pending.resolve({ id: 3, candidate_id: 7, body: "Left a voicemail", created_at: "2026-11-09T11:00:00Z" })

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3))
    expect(screen.getAllByRole("listitem")[0].textContent).toContain("Left a voicemail")
    expect(noteBox().value).toBe("")
  })

  it("keeps the text and shows the error when saving fails", async () => {
    vi.mocked(addNote).mockRejectedValue(new ApiError("Could not save this note.", 500))
    renderPanel()
    await screen.findByText("Portfolio review booked")

    fireEvent.change(noteBox(), { target: { value: "Keep this text" } })
    fireEvent.click(addButton())

    expect((await screen.findByRole("alert")).textContent).toContain("Could not save this note.")
    expect(noteBox().value).toBe("Keep this text")
    expect(addButton().disabled).toBe(false)
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  it("blocks a note over 2000 characters and says why", async () => {
    renderPanel()
    await screen.findByText("Portfolio review booked")

    fireEvent.change(noteBox(), { target: { value: "a".repeat(2001) } })

    expect(screen.getByText("Notes can be up to 2000 characters.")).toBeTruthy()
    expect(addButton().disabled).toBe(true)
  })

  it("retries loading the notes after an error", async () => {
    vi.mocked(listNotes).mockRejectedValueOnce(new ApiError("Could not load the notes.", 500))
    renderPanel()

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(await screen.findByText("Portfolio review booked")).toBeTruthy()
    expect(listNotes).toHaveBeenCalledTimes(2)
  })
})
