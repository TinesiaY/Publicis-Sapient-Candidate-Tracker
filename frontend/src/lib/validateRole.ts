import { isBlank } from "./validateCandidate"

// Client-side checks for the add-job form and the new-role panel. They match the backend rules.

export interface RoleFormValues {
  name: string
  jdText: string
}

export type RoleFormErrors = Partial<Record<keyof RoleFormValues, string>>

const NUL = "\u0000"

export function validateRoleForm(values: RoleFormValues): RoleFormErrors {
  const errors: RoleFormErrors = {}

  if (isBlank(values.name)) {
    errors.name = "Enter the job title."
  } else if (values.name.length > 200) {
    errors.name = "Job title must be 200 characters or fewer."
  } else if (values.name.includes(NUL)) {
    errors.name = "Job title contains characters that cannot be saved."
  }

  if (isBlank(values.jdText)) {
    errors.jdText = "Write the job description."
  } else if (values.jdText.includes(NUL)) {
    errors.jdText = "Job description contains characters that cannot be saved."
  }

  return errors
}
