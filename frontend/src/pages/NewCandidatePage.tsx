import { Upload } from "lucide-react"
import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { ApiError, createCandidate, createRole, listRoles } from "../api/client"
import type { Role } from "../api/types"
import { SOURCES, STAGES } from "../api/types"
import { AppShell } from "../components/AppShell"
import { Field, SelectInput, TextArea, TextInput } from "../components/FormControls"
import { validateCandidateForm, type CandidateFormErrors, type CandidateFormValues } from "../lib/validateCandidate"
import { validateRoleForm, type RoleFormErrors, type RoleFormValues } from "../lib/validateRole"

// The role dropdown's value that means "create a new job first".
export const NEW_ROLE = "__new__"

const EMPTY_VALUES: CandidateFormValues = {
  name: "",
  email: "",
  phone: "",
  roleId: "",
  source: "",
  resumeText: "",
}

const EMPTY_NEW_ROLE: RoleFormValues = { name: "", jdText: "" }

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

// Field names match the form fields the backend reads in backend/app/routers/candidates.py.
function toFormData(values: CandidateFormValues): FormData {
  const data = new FormData()
  data.append("name", values.name)
  data.append("email", values.email)
  data.append("role_id", values.roleId)
  data.append("phone", values.phone)
  data.append("source", values.source)
  data.append("resume_text", values.resumeText)
  return data
}

function roleOptionsPlaceholder(loaded: boolean, error: string, count: number): string {
  if (!loaded) return "Loading jobs..."
  if (error) return "Jobs could not be loaded"
  return count === 0 ? "No jobs yet" : "Select a job"
}

