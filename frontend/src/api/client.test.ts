import { describe, expect, it } from "vitest"
import { buildCandidateQuery } from "./client"

describe("buildCandidateQuery", () => {
  it("returns nothing when no filters are set", () => {
    expect(buildCandidateQuery({})).toBe("")
  })

  it("uses the parameter names the backend reads", () => {
    expect(buildCandidateQuery({ stage: "Interview", roleId: 2, search: "ann", sort: "stage" })).toBe(
      "?stage=Interview&role_id=2&search=ann&sort=stage",
    )
  })

  it("trims the search, skips a blank search and leaves out the default sort", () => {
    expect(buildCandidateQuery({ search: "   ", sort: "added" })).toBe("")
    expect(buildCandidateQuery({ search: "  ann  " })).toBe("?search=ann")
  })

  it("encodes symbols so the backend receives them unchanged", () => {
    expect(buildCandidateQuery({ search: "100%_x" })).toBe("?search=100%25_x")
  })
})
