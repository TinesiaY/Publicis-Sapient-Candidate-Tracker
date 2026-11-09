// Client-side checks for the add-candidate form. They match the backend rules,
// so most mistakes are caught before a request is sent. The backend is still the authority.

export interface CandidateFormValues {
  name: string
  email: string
  phone: string
  roleId: string
  source: string
  resumeText: string
  // An uploaded file is used instead of the pasted text. Only one of the two is sent.
  resumeFile?: File | null
}

export type CandidateFormErrors = Partial<Record<keyof CandidateFormValues, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The same characters the backend treats as whitespace when checking for blank text.
const BLANK_PATTERN = /^[ \t\r\n\f\v]*$/
const NUL = "\u0000"

// Resume limits. They match backend/app/resume_input.py.
export const MAX_RESUME_BYTES = 500 * 1024
export const RESUME_EXTENSIONS = [".txt", ".md"] as const

export function isBlank(value: string): boolean {
  return BLANK_PATTERN.test(value)
}

export function validateResumeFile(file: File): string | null {
  const name = file.name.toLowerCase()
  if (!RESUME_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return "Upload a .txt or .md file."
  }
  if (file.size > MAX_RESUME_BYTES) {
    return "The file must be 500 KB or smaller."
  }
  return null
}

export function validateResumeText(text: string): string | null {
  if (isBlank(text)) {
    return "Paste the resume or cover letter text."
  }
  if (text.includes(NUL)) {
    return "Resume contains characters that cannot be saved."
  }
  if (new TextEncoder().encode(text).length > MAX_RESUME_BYTES) {
    return "The pasted resume must be 500 KB or smaller."
  }
  return null
}

export interface ResumeInputValue {
  text: string
  file: File | null
}

// Exactly one of pasted text or a file must be given.
export function validateResumeInput(value: ResumeInputValue): string | null {
  if (value.file) {
    if (!isBlank(value.text)) {
      return "Paste the resume or upload a file, not both."
    }
    return validateResumeFile(value.file)
  }
  return validateResumeText(value.text)
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

  const resumeError = validateResumeInput({ text: values.resumeText, file: values.resumeFile ?? null })
  if (resumeError) {
    errors.resumeText = resumeError
  }

  return errors
}
