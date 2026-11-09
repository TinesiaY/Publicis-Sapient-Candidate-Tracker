import { describe, expect, it } from "vitest"
import { canSubmitNote, NOTE_MAX_LENGTH, trimNote, validateNote } from "./validateNote"

describe("validateNote", () => {
  it("accepts an ordinary note", () => {
    expect(validateNote("Called, positive.")).toBeNull()
  })

  it("accepts a note of exactly the limit after trimming", () => {
    expect(validateNote(`  ${"a".repeat(NOTE_MAX_LENGTH)}\n`)).toBeNull()
  })

  it("rejects a note over the limit", () => {
    expect(validateNote("a".repeat(NOTE_MAX_LENGTH + 1))).toBe(`Notes can be up to ${NOTE_MAX_LENGTH} characters.`)
  })

  it("rejects a null character", () => {
    expect(validateNote("Called\u0000")).toBeTruthy()
  })

  it("trims spaces, tabs and line breaks from both ends", () => {
    expect(trimNote("  \tCalled\r\n")).toBe("Called")
  })

  it("does not allow a blank note to be submitted", () => {
    expect(canSubmitNote("   \n\t")).toBe(false)
    expect(canSubmitNote("")).toBe(false)
    expect(canSubmitNote("Called")).toBe(true)
  })
})