export function NewCandidatePage() {
  const navigate = useNavigate()
  const [values, setValues] = useState<CandidateFormValues>(EMPTY_VALUES)
  const [newRole, setNewRole] = useState<RoleFormValues>(EMPTY_NEW_ROLE)
  const [errors, setErrors] = useState<CandidateFormErrors>({})
  const [roleErrors, setRoleErrors] = useState<RoleFormErrors>({})
  const [roles, setRoles] = useState<Role[]>([])
  const [rolesLoaded, setRolesLoaded] = useState(false)
  const [rolesError, setRolesError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    listRoles()
      .then((loaded) => setRoles(loaded))
      .catch((error: unknown) => setRolesError(messageOf(error)))
      .finally(() => setRolesLoaded(true))
  }, [])

  function update(field: keyof CandidateFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function updateNewRole(field: keyof RoleFormValues, value: string) {
    setNewRole((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError("")

    const candidateErrors = validateCandidateForm(values)
    const newRoleErrors = values.roleId === NEW_ROLE ? validateRoleForm(newRole) : {}
    setErrors(candidateErrors)
    setRoleErrors(newRoleErrors)
    if (Object.keys(candidateErrors).length > 0 || Object.keys(newRoleErrors).length > 0) {
      return
    }

    setSubmitting(true)
    let roleId = values.roleId

    // Save the new job first, so the candidate can point at it.
    if (roleId === NEW_ROLE) {
      try {
        const created = await createRole({ name: newRole.name.trim(), jd_text: newRole.jdText })
        roleId = String(created.id)
        setRoles((current) => [...current, created])
        setValues((current) => ({ ...current, roleId }))
        setNewRole(EMPTY_NEW_ROLE)
      } catch (error) {
        setSubmitting(false)
        if (error instanceof ApiError && error.status === 409) {
          setRoleErrors({ name: `${error.message}. Choose it from the list instead.` })
          listRoles()
            .then(setRoles)
            .catch(() => undefined)
        } else {
          setSubmitError(messageOf(error))
        }
        return
      }
    }

    try {
      await createCandidate(toFormData({ ...values, roleId }))
      navigate("/candidates")
    } catch (error) {
      // If the job was just created, it stays selected, so a retry does not create it twice.
      setSubmitError(messageOf(error))
      setSubmitting(false)
    }
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: "Workspace", to: "/candidates" },
        { label: "Candidates", to: "/candidates" },
        { label: "Add candidate" },
      ]}
    >
      <h1 className="text-3xl font-semibold tracking-tight">Add a candidate</h1>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 max-w-4xl overflow-hidden rounded-xl border border-line bg-white"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="text-lg font-semibold">Candidate information</h2>
          <span className="text-sm text-muted">* Required fields</span>
        </div>

        <div className="space-y-8 px-6 py-6">
          <section>
            <h3 className="text-sm font-semibold">Personal details</h3>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <Field id="name" label="Full name" required error={errors.name}>
                <TextInput
                  id="name"
                  value={values.name}
                  onChange={(value) => update("name", value)}
                  error={errors.name}
                  autoComplete="name"
                />
              </Field>
              <Field id="email" label="Email address" required error={errors.email}>
                <TextInput
                  id="email"
                  type="email"
                  value={values.email}
                  onChange={(value) => update("email", value)}
                  error={errors.email}
                  autoComplete="email"
                />
              </Field>
              <Field id="phone" label="Phone number" optional error={errors.phone} hint="Include a country code, if available.">
                <TextInput
                  id="phone"
                  type="tel"
                  value={values.phone}
                  onChange={(value) => update("phone", value)}
                  error={errors.phone}
                  autoComplete="tel"
                  placeholder="+1 (646) 555-0182"
                />
              </Field>
            </div>
          </section>

          <hr className="border-line" />

          <section>
            <h3 className="text-sm font-semibold">Application details</h3>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <Field id="roleId" label="Role applied for" required error={errors.roleId}>
                <SelectInput
                  id="roleId"
                  value={values.roleId}
                  onChange={(value) => update("roleId", value)}
                  error={errors.roleId}
                >
                  <option value="">{roleOptionsPlaceholder(rolesLoaded, rolesError, roles.length)}</option>
                  {roles.map((role) => (
                    <option key={role.id} value={String(role.id)}>
                      {role.name}
                    </option>
                  ))}
                  <option value={NEW_ROLE}>+ Add a new job</option>
                </SelectInput>
              </Field>
              <Field id="source" label="Source" optional error={errors.source}>
                <SelectInput id="source" value={values.source} onChange={(value) => update("source", value)} error={errors.source}>
                  <option value="">Choose a source</option>
                  {SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            {values.roleId === NEW_ROLE && (
              <div className="mt-5 space-y-5 rounded-lg border border-line bg-page p-5">
                <p className="text-sm font-medium">New job</p>
                <Field
                  id="newRoleName"
                  label="Job title"
                  required
                  error={roleErrors.name}
                  hint="The job is saved to Jobs when you add the candidate."
                >
                  <TextInput
                    id="newRoleName"
                    value={newRole.name}
                    onChange={(value) => updateNewRole("name", value)}
                    error={roleErrors.name}
                    placeholder="e.g. Data Analyst"
                  />
                </Field>
                <Field id="newRoleDescription" label="Job description" required error={roleErrors.jdText}>
                  <TextArea
                    id="newRoleDescription"
                    rows={5}
                    value={newRole.jdText}
                    onChange={(value) => updateNewRole("jdText", value)}
                    error={roleErrors.jdText}
                    placeholder="What the role involves and what you are looking for."
                  />
                </Field>
              </div>
            )}

            <div className="mt-5 flex items-center gap-3 text-sm">
              <span className="text-muted">Starting stage</span>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600">{STAGES[0]}</span>
              <span className="text-muted">You can change this after adding.</span>
            </div>
            {rolesError && <p className="mt-3 text-sm text-rose-600">{rolesError}</p>}
          </section>

          <hr className="border-line" />

          <section>
            <Field
              id="resumeText"
              label="Resume / cover letter"
              required
              error={errors.resumeText}
              hint="Paste text. File upload is coming in a later milestone."
            >
              <TextArea
                id="resumeText"
                rows={10}
                value={values.resumeText}
                onChange={(value) => update("resumeText", value)}
                error={errors.resumeText}
              />
            </Field>

            <div
              aria-disabled="true"
              className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-line px-5 py-5 text-sm text-muted"
            >
              <Upload className="size-5" aria-hidden="true" />
              <span>
                File upload <span className="text-muted/70">(PDF, DOCX or TXT, up to 10 MB) arrives in a later milestone.</span>
              </span>
            </div>
          </section>
        </div>

        {submitError && (
          <div role="alert" className="mx-6 mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-line bg-page px-6 py-4">
          <span className="text-sm text-muted">Nothing is saved until you add the candidate.</span>
          <div className="flex items-center gap-3">
            <Link to="/candidates" className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-50">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Adding..." : "+ Add candidate"}
            </button>
          </div>
        </div>
      </form>
    </AppShell>
  )
}
