import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import type { ResumeInputValue } from "../lib/validateCandidate"
import { ResumeInput } from "./ResumeInput"

// Testing Library only cleans up automatically when globals are enabled, so do it here.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Keeps the value in state, the way a page does.
function Harness({ initial = { text: "", file: null } }: { initial?: ResumeInputValue }) {
  const [value, setValue] = useState<ResumeInputValue>(initial)
  return <ResumeInput id="resume" value={value} onChange={setValue} />
}

function textBox() {
  return screen.getByRole("textbox") as HTMLTextAreaElement
}

describe("ResumeInput", () => {
  it("accepts pasted text", () => {
    render(<Harness />)

    fireEvent.change(textBox(), { target: { value: "Python developer" } })

    expect(textBox().value).toBe("Python developer")
    expect(textBox().disabled).toBe(false)
  })

  it("replaces pasted text with a chosen file and disables the text box", () => {
    render(<Harness />)
    fireEvent.change(textBox(), { target: { value: "Pasted text" } })

    fireEvent.change(screen.getByLabelText("Choose a file to upload"), {
      target: { files: [new File(["Ann Tan"], "ann-tan.md")] },
    })

    expect(screen.getByText("ann-tan.md")).toBeTruthy()
    expect(textBox().value).toBe("")
    expect(textBox().disabled).toBe(true)
  })

  it("removes the chosen file and re-enables the text box", () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText("Choose a file to upload"), {
      target: { files: [new File(["Ann Tan"], "ann-tan.md")] },
    })

    fireEvent.click(screen.getByRole("button", { name: "Remove file" }))

    expect(screen.queryByText("ann-tan.md")).toBeNull()
    expect(textBox().disabled).toBe(false)
  })

  it("shows an error for a file type that is not allowed, and keeps the text box", () => {
    render(<Harness />)

    fireEvent.change(screen.getByLabelText("Choose a file to upload"), {
      target: { files: [new File(["%PDF"], "resume.pdf")] },
    })

    expect(screen.getByText("Upload a .txt or .md file.")).toBeTruthy()
    expect(textBox().disabled).toBe(false)
  })

  it("shows an error passed in by the page", () => {
    render(<ResumeInput id="resume" value={{ text: "", file: null }} onChange={() => undefined} error="Paste the resume or cover letter text." />)

    expect(screen.getByText("Paste the resume or cover letter text.")).toBeTruthy()
    expect(textBox().getAttribute("aria-invalid")).toBe("true")
  })
})
