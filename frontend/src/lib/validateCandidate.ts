// Client-side checks for the add-candidate form. They match the backend rules,
// so most mistakes are caught before a request is sent. The backend is still the authority.

export interface CandidateFormValues {
  name: string
  email: string
  phone: string
  roleId: string
  source: string
  resumeText: string
}

export type CandidateFormErrors = Partial<Record<keyof CandidateFormValues, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The same characters the backend treats as whitespace when checking for blank text.
const BLANK_PATTERN = /^[ \t\r\n\f\v]*$/
const NUL = "\u0000"

export function isBlank(value: string): boolean {
  return BLANK_PATTERN.test(value)
}

export function validateCandidateForm(values: CandidateFormValues): CandidateFormErrors {
  const errors: CandidateFormErrors = {}

  if (isBlank(values.name)) {
    errors.name = "Enter the candidate's full name."
  } else if (values.name.length > 200) {
    errors.name = "Name must be 200 characters or fewer."
  } else if (values.name.includes(NUL)) {
    errors.name = "Name contains characters that cannot be saved."
  }

  if (isBlank(values.email)) {
    errors.email = "Enter an email address."
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Enter a valid email address, like name@example.com."
  }

  if (values.phone.length > 50) {
    errors.phone = "Phone number must be 50 characters or fewer."
  }

  if (values.roleId === "") {
    errors.roleId = "Choose the role applied for."
  }

  if (values.source.length > 100) {
    errors.source = "Source must be 100 characters or fewer."
  }

  if (isBlank(values.resumeText)) {
    errors.resumeText = "Paste the resume or cover letter text."
  } else if (values.resumeText.includes(NUL)) {
    errors.resumeText = "Resume contains characters that cannot be saved."
  }

  return errors
}
