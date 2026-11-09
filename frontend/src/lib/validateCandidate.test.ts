import { describe, expect, it } from "vitest"
import {
  MAX_RESUME_BYTES,
  validateCandidateForm,
  validateResumeFile,
  validateResumeInput,
  validateResumeText,
  type CandidateFormValues,
} from "./validateCandidate"

const valid: CandidateFormValues = {
  name: "Ann Tan",
  email: "ann@example.com",
  phone: "",
  roleId: "1",
  source: "Referral",
  resumeText: "Python developer, 2 years",
}

describe("validateCandidateForm", () => {
  it("accepts a complete form", () => {
    expect(validateCandidateForm(valid)).toEqual({})
  })

  it("allows an empty phone and source, since both are optional", () => {
    expect(validateCandidateForm({ ...valid, phone: "", source: "" })).toEqual({})
  })

  it("requires a name", () => {
    expect(validateCandidateForm({ ...valid, name: "   " }).name).toBeTruthy()
  })

  it("treats a name made only of tabs and newlines as blank", () => {
    expect(validateCandidateForm({ ...valid, name: "\t\n" }).name).toBeTruthy()
  })

  it("rejects an email without a domain part", () => {
    expect(validateCandidateForm({ ...valid, email: "ann@example" }).email).toBeTruthy()
  })

  it("requires a role", () => {
    expect(validateCandidateForm({ ...valid, roleId: "" }).roleId).toBeTruthy()
  })

  it("rejects a resume that is only whitespace", () => {
    expect(validateCandidateForm({ ...valid, resumeText: " \n\t " }).resumeText).toBeTruthy()
  })

  it("rejects a null character in the resume", () => {
    expect(validateCandidateForm({ ...valid, resumeText: "abc\u0000" }).resumeText).toBeTruthy()
  })

  it("rejects a phone number longer than 50 characters", () => {
    expect(validateCandidateForm({ ...valid, phone: "1".repeat(51) }).phone).toBeTruthy()
  })

  it("accepts an uploaded file in place of pasted text", () => {
    const file = new File(["Python developer"], "resume.txt", { type: "text/plain" })

    expect(validateCandidateForm({ ...valid, resumeText: "", resumeFile: file })).toEqual({})
  })
})

describe("validateResumeFile", () => {
  it("accepts .txt and .md files, in any letter case", () => {
    expect(validateResumeFile(new File(["x"], "resume.txt"))).toBeNull()
    expect(validateResumeFile(new File(["x"], "CV.MD"))).toBeNull()
  })

  it("rejects other file types", () => {
    expect(validateResumeFile(new File(["%PDF"], "resume.pdf"))).toBe("Upload a .txt or .md file.")
  })

  it("accepts a file of exactly the limit", () => {
    expect(validateResumeFile(new File([new Uint8Array(MAX_RESUME_BYTES)], "resume.txt"))).toBeNull()
  })

  it("rejects a file one byte over the limit", () => {
    expect(validateResumeFile(new File([new Uint8Array(MAX_RESUME_BYTES + 1)], "resume.txt"))).toBe(
      "The file must be 500 KB or smaller.",
    )
  })
})

describe("validateResumeText and validateResumeInput", () => {
  it("rejects pasted text over the limit", () => {
    expect(validateResumeText("a".repeat(MAX_RESUME_BYTES + 1))).toBeTruthy()
  })

  it("rejects pasted text and a file together", () => {
    const file = new File(["x"], "resume.txt")

    expect(validateResumeInput({ text: "Pasted", file })).toBe("Paste the resume or upload a file, not both.")
  })

  it("accepts a file with blank text, since the browser clears the text when a file is chosen", () => {
    expect(validateResumeInput({ text: "", file: new File(["x"], "resume.txt") })).toBeNull()
  })

  it("rejects having neither pasted text nor a file", () => {
    expect(validateResumeInput({ text: "  ", file: null })).toBeTruthy()
  })
})
