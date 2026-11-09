import type { FormEvent } from "react"
import { useState } from "react"
import { replaceCandidateResume } from "../api/client"
import type { CandidateDetail } from "../api/types"
import { validateResumeInput, type ResumeInputValue } from "../lib/validateCandidate"
import { Field } from "./FormControls"
import { ResumeInput } from "./ResumeInput"

interface ReplaceResumePanelProps {
  candidateId: number
  onSaved: (updated: CandidateDetail) => void
  onCancel: () => void
}

// Replaces the resume. The page shows the new resume only after the server has saved it.
export function ReplaceResumePanel({ candidateId, onSaved, onCancel }: ReplaceResumePanelProps) {
  const [value, setValue] = useState<ResumeInputValue>({ text: "", file: null })
  const [clientError, setClientError] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = validateResumeInput(value)
    setClientError(problem ?? "")
    if (problem) return

    setSaving(true)
    setSaveError("")
    try {
      onSaved(await replaceCandidateResume(candidateId, value))
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not replace the resume. Try again.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-4 rounded-lg border border-line bg-page p-5">
      <p className="text-sm text-muted">Replacing the resume creates a new summary. Notes and the stage stay the same.</p>

      <Field id="replacementResume" label="New resume" required>
        <ResumeInput
          id="replacementResume"
          value={value}
          onChange={(next) => {
            setValue(next)
            setClientError("")
          }}
          error={clientError}
          disabled={saving}
        />
      </Field>

      {saveError && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {saveError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save resume"}
        </button>
      </div>
    </form>
  )
}
