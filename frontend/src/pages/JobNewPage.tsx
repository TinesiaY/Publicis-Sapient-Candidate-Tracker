import type { FormEvent } from "react"
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { ApiError, createRole } from "../api/client"
import { AppShell } from "../components/AppShell"
import { Field, TextArea, TextInput } from "../components/FormControls"
import { validateRoleForm, type RoleFormErrors, type RoleFormValues } from "../lib/validateRole"

const EMPTY_VALUES: RoleFormValues = { name: "", jdText: "" }

export function JobNewPage() {
  const navigate = useNavigate()
  const [values, setValues] = useState<RoleFormValues>(EMPTY_VALUES)
  const [errors, setErrors] = useState<RoleFormErrors>({})
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function update(field: keyof RoleFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError("")

    const found = validateRoleForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      const job = await createRole({ name: values.name.trim(), jd_text: values.jdText })
      navigate(`/jobs/${job.id}`)
    } catch (error) {
      setSubmitting(false)
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ name: `${error.message}. Choose a different title.` })
      } else {
        setSubmitError(error instanceof Error ? error.message : "Something went wrong. Please try again.")
      }
    }
  }

  return (
    <AppShell breadcrumbs={[{ label: "Workspace" }, { label: "Jobs", to: "/jobs" }, { label: "Add job" }]}>
      <h1 className="text-3xl font-semibold tracking-tight">Add a job</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-8 max-w-3xl overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="text-lg font-semibold">Job details</h2>
          <span className="text-sm text-muted">* Required fields</span>
        </div>

        <div className="space-y-6 px-6 py-6">
          <Field id="jobTitle" label="Job title" required error={errors.name}>
            <TextInput
              id="jobTitle"
              value={values.name}
              onChange={(value) => update("name", value)}
              error={errors.name}
              placeholder="e.g. Data Analyst"
            />
          </Field>

          <Field
            id="jobDescription"
            label="Job description"
            required
            error={errors.jdText}
            hint="Shown on the job page. Describe what the role involves and what you are looking for."
          >
            <TextArea
              id="jobDescription"
              rows={12}
              value={values.jdText}
              onChange={(value) => update("jdText", value)}
              error={errors.jdText}
            />
          </Field>
        </div>

        {submitError && (
          <div role="alert" className="mx-6 mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-line bg-page px-6 py-4">
          <span className="text-sm text-muted">Candidates can apply for this job once it is saved.</span>
          <div className="flex items-center gap-3">
            <Link to="/jobs" className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-50">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : "+ Add job"}
            </button>
          </div>
        </div>
      </form>
    </AppShell>
  )
}
