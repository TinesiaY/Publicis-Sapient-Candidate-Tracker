import { describe, expect, it } from "vitest"
import { validateRoleForm } from "./validateRole"

const valid = { name: "Data Analyst", jdText: "Analyse product data and report on it." }

describe("validateRoleForm", () => {
  it("accepts a title and description", () => {
    expect(validateRoleForm(valid)).toEqual({})
  })

  it("requires a job title", () => {
    expect(validateRoleForm({ ...valid, name: "  " }).name).toBeTruthy()
  })

  it("requires a job description", () => {
    expect(validateRoleForm({ ...valid, jdText: "\n\t" }).jdText).toBeTruthy()
  })

  it("rejects a null character in the title", () => {
    expect(validateRoleForm({ ...valid, name: "Data\u0000Analyst" }).name).toBeTruthy()
  })
})
