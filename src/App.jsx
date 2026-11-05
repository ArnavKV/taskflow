import { useCallback, useEffect, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  Activity, AlertCircle, ArrowRight, CalendarDays, Check,
  CheckCircle2, CircleCheck, Clock3, Filter, LayoutDashboard,
  ListTodo, LoaderCircle, MessageSquare, Pencil, Plus, Search,
  Send, Tag, Trash2, UserPlus, UsersRound, X,
} from 'lucide-react'
import { supabase } from './supabase'

// Designed to drop into the existing Vite/React app. Run the accompanying SQL
// migration before using Team, Comments, Activity and Tags features.
const columns = [
  { id: 'todo', name: 'To Do', dot: 'bg-slate-400' },
  { id: 'in_progress', name: 'In Progress', dot: 'bg-sky-500' },
  { id: 'in_review', name: 'In Review', dot: 'bg-amber-500' },
  { id: 'done', name: 'Done', dot: 'bg-emerald-500' },
]

const priorityOptions = ['low', 'normal', 'high']
const memberColors = {
  emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  blue: 'bg-blue-100 text-blue-800 ring-blue-200',
  purple: 'bg-violet-100 text-violet-800 ring-violet-200',
  amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  rose: 'bg-rose-100 text-rose-800 ring-rose-200',
}
const badgePriority = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-sky-50 text-sky-700',
  high: 'bg-rose-50 text-rose-700',
}
const blankForm = {
  title: '', description: '', priority: 'normal',
  due_date: '', status: 'todo', labels: [], assignee_ids: [],
}
const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

function todayLocalISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function dueInfo(date, status) {
  if (!date) return null
  if (status !== 'done' && date < todayLocalISO()) return { label: 'Overdue', style: 'bg-rose-50 text-rose-700' }
  if (status !== 'done' && date === todayLocalISO()) return { label: 'Due today', style: 'bg-amber-50 text-amber-800' }
  const label = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const daysUntil = (new Date(`${date}T12:00:00`) - new Date(`${todayLocalISO()}T12:00:00`)) / 86400000
  if (status !== 'done' && daysUntil <= 3 && daysUntil > 0) return { label: `Due ${label}`, style: 'bg-amber-50 text-amber-800' }
  return { label, style: 'bg-slate-100 text-slate-600' }
}

function displayStatus(status) {
  return columns.find(column => column.id === status)?.name || status
}

function niceTime(date) {
  if (!date) return ''
  return new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(piece => piece[0]).join('').toUpperCase()
}

