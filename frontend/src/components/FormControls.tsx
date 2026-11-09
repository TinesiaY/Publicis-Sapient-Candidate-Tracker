import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"
import { inputClass } from "../lib/formStyles"

export function Field({
  id,
  label,
  required,
  optional,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  optional?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
        {label}
        {required && (
          <span className="text-rose-600" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-1.5 text-sm text-rose-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>
      )}
    </div>
  )
}

export function TextInput({
  id,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
  autoComplete?: string
  placeholder?: string
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      placeholder={placeholder}
      aria-invalid={error ? true : undefined}
      className={inputClass(Boolean(error))}
    />
  )
}

export function TextArea({
  id,
  value,
  onChange,
  error,
  rows = 6,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  error?: string
  rows?: number
  placeholder?: string
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-invalid={error ? true : undefined}
      className={`${inputClass(Boolean(error))} resize-y leading-relaxed`}
    />
  )
}

export function SelectInput({
  id,
  value,
  onChange,
  error,
  disabled,
  children,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className={`${inputClass(Boolean(error))} appearance-none pr-10 disabled:text-muted`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  )
}
