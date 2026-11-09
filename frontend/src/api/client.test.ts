import { afterEach, describe, expect, it, vi } from "vitest"
import { buildCandidateQuery, getSummary, regenerateSummary, retrySummary } from "./client"

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

  it("sends archived=false for active candidates and archived=true for the archive", () => {
    expect(buildCandidateQuery({ archived: false })).toBe("?archived=false")
    expect(buildCandidateQuery({ archived: true })).toBe("?archived=true")
  })

  it("leaves out archived when it is not set", () => {
    expect(buildCandidateQuery({ stage: "Applied" })).toBe("?stage=Applied")
  })
})

describe("summary calls", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(status: number, body: unknown) {
    // A new Response for each call, because a response body can be read only once.
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })))
    vi.stubGlobal("fetch", fetchMock)
    return fetchMock
  }

  it("reads the summary with GET", async () => {
    const fetchMock = stubFetch(200, { status: "pending" })

    await getSummary(7)

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/candidates/7/summary", undefined)
  })

  it("posts a retry and a regenerate to their own paths", async () => {
    const fetchMock = stubFetch(202, { status: "pending" })

    await retrySummary(7)
    await regenerateSummary(7)

    expect(fetchMock.mock.calls[0]).toEqual(["http://127.0.0.1:8000/candidates/7/summary/retry", { method: "POST" }])
    expect(fetchMock.mock.calls[1]).toEqual([
      "http://127.0.0.1:8000/candidates/7/summary/regenerate",
      { method: "POST" },
    ])
  })

  it("shows the server's message when a retry is refused", async () => {
    stubFetch(409, { detail: "Only a failed summary can be retried" })

    await expect(retrySummary(7)).rejects.toThrow("Only a failed summary can be retried")
  })
})