function Avatar({ member, size = 'md' }) {
  return (
    <span
      title={member.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-1 ${memberColors[member.color] || memberColors.emerald} ${size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'}`}
    >
      {initials(member.name)}
    </span>
  )
}

function TaskCard({ task, members, onEdit, disabled = false, overlay = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: disabled || overlay })
  const due = dueInfo(task.due_date, task.status)
  const assignees = members.filter(member => (task.assignee_ids || []).includes(member.id))
  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      {...(!overlay ? attributes : {})}
      {...(!overlay ? listeners : {})}
      style={{ touchAction: 'none' }}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all ${overlay ? 'shadow-2xl ring-2 ring-emerald-400' : 'cursor-grab hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing'} ${isDragging ? 'opacity-30' : ''} ${disabled ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onKeyDown={event => event.stopPropagation()}
          onClick={() => onEdit?.(task)}
          disabled={overlay || disabled}
          className="min-w-0 flex-1 break-words text-left text-sm font-semibold leading-6 text-slate-900 hover:text-emerald-700"
          aria-label={`View or edit ${task.title}`}
        >
          {task.title}
        </button>
        {!overlay && (
          <button type="button" disabled={disabled} title="Open details" aria-label={`Edit ${task.title}`}
            onPointerDown={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
            onClick={() => onEdit(task)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700">
            <Pencil size={15} />
          </button>
        )}
      </div>
      {task.description && <p className="mt-1.5 line-clamp-2 break-words text-xs leading-5 text-slate-500">{task.description}</p>}
      {(task.labels || []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.labels.slice(0, 3).map(label => (
            <span key={label} className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"># {label}</span>
          ))}
          {task.labels.length > 3 && <span className="text-xs text-slate-400">+{task.labels.length - 3}</span>}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize ${badgePriority[task.priority] || badgePriority.normal}`}>
          {task.priority || 'normal'}
        </span>
        {due && <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${due.style}`}><CalendarDays size={12} />{due.label}</span>}
        {assignees.length > 0 && (
          <span className="ml-auto flex -space-x-1.5 pl-1" aria-label={`Assigned to ${assignees.map(member => member.name).join(', ')}`}>
            {assignees.slice(0, 3).map(member => <Avatar key={member.id} member={member} size="sm" />)}
            {assignees.length > 3 && <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">+{assignees.length - 3}</span>}
          </span>
        )}
      </div>
    </article>
  )
}

function BoardColumn({ column, tasks, members, onEdit, saving }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  return (
    <section ref={setNodeRef} className={`min-h-[395px] rounded-2xl border p-3.5 transition-colors sm:p-4 ${isOver ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-200/60 bg-slate-100/80'}`}>
      <div className="mb-4 flex items-center gap-2 px-1">
        <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} />
        <h3 className="text-sm font-bold text-slate-800">{column.name}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{tasks.length}</span>
      </div>
      <div className="space-y-3">
        {tasks.map(task => <TaskCard key={task.id} task={task} members={members} disabled={saving} onEdit={onEdit} />)}
        {tasks.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-slate-200 px-3 py-12 text-center text-xs text-slate-400">Drop tasks here</div>
        )}
      </div>
    </section>
  )
}

function TaskModal({
  form, setForm, editing, saving, onClose, onSubmit, onDelete,
  members, tab, setTab, commentText, setCommentText, comments, activity,
  detailLoading, detailError, commentSaving, onComment,
}) {
  const [newLabel, setNewLabel] = useState('')
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }))
  const addLabel = () => {
    const label = newLabel.trim().replace(/^#/, '').slice(0, 24)
    if (label && !(form.labels || []).some(value => value.toLowerCase() === label.toLowerCase())) {
      update('labels', [...(form.labels || []), label].slice(0, 8))
    }
    setNewLabel('')
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px] sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget && !saving && !commentSaving) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="task-modal-heading" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 id="task-modal-heading" className="text-xl font-bold text-slate-900">{editing ? 'Task details' : 'Create a task'}</h2>
            <p className="mt-1 text-sm text-slate-500">{editing ? 'Edit the task or review its discussion and activity.' : 'Add your next play to the board.'}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving || commentSaving} aria-label="Close task details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
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
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-1.5"><span className="text-sm font-semibold">Title *</span><input autoFocus required maxLength={200} value={form.title} onChange={event => update('title', event.target.value)} className={fieldClass} placeholder="What needs to get done?" /></label>
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div>{editing && <button type="button" disabled={saving} onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={16} />Delete</button>}</div>
              <div className="flex gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving || !form.title.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}{editing ? 'Save task' : 'Create task'}</button></div>
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
    </div>
  )
}

