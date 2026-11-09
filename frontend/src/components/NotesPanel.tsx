import { Lock, Plus } from "lucide-react"
import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import { addNote, listNotes } from "../api/client"
import type { Note } from "../api/types"
import { formatDate } from "../lib/format"
import { canSubmitNote, NOTE_MAX_LENGTH, trimNote, validateNote } from "../lib/validateNote"

function formatDateTime(isoDate: string): string {
  const time = new Date(isoDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return `${formatDate(isoDate)} · ${time}`
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function NotesPanel({ candidateId }: { candidateId: number }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    let current = true
    listNotes(candidateId)
      .then((rows) => {
        if (current) setNotes(rows)
      })
      .catch((error: unknown) => {
        if (current) setLoadError(messageOf(error, "Could not load the notes."))
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [candidateId, reloadKey])

  // Try again shows loading first, so the effect itself never sets state.
  function retryLoad() {
    setLoading(true)
    setLoadError("")
    setReloadKey((key) => key + 1)
  }

  const length = trimNote(body).length
  const problem = validateNote(body)
  const canSubmit = canSubmitNote(body) && !saving

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setSaveError("")
    try {
      const saved = await addNote(candidateId, trimNote(body))
      // The note joins the list only after the server has saved it.
      setNotes((current) => [saved, ...current])
      setBody("")
    } catch (error) {
      // The text stays in the box, so the user can try again.
      setSaveError(messageOf(error, "Could not save the note. Try again."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <h2 className="text-lg font-semibold">Notes</h2>
        {!loading && !loadError && (
          <span className="text-sm text-muted">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </span>
        )}
      </div>

      <form onSubmit={submit} className="space-y-3 border-b border-line px-6 py-5">
        <label htmlFor="note-body" className="text-sm font-medium">
          New note
        </label>
        <textarea
          id="note-body"
          rows={3}
          value={body}
          disabled={saving}
          onChange={(event) => {
            setBody(event.target.value)
            setSaveError("")
          }}
          placeholder="Add a note about this candidate..."
          aria-invalid={problem ? true : undefined}
          aria-describedby="note-counter"
          className="w-full resize-y rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm leading-relaxed shadow-xs focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        {problem && <p className="text-sm text-rose-700">{problem}</p>}
        {saveError && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {saveError}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <span
            id="note-counter"
            className={`text-sm ${length > NOTE_MAX_LENGTH ? "text-rose-700" : "text-muted"}`}
          >
            {length} / {NOTE_MAX_LENGTH}
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="size-4" aria-hidden="true" />
            {saving ? "Saving..." : "Add note"}
          </button>
        </div>
      </form>

      <div className="px-6 py-5">
        {loading && <p className="text-sm text-muted">Loading notes...</p>}

        {loadError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span>{loadError}</span>
            <button type="button" onClick={retryLoad} className="font-medium underline">
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && notes.length === 0 && <p className="text-sm text-muted">No notes yet.</p>}

        <ul className="divide-y divide-line">
          {notes.map((note) => (
            <li key={note.id} className="py-4">
              <div className="flex items-center justify-between gap-3 text-sm text-muted">
                <span>{formatDateTime(note.created_at)}</span>
                <span title="Saved notes cannot be changed">
                  <Lock className="size-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink">{note.body}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="border-t border-line px-6 py-4 text-xs text-muted">
        Notes are permanent. New notes are added to the history and can't be edited or removed.
      </p>
    </section>
  )
}
