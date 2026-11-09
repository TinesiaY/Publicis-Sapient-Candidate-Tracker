import { describe, expect, it } from "vitest"
import { canRetry, failureMessage } from "./summary"

describe("failureMessage", () => {
  it("gives a plain reason for each error code", () => {
    expect(failureMessage("rate_limited", true)).toBe("The AI service is busy. Wait a few minutes, then try again.")
    expect(failureMessage("provider_timeout", true)).toBe("The AI service took too long to answer.")
    expect(failureMessage("provider_error", true)).toBe("The AI service returned an error.")
    expect(failureMessage("invalid_output", true)).toBe("The AI reply did not match the expected format.")
    expect(failureMessage("timeout", true)).toBe("The summary took longer than three minutes.")
    expect(failureMessage("interrupted", true)).toBe("The server stopped before the summary finished.")
  })

  it("says to add the key to backend/.env and restart the backend when the server has no key", () => {
    expect(failureMessage("not_configured", false)).toBe(
      "AI summaries are off. Add GEMINI_API_KEY to backend/.env, then restart the backend.",
    )
  })

  it("explains that a summary made without a key can be retried once the server has one", () => {
    expect(failureMessage("not_configured", true)).toBe(
      "This summary was not made, because the server had no key when it ran. Retry it now.",
    )
  })

  it("falls back to a general message for an unknown or missing code", () => {
    expect(failureMessage("something_new", true)).toBe("The summary failed.")
    expect(failureMessage(null, true)).toBe("The summary failed.")
  })
})

describe("canRetry", () => {
  it("offers retry for every failure", () => {
    expect(canRetry("rate_limited", true)).toBe(true)
    expect(canRetry("timeout", false)).toBe(true)
    expect(canRetry(null, false)).toBe(true)
  })

  it("offers retry for a missing key only once the server has a key", () => {
    expect(canRetry("not_configured", false)).toBe(false)
    expect(canRetry("not_configured", true)).toBe(true)
  })
})
