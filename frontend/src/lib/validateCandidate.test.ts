import { describe, expect, it } from "vitest"
import { validateCandidateForm, type CandidateFormValues } from "./validateCandidate"

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
})
