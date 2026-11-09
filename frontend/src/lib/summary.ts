// Plain-language text for summary error codes. The server sends codes, not sentences.

export const NOT_CONFIGURED = "not_configured"

const FAILURE_MESSAGES: Record<string, string> = {
  rate_limited: "The AI service is busy. Wait a few minutes, then try again.",
  provider_timeout: "The AI service took too long to answer.",
  provider_error: "The AI service returned an error.",
  invalid_output: "The AI reply did not match the expected format.",
  timeout: "The summary took longer than three minutes.",
  interrupted: "The server stopped before the summary finished.",
  [NOT_CONFIGURED]: "AI summaries are off. Add GEMINI_API_KEY to backend/.env, then restart the backend.",
}

// providerConfigured is true when the server now has a key. A summary that failed without one can then be retried.
export function failureMessage(code: string | null, providerConfigured: boolean): string {
  if (code === NOT_CONFIGURED && providerConfigured) {
    return "This summary was not made, because the server had no key when it ran. Retry it now."
  }
  return (code && FAILURE_MESSAGES[code]) || "The summary failed."
}

// Retry is offered for every failure, except a missing key while the server still has no key. Retrying cannot help then.
export function canRetry(code: string | null, providerConfigured: boolean): boolean {
  return code !== NOT_CONFIGURED || providerConfigured
}