function TeamModal({ members, tasks, name, setName, color, setColor, saving, onSubmit, onDelete, onClose, error }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="team-modal-heading" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between"><div><h2 id="team-modal-heading" className="text-xl font-bold text-slate-900">Your team</h2><p className="mt-1 text-sm text-slate-500">Create teammates and assign them to tasks.</p></div><button type="button" onClick={onClose} aria-label="Close team manager" disabled={saving} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
        {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="block space-y-1"><span className="text-xs font-semibold">Teammate name</span><input required maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Alex Morgan" className={fieldClass} /></label>
          <label className="block space-y-1"><span className="text-xs font-semibold">Avatar color</span><select className={fieldClass} value={color} onChange={event => setColor(event.target.value)}>{Object.keys(memberColors).map(item => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
          <button type="submit" disabled={saving || !name.trim()} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><UserPlus size={17} />Add teammate</button>
        </form>
        <div className="mt-5 space-y-2">
          {members.length ? members.map(member => {
            const used = tasks.some(task => (task.assignee_ids || []).includes(member.id))
            return (
              <div key={member.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"><Avatar member={member} /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{member.name}</span><button type="button" title={used ? 'Unassign this teammate from tasks before deleting' : 'Delete teammate'} disabled={used || saving} onClick={() => onDelete(member)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Delete ${member.name}`}><Trash2 size={16} /></button></div>
            )
          }) : <p className="py-6 text-center text-sm text-slate-400">No teammates added yet.</p>}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [labelFilter, setLabelFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [activeTaskId, setActiveTaskId] = useState(null)

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...blankForm })
  const [tab, setTab] = useState('details')
  const [comments, setComments] = useState([])
  const [activity, setActivity] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [commentText, setCommentText] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)

  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamColor, setTeamColor] = useState('emerald')
  const [teamError, setTeamError] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        let guest = sessionData.session?.user
        if (!guest) {
          const { data, error: authError } = await supabase.auth.signInAnonymously()
          if (authError) throw authError
          guest = data.user
        }
        if (!guest) throw new Error('Could not create a guest session.')
        const [taskResult, memberResult] = await Promise.all([
          supabase.from('tasks').select('*').eq('user_id', guest.id).order('created_at', { ascending: true }),
          supabase.from('team_members').select('*').eq('user_id', guest.id).order('created_at', { ascending: true }),
        ])
        if (taskResult.error) throw taskResult.error
        if (memberResult.error) throw new Error(`${memberResult.error.message}. Did you run taskflow_features.sql in Supabase?`)
        if (!cancelled) {
          setUser(guest)
          setTasks(taskResult.data ?? [])
          setMembers(memberResult.data ?? [])
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load workspace.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    initialize()
    return () => { cancelled = true }
  }, [])

  // Activity is deliberately recorded as separate rows, not just UI state.
  const recordActivity = useCallback(async (taskId, action, details) => {
    if (!user) return null
    const result = await supabase.from('task_activity')
      .insert({ task_id: taskId, user_id: user.id, action, details })
      .select('*').single()
    if (result.error) {
      setError(`Task saved, but activity logging failed: ${result.error.message}`)
      return null
    }
    return result.data
  }, [user])

  const loadTaskExtras = useCallback(async (taskId) => {
    if (!user) return
    setDetailLoading(true)
    setDetailError('')
    const [commentResult, activityResult] = await Promise.all([
      supabase.from('task_comments').select('*').eq('user_id', user.id).eq('task_id', taskId).order('created_at', { ascending: true }),
      supabase.from('task_activity').select('*').eq('user_id', user.id).eq('task_id', taskId).order('created_at', { ascending: false }),
    ])
    if (commentResult.error || activityResult.error) {
      setDetailError(commentResult.error?.message || activityResult.error?.message)
    } else {
      setComments(commentResult.data ?? [])
      setActivity(activityResult.data ?? [])
    }
    setDetailLoading(false)
  }, [user])

  function openCreate() {
    setEditingId(null)
    setForm({ ...blankForm, labels: [], assignee_ids: [] })
    setTab('details')
    setError('')
    setTaskModalOpen(true)
  }

  function openEdit(task) {
    setEditingId(task.id)
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority || 'normal',
      due_date: task.due_date || '',
      labels: [...(task.labels || [])],
      assignee_ids: [...(task.assignee_ids || [])],
    })
    setTab('details')
    setComments([])
    setActivity([])
    setCommentText('')
    setDetailError('')
    setError('')
    setTaskModalOpen(true)
    loadTaskExtras(task.id)
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!user || saving || !form.title.trim()) return
    setSaving(true)
    setError('')
    const values = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      due_date: form.due_date || null,
      status: form.status,
      labels: form.labels || [],
      assignee_ids: form.assignee_ids || [],
    }
    try {
      if (editingId) {
        const old = tasks.find(task => task.id === editingId)
        const { data, error: updateError } = await supabase.from('tasks')
          .update(values).eq('id', editingId).eq('user_id', user.id).select('*').single()
        if (updateError) throw updateError
        setTasks(previous => previous.map(task => task.id === editingId ? data : task))
        setTaskModalOpen(false)
        if (old?.status !== values.status) {
          await recordActivity(data.id, 'moved', `Moved from ${displayStatus(old.status)} to ${displayStatus(values.status)}`)
        }
        const edited = ['title', 'description', 'priority', 'due_date', 'labels', 'assignee_ids']
          .filter(key => JSON.stringify(old?.[key] ?? null) !== JSON.stringify(values[key] ?? null))
        if (edited.length) await recordActivity(data.id, 'updated', `Updated ${edited.map(key => key.replaceAll('_', ' ')).join(', ')}`)
      } else {
        const { data, error: insertError } = await supabase.from('tasks')
          .insert({ ...values, user_id: user.id }).select('*').single()
        if (insertError) throw insertError
        setTasks(previous => [...previous, data])
        setTaskModalOpen(false)
        await recordActivity(data.id, 'created', 'Created task')
      }
    } catch (err) {
      setError(`Could not save task: ${err.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editingId || !user || saving) return
    if (!window.confirm('Delete this task permanently, including its comments and activity?')) return
    setSaving(true)
    setError('')
    try {
      const { data, error: deleteError } = await supabase.from('tasks')
        .delete().eq('id', editingId).eq('user_id', user.id).select('id').single()
      if (deleteError) throw deleteError
      if (!data) throw new Error('Task not deleted.')
      setTasks(previous => previous.filter(task => task.id !== editingId))
      setTaskModalOpen(false)
    } catch (err) {
      setError(`Could not delete task: ${err.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDragEnd({ active, over }) {
    setActiveTaskId(null)
    if (!over || saving || !user) return
    const task = tasks.find(item => item.id === active.id)
    const newStatus = over.id
    if (!task || task.status === newStatus || !columns.some(column => column.id === newStatus)) return
    setSaving(true)
    setError('')
    setTasks(previous => previous.map(item => item.id === task.id ? { ...item, status: newStatus } : item))
    try {
      const { data, error: updateError } = await supabase.from('tasks')
        .update({ status: newStatus }).eq('id', task.id).eq('user_id', user.id).select('id').single()
      if (updateError) throw updateError
      if (!data) throw new Error('Status not saved.')
      await recordActivity(task.id, 'moved', `Moved from ${displayStatus(task.status)} to ${displayStatus(newStatus)}`)
    } catch (err) {
      setTasks(previous => previous.map(item => item.id === task.id ? { ...item, status: task.status } : item))
      setError(`Could not move task: ${err.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleComment(event) {
    event.preventDefault()
    const body = commentText.trim()
    if (!body || !editingId || !user || commentSaving) return
    setCommentSaving(true)
    setDetailError('')
    try {
      const { data, error: commentError } = await supabase.from('task_comments')
        .insert({ task_id: editingId, user_id: user.id, body }).select('*').single()
      if (commentError) throw commentError
      setComments(previous => [...previous, data])
      setCommentText('')
      const entry = await recordActivity(editingId, 'commented', 'Added a comment')
      if (entry) setActivity(previous => [entry, ...previous])
    } catch (err) {
      setDetailError(`Could not post comment: ${err.message || 'Unknown error'}`)
    } finally {
      setCommentSaving(false)
    }
  }

  async function addTeamMember(event) {
    event.preventDefault()
    if (!user || saving || !teamName.trim()) return
    setSaving(true)
    setTeamError('')
    try {
      const { data, error: insertError } = await supabase.from('team_members')
        .insert({ user_id: user.id, name: teamName.trim(), color: teamColor })
        .select('*').single()
      if (insertError) throw insertError
      setMembers(previous => [...previous, data])
      setTeamName('')
    } catch (err) {
      setTeamError(err.message || 'Could not create teammate.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTeamMember(member) {
    if (!user || saving) return
    if (tasks.some(task => (task.assignee_ids || []).includes(member.id))) {
      setTeamError('Unassign this teammate from tasks before removing them.')
      return
    }
    if (!window.confirm(`Remove ${member.name} from your team?`)) return
    setSaving(true)
    setTeamError('')
    try {
      const { error: deleteError } = await supabase.from('team_members')
        .delete().eq('id', member.id).eq('user_id', user.id)
      if (deleteError) throw deleteError
      setMembers(previous => previous.filter(item => item.id !== member.id))
    } catch (err) {
      setTeamError(err.message || 'Could not delete teammate.')
    } finally {
      setSaving(false)
    }
  }

  const allLabels = [...new Set(tasks.flatMap(task => task.labels || []))].sort((a, b) => a.localeCompare(b))
  const filteredTasks = tasks.filter(task => {
    const searchable = `${task.title} ${task.description || ''}`.toLowerCase()
    return searchable.includes(search.toLowerCase())
      && (!priorityFilter || task.priority === priorityFilter)
      && (!labelFilter || (task.labels || []).includes(labelFilter))
      && (!assigneeFilter || (task.assignee_ids || []).includes(assigneeFilter))
  })
  const overdue = tasks.filter(task => task.status !== 'done' && task.due_date && task.due_date < todayLocalISO()).length
  const completed = tasks.filter(task => task.status === 'done').length
  const activeTask = tasks.find(task => task.id === activeTaskId)
  const filtersActive = Boolean(search || priorityFilter || labelFilter || assigneeFilter)

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 text-slate-500"><LoaderCircle size={22} className="animate-spin text-emerald-600" />Loading your workspace…</div>
  )
  if (!user) return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center text-rose-700"><AlertCircle size={28} /><p>{error || 'Unable to start a guest session.'}</p><p className="max-w-md text-xs text-slate-500">If you see a missing team_members table error, run the SQL upgrade included with the ZIP.</p></div>
  )

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-slate-900">
      <header className="border-b border-slate-800 bg-[#0e2130] text-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500 p-2.5 shadow-lg shadow-emerald-950/20"><LayoutDashboard size={20} className="text-white" /></div>
            <div><h1 className="text-lg font-extrabold tracking-tight sm:text-xl">TaskFlow</h1><p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">Your team playbook</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200 sm:block">Matchday workspace</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-200 text-sm font-extrabold text-emerald-900">G</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pb-12 pt-8 sm:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.19em] text-emerald-700">Workspace / Board</p><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">The game plan.</h2><p className="mt-2 text-sm text-slate-500 sm:text-base">Move work forward, one play at a time.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setTeamError(''); setTeamModalOpen(true) }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><UsersRound size={17} /> Team <span className="rounded-full bg-slate-100 px-1.5 text-xs">{members.length}</span></button>
            <button type="button" onClick={openCreate} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/15 hover:bg-emerald-700 disabled:opacity-50"><Plus size={18} /> New Task</button>
          </div>
        </div>

        {error && <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle size={18} className="shrink-0" /><span className="min-w-0 flex-1">{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error" className="shrink-0 rounded p-0.5 hover:bg-rose-100"><X size={16} /></button></div>}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { title: 'Total Tasks', number: tasks.length, icon: ListTodo, color: 'text-emerald-700 bg-emerald-50' },
            { title: 'In Progress', number: tasks.filter(task => task.status === 'in_progress').length, icon: Clock3, color: 'text-sky-700 bg-sky-50' },
            { title: 'Completed', number: completed, icon: CircleCheck, color: 'text-emerald-700 bg-emerald-50' },
            { title: 'Overdue', number: overdue, icon: AlertCircle, color: 'text-rose-700 bg-rose-50' },
          ].map(item => {
            const Icon = item.icon
            return <div key={item.title} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><div><p className="text-xs font-semibold text-slate-500">{item.title}</p><p className="mt-1 text-3xl font-extrabold tracking-tight">{item.number}</p></div><div className={`rounded-xl p-3 ${item.color}`}><Icon size={22} /></div></div>
          })}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="relative min-w-[180px] flex-1 sm:max-w-sm"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks and descriptions..." aria-label="Search tasks" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></div>
          <Filter size={16} className="hidden text-slate-400 sm:block" />
          <select aria-label="Filter by priority" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"><option value="">All priorities</option>{priorityOptions.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>
          <select aria-label="Filter by label" value={labelFilter} onChange={event => setLabelFilter(event.target.value)} className="max-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"><option value="">All labels</option>{allLabels.map(label => <option key={label} value={label}>{label}</option>)}</select>
          <select aria-label="Filter by teammate" value={assigneeFilter} onChange={event => setAssigneeFilter(event.target.value)} className="max-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"><option value="">All teammates</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
          {filtersActive && <button type="button" onClick={() => { setSearch(''); setPriorityFilter(''); setLabelFilter(''); setAssigneeFilter('') }} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><X size={14} /> Clear</button>}
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h3 className="text-base font-bold text-slate-800">Board view</h3><span className="text-xs text-slate-400">Drag any card between columns</span></div>{filtersActive && <span className="text-xs text-slate-500">Showing {filteredTasks.length} of {tasks.length} tasks</span>}</div>
        <DndContext sensors={sensors} onDragStart={({ active }) => setActiveTaskId(active.id)} onDragCancel={() => setActiveTaskId(null)} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map(column => <BoardColumn key={column.id} column={column} tasks={filteredTasks.filter(task => task.status === column.id)} members={members} onEdit={openEdit} saving={saving} />)}
          </div>
          <DragOverlay>{activeTask ? <TaskCard task={activeTask} members={members} overlay /> : null}</DragOverlay>
        </DndContext>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-400"><CheckCircle2 size={15} className="text-emerald-500" /> Tasks sync to your private Supabase guest workspace <ArrowRight size={13} /> Finish the play, then mark it Done.</div>
      </main>

      {taskModalOpen && <TaskModal key={editingId || 'create'} form={form} setForm={setForm} editing={Boolean(editingId)} saving={saving} onClose={() => setTaskModalOpen(false)} onSubmit={handleSave} onDelete={handleDelete} members={members} tab={tab} setTab={setTab} commentText={commentText} setCommentText={setCommentText} comments={comments} activity={activity} detailLoading={detailLoading} detailError={detailError} commentSaving={commentSaving} onComment={handleComment} />}
      {teamModalOpen && <TeamModal members={members} tasks={tasks} name={teamName} setName={setTeamName} color={teamColor} setColor={setTeamColor} saving={saving} onSubmit={addTeamMember} onDelete={deleteTeamMember} onClose={() => setTeamModalOpen(false)} error={teamError} />}
    </div>
  )
}
