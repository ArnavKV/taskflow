import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, Check, CircleAlert, Cloud, LoaderCircle, MessageSquare, Pencil, Send, Trash2, X } from 'lucide-react'
import { columns, fieldClass, niceTime, priorityOptions } from '../taskUtils'
import { Avatar } from './TaskCard'
import ConfirmDialog from './ConfirmDialog'

export default function TaskModal({
  form, setForm, editing, saving, onClose, onSubmit, onAutoSave, onDelete,
  members, tab, setTab, commentText, setCommentText, comments, activity,
  detailLoading, detailError, commentSaving, onComment, createError = '',
}) {
  const [newLabel, setNewLabel] = useState('')
  const [saveStatus, setSaveStatus] = useState('saved')
  const [saveError, setSaveError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [visibleHeight, setVisibleHeight] = useState(null)

  // A snapshot of the last confirmed database state, separate from the editable form.
  const savedSnapshot = useRef(JSON.stringify(form))
  const latestForm = useRef(form)
  const saveRequest = useRef(null)
  const debounceTimer = useRef(null)
  const onAutoSaveRef = useRef(onAutoSave)
  useEffect(() => {
    latestForm.current = form
    onAutoSaveRef.current = onAutoSave
  }, [form, onAutoSave])

  const flushChanges = useCallback(() => {
    window.clearTimeout(debounceTimer.current)
    debounceTimer.current = null
    if (!editing) return Promise.resolve(true)
    if (saveRequest.current) return saveRequest.current

    const run = async () => {
      try {
        // Continue until every edit made during an in-flight request has been persisted.
        while (JSON.stringify(latestForm.current) !== savedSnapshot.current) {
          const nextForm = {
            ...latestForm.current,
            labels: [...(latestForm.current.labels || [])],
            assignee_ids: [...(latestForm.current.assignee_ids || [])],
          }
          if (!nextForm.title.trim()) {
            throw new Error('Please enter a task title before closing.')
          }
          setSaveStatus('saving')
          setSaveError('')
          await onAutoSaveRef.current(nextForm)
          savedSnapshot.current = JSON.stringify(nextForm)
        }
        setSaveStatus('saved')
        return true
      } catch (err) {
        setSaveStatus('error')
        setSaveError(err.message || 'Could not save your changes.')
        return false
      } finally {
        saveRequest.current = null
      }
    }
    // Schedule the first run after the promise reference is installed.
    const request = Promise.resolve().then(run)
    saveRequest.current = request
    return request
  }, [editing])

  useEffect(() => {
    if (!editing) return
    window.clearTimeout(debounceTimer.current)
    if (JSON.stringify(form) === savedSnapshot.current) {
      if (!saveRequest.current) setSaveStatus('saved')
      return
    }
    setSaveStatus('pending')
    debounceTimer.current = window.setTimeout(() => { void flushChanges() }, 700)
    return () => window.clearTimeout(debounceTimer.current)
  }, [editing, form, flushChanges])

  useEffect(() => () => window.clearTimeout(debounceTimer.current), [])

  // iOS keyboards can shrink the visible viewport without changing CSS 100vh.
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const sync = () => setVisibleHeight(Math.round(viewport.height))
    sync()
    viewport.addEventListener('resize', sync)
    return () => viewport.removeEventListener('resize', sync)
  }, [])

  // Keep the board from scrolling behind the mobile editor.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  const requestClose = useCallback(async () => {
    if (commentSaving || confirmDelete || saving) return
    if (editing && !(await flushChanges())) return
    onClose()
  }, [commentSaving, confirmDelete, editing, flushChanges, onClose, saving])

  useEffect(() => {
    function onEscape(event) {
      if (event.key === 'Escape' && !commentSaving && !confirmDelete && !saving) {
        event.preventDefault()
        void requestClose()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [commentSaving, confirmDelete, requestClose, saving])

  const update = (field, value) => setForm(current => ({ ...current, [field]: value }))
  const addLabel = () => {
    const label = newLabel.trim().replace(/^#/, '').slice(0, 24)
    if (label && !(form.labels || []).some(value => value.toLowerCase() === label.toLowerCase())) {
      update('labels', [...(form.labels || []), label].slice(0, 8))
    }
    setNewLabel('')
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget && !commentSaving && !saving) void requestClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="task-modal-heading" className="flex h-[var(--task-visible-height)] w-full max-w-xl min-h-0 flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[min(90dvh,780px)] sm:rounded-2xl" style={{ '--task-visible-height': visibleHeight ? `${visibleHeight}px` : '100dvh' }}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <h2 id="task-modal-heading" className="text-xl font-bold text-slate-900">{editing ? 'Task details' : 'Create a task'}</h2>
            <p className="mt-1 text-sm text-slate-500">{editing ? 'Edit the task or review its discussion and activity.' : 'Add your next play to the board.'}</p>
          </div>
          <button type="button" onClick={() => void requestClose()} disabled={commentSaving || saving} aria-label="Close task details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
        {editing && (
          <div role="status" aria-live="polite" className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${saveStatus === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}`}>
            {saveStatus === 'saving' ? <LoaderCircle size={15} className="animate-spin" /> : saveStatus === 'error' ? <CircleAlert size={15} /> : saveStatus === 'saved' ? <Check size={15} className="text-emerald-600" /> : <Cloud size={15} />}
            <span>{saveStatus === 'saving' ? 'Saving changes…' : saveStatus === 'pending' ? 'Unsaved changes — saving shortly…' : saveStatus === 'error' ? saveError : 'All changes saved'}</span>
            {saveStatus === 'error' && <button type="button" onClick={() => void flushChanges()} className="ml-auto rounded px-2 py-1 font-semibold underline hover:bg-rose-100">Retry</button>}
          </div>
        )}
        {editing && (
          <div role="tablist" aria-label="Task detail sections" className="mb-5 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
            {[
              { id: 'details', text: 'Details', icon: Pencil },
              { id: 'comments', text: 'Comments', icon: MessageSquare },
              { id: 'activity', text: 'Activity', icon: Activity },
            ].map(option => {
              const Icon = option.icon
              return <button key={option.id} type="button" role="tab" aria-selected={tab === option.id} onClick={() => setTab(option.id)} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold sm:text-sm ${tab === option.id ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Icon size={15} />{option.text}</button>
            })}
          </div>
        )}
        {tab === 'details' || !editing ? (
          <form id="task-details-form" onSubmit={event => { if (editing) { event.preventDefault(); void requestClose() } else onSubmit(event) }} className="space-y-4">
            <label className="block space-y-1.5"><span className="text-sm font-semibold">Title *</span><input required maxLength={200} value={form.title} onChange={event => update('title', event.target.value)} className={fieldClass} placeholder="What needs to get done?" /></label>
            <label className="block space-y-1.5"><span className="text-sm font-semibold">Description</span><textarea value={form.description} onChange={event => update('description', event.target.value)} rows={3} className={`${fieldClass} resize-y`} placeholder="Context, acceptance criteria, or notes" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5"><span className="text-sm font-semibold">Priority</span><select value={form.priority} onChange={event => update('priority', event.target.value)} className={fieldClass}>{priorityOptions.map(priority => <option value={priority} key={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
              <label className="block space-y-1.5"><span className="text-sm font-semibold">Due date</span><input type="date" value={form.due_date} onChange={event => update('due_date', event.target.value)} className={fieldClass} /></label>
              <label className="block space-y-1.5 sm:col-span-2"><span className="text-sm font-semibold">Column</span><select value={form.status} onChange={event => update('status', event.target.value)} className={fieldClass}>{columns.map(column => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label>
            </div>
            <div className="space-y-2">
              <span className="block text-sm font-semibold">Labels</span>
              <div className="flex gap-2"><input value={newLabel} onChange={event => setNewLabel(event.target.value)} maxLength={24} placeholder="Add a label (e.g. Feature)" className={fieldClass} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addLabel() } }} /><button type="button" onClick={addLabel} disabled={(form.labels || []).length >= 8} className="rounded-xl border border-slate-200 px-3 font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">Add</button></div>
              {(form.labels || []).length > 0 && <div className="flex flex-wrap gap-2">{form.labels.map(label => <button type="button" key={label} onClick={() => update('labels', form.labels.filter(item => item !== label))} title={`Remove ${label}`} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"># {label}<X size={12} /></button>)}</div>}
            </div>
            <div className="space-y-2">
              <span className="block text-sm font-semibold">Assignees</span>
              {members.length ? (
                <div className="grid max-h-32 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                  {members.map(member => (
                    <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={(form.assignee_ids || []).includes(member.id)} onChange={event => update('assignee_ids', event.target.checked ? [...form.assignee_ids, member.id] : form.assignee_ids.filter(id => id !== member.id))} className="accent-emerald-600" />
                      <Avatar member={member} size="sm" /><span className="truncate">{member.name}</span>
                    </label>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-500">No team members yet. Use the Team button on the board to add some.</p>}
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {detailError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{detailError}</p>}
            {detailLoading ? <p className="flex items-center gap-2 py-5 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={16} />Loading details…</p> : tab === 'comments' ? (
              <>
                <div className="max-h-60 space-y-3 overflow-y-auto">
                  {comments.length ? comments.map(comment => (
                    <div key={comment.id} className="rounded-xl bg-slate-50 px-3 py-3">
                      <div className="mb-1 flex items-center justify-between"><span className="text-xs font-semibold text-slate-700">Guest teammate</span><span className="text-[11px] text-slate-400">{niceTime(comment.created_at)}</span></div>
                      <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{comment.body}</p>
                    </div>
                  )) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No comments yet. Start the discussion.</p>}
                </div>
                <form onSubmit={onComment} className="space-y-2"><textarea required maxLength={2000} rows={3} value={commentText} onChange={event => setCommentText(event.target.value)} className={fieldClass} placeholder="Write a comment..." /><button type="submit" disabled={commentSaving || !commentText.trim()} className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{commentSaving ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}Post comment</button></form>
              </>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {activity.length ? activity.map(entry => (
                  <div key={entry.id} className="flex gap-3 border-l-2 border-emerald-200 py-1 pl-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" /><div><p className="text-sm font-medium text-slate-700">{entry.details}</p><span className="mt-1 block text-xs text-slate-400">{niceTime(entry.created_at)}</span></div></div>
                )) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No recorded activity yet.</p>}
              </div>
            )}
          </div>
        )}
        </div>
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {!editing && createError && (
            <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {createError}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            {editing ? (
              <button type="button" disabled={saving} onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={16} />Delete</button>
            ) : <span className="text-xs text-slate-500">* Required</span>}
            <div className="flex items-center gap-2">
              {editing ? (
                <button type="button" onClick={() => void requestClose()} disabled={commentSaving || saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saveStatus === 'saving' ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
                  Done
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => void requestClose()} disabled={saving} className="min-h-11 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">Cancel</button>
                  <button type="submit" form="task-details-form" disabled={saving || !form.title.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
                    {saving ? 'Creating…' : 'Create task'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this task?"
          description={<>"{form.title}" and its comments and activity history will be permanently deleted. This cannot be undone.</>}
          confirmLabel="Delete task"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            // Wait for any in-progress auto-save before deleting the row.
            if (!(await flushChanges())) throw new Error('Could not finish saving changes. Cancel and review the editor before retrying.')
            await onDelete()
          }}
        />
      )}
    </div>
  )
}
