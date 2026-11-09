import { isBlank } from "./validateCandidate"

// The backend limit. It is counted after leading and trailing spaces and line breaks are removed.
export const NOTE_MAX_LENGTH = 2000

const BLANK_EDGES = /^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g
const NUL = "\u0000"

// The text the backend will store: the note with its leading and trailing blanks removed.
export function trimNote(body: string): string {
  return body.replace(BLANK_EDGES, "")
}

// Returns a message for a note that cannot be sent, or null if it can.
// Blank notes are not reported here: the Add note button is disabled for them instead.
export function validateNote(body: string): string | null {
  if (body.includes(NUL)) {
    return "Note contains characters that cannot be saved."
  }
  if (trimNote(body).length > NOTE_MAX_LENGTH) {
    return `Notes can be up to ${NOTE_MAX_LENGTH} characters.`
  }
  return null
}

export function canSubmitNote(body: string): boolean {
  return !isBlank(body) && validateNote(body) === null
}
