import { Upload, X } from "lucide-react"
import type { DragEvent } from "react"
import { useState } from "react"
import { validateResumeFile, type ResumeInputValue } from "../lib/validateCandidate"
import { inputClass } from "./FormControls"

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}

interface ResumeInputProps {
  id: string
  value: ResumeInputValue
  onChange: (value: ResumeInputValue) => void
  error?: string
  disabled?: boolean
}

// Pasted text or one .txt or .md file. Choosing a file clears the text, and typing is disabled while a file is chosen.
export function ResumeInput({ id, value, onChange, error, disabled = false }: ResumeInputProps) {
  const [fileError, setFileError] = useState("")
  const [dragging, setDragging] = useState(false)

  const shownError = error || fileError
  const hasFile = value.file !== null

  function chooseFile(file: File | undefined) {
    if (!file) return
    const problem = validateResumeFile(file)
    if (problem) {
      setFileError(problem)
      return
    }
    setFileError("")
    onChange({ text: "", file })
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    if (disabled || hasFile) return
    chooseFile(event.dataTransfer.files[0])
  }

  return (
    <div className="space-y-3">
      <textarea
        id={id}
        rows={10}
        value={value.text}
        disabled={disabled || hasFile}
        onChange={(event) => {
          setFileError("")
          onChange({ text: event.target.value, file: null })
        }}
        aria-invalid={shownError ? true : undefined}
        className={`${inputClass(Boolean(shownError))} resize-y leading-relaxed disabled:cursor-not-allowed disabled:opacity-60`}
      />

      {value.file ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-white px-5 py-4 text-sm">
          <div>
            <p className="font-medium">{value.file.name}</p>
            <p className="text-muted">{formatSize(value.file.size)}</p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setFileError("")
              onChange({ text: "", file: null })
            }}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="size-4" aria-hidden="true" />
            Remove file
          </button>
        </div>
      ) : (
        <label
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-5 py-5 text-sm ${
            dragging ? "border-brand bg-brand-soft" : "border-line bg-white"
          } ${disabled ? "pointer-events-none opacity-60" : ""}`}
        >
          <Upload className="size-5 text-muted" aria-hidden="true" />
          <span>
            <span className="font-medium text-brand">Choose a file</span>{" "}
            <span className="text-muted">or drag and drop</span>
            <span className="block text-muted">TXT or MD · up to 500 KB</span>
          </span>
          <input
            type="file"
            accept=".txt,.md"
            aria-label="Choose a file to upload"
            disabled={disabled}
            className="sr-only"
            onChange={(event) => {
              chooseFile(event.target.files?.[0])
              // Clear the picker, so choosing the same file again still fires a change.
              event.target.value = ""
            }}
          />
        </label>
      )}

      {shownError && <p className="text-sm text-rose-600">{shownError}</p>}
    </div>
  )
}
