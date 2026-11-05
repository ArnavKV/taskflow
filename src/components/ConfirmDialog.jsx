import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, LoaderCircle, Trash2, X } from 'lucide-react'

/** A consistent confirmation dialog for actions that cannot be undone. */
export default function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel }) {
  const closeRef = useRef(null)
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (!pending) onCancel()
    }
    if (event.key === 'Tab') {
      // Keep keyboard focus on one of the two actions while the dialog is open.
      const first = closeRef.current
      const last = confirmRef.current
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  async function handleConfirm() {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await onConfirm()
      onCancel()
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-[3px]"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !pending) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_28px_80px_rgba(2,6,23,0.35)] sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle size={23} strokeWidth={1.8} />
          </span>
          <button ref={closeRef} type="button" aria-label="Cancel deletion" onClick={onCancel} disabled={pending}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>
        <h2 id="confirm-dialog-title" className="mt-5 text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={pending}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50">
            Cancel
          </button>
          <button ref={confirmRef} type="button" onClick={() => void handleConfirm()} disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-60">
            {pending ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {pending ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
