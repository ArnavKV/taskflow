import { useCallback, useEffect, useState } from 'react'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  AlertCircle, CheckCircle2, CircleCheck, Clock3, Filter,
  LayoutDashboard, ListTodo, LoaderCircle, Plus, Search,
  TrendingUp, UserPlus, X,
} from 'lucide-react'
import { supabase } from './supabase'
import {
  blankForm, columns, displayStatus, filterTasks, priorityOptions, todayLocalISO,
} from './taskUtils'
import TaskCard from './components/TaskCard'
import BoardColumn from './components/BoardColumn'
import TaskModal from './components/TaskModal'
import TeamModal from './components/TeamModal'

function formToTaskValues(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    priority: form.priority,
    due_date: form.due_date || null,
    status: form.status,
    labels: form.labels || [],
    assignee_ids: form.assignee_ids || [],
  }
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
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 10 } }),
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

  function openCreate(status = 'todo') {
    setEditingId(null)
    setForm({ ...blankForm, status, labels: [], assignee_ids: [] })
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

  // Creating a task is explicit. Existing tasks are saved automatically in TaskModal.
  async function handleSave(event) {
    event.preventDefault()
    if (!user || saving || !form.title.trim()) return
    setSaving(true)
    setError('')
    try {
      const { data, error: insertError } = await supabase.from('tasks')
        .insert({ ...formToTaskValues(form), user_id: user.id }).select('*').single()
      if (insertError) throw insertError
      setTasks(previous => [...previous, data])
      setTaskModalOpen(false)
      await recordActivity(data.id, 'created', 'Created task')
    } catch (err) {
      setError(`Could not create task: ${err.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  // The task editor sends snapshots sequentially; never let an older save overwrite a newer edit.
  async function handleAutoSaveEdit(editedForm) {
    if (!user || !editingId) throw new Error('No task is selected for editing.')
    const original = tasks.find(task => task.id === editingId)
    if (!original) throw new Error('This task no longer exists.')
    const values = formToTaskValues(editedForm)
    if (!values.title) throw new Error('A task title is required.')

    setSaving(true)
    setError('')
    try {
      const { data, error: updateError } = await supabase.from('tasks')
        .update(values).eq('id', editingId).eq('user_id', user.id).select('*').single()
      if (updateError) throw updateError
      setTasks(previous => previous.map(task => task.id === editingId ? data : task))

      if (original.status !== values.status) {
        const entry = await recordActivity(data.id, 'moved', `Moved from ${displayStatus(original.status)} to ${displayStatus(values.status)}`)
        if (entry) setActivity(previous => [entry, ...previous])
      }
      const changedFields = ['title', 'description', 'priority', 'due_date', 'labels', 'assignee_ids']
        .filter(field => JSON.stringify(original[field] ?? null) !== JSON.stringify(values[field] ?? null))
      if (changedFields.length) {
        const entry = await recordActivity(data.id, 'updated', `Updated ${changedFields.map(field => field.replaceAll('_', ' ')).join(', ')}`)
        if (entry) setActivity(previous => [entry, ...previous])
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editingId || !user || saving) throw new Error('Please wait for the current save to finish.')
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
      throw err
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
    if (!user || saving) throw new Error('Please wait for the current save to finish.')
    if (tasks.some(task => (task.assignee_ids || []).includes(member.id))) {
      throw new Error('Unassign this teammate from tasks before removing them.')
    }
    setSaving(true)
    setTeamError('')
    try {
      const { error: deleteError } = await supabase.from('team_members')
        .delete().eq('id', member.id).eq('user_id', user.id)
      if (deleteError) throw deleteError
      setMembers(previous => previous.filter(item => item.id !== member.id))
    } catch (err) {
      setTeamError(err.message || 'Could not delete teammate.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const allLabels = [...new Set(tasks.flatMap(task => task.labels || []))].sort((a, b) => a.localeCompare(b))
  const filteredTasks = filterTasks(tasks, {
    search, priority: priorityFilter, label: labelFilter, assignee: assigneeFilter,
  })
  const overdue = tasks.filter(task => task.status !== 'done' && task.due_date && task.due_date < todayLocalISO()).length
  const completed = tasks.filter(task => task.status === 'done').length
  const completionRate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
  const activeTask = tasks.find(task => task.id === activeTaskId)
  const filtersActive = Boolean(search || priorityFilter || labelFilter || assigneeFilter)

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 text-slate-500"><LoaderCircle size={22} className="animate-spin text-emerald-600" />Loading your workspace…</div>
  )
  if (!user) return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center text-rose-700"><AlertCircle size={28} /><p>{error || 'Unable to start a guest session.'}</p><p className="max-w-md text-xs text-slate-500">If you see a missing team_members table error, run the SQL upgrade included with the ZIP.</p></div>
  )

  return (
    <div className="min-h-screen bg-[#f7f9fa] text-slate-900">
      <header className="border-b border-[#183847] bg-[#102b39] text-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-950/20">
              <LayoutDashboard size={21} />
            </span>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight sm:text-xl">TaskFlow</h1>

            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="hidden sm:inline">Guest session</span>
            <span aria-label="Guest profile" title="Guest session" className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-200 text-sm font-bold text-emerald-950">G</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pb-14 pt-8 sm:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Project workspace
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Task board</h2>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">Keep working without breaking your flow state.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setTeamError(''); setTeamModalOpen(true) }}
              aria-label={`Add or manage teammates (${members.length} added)`}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-3 text-sm font-semibold text-emerald-800 shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 sm:px-4">
              <UserPlus size={18} aria-hidden="true" /> Add teammates
              <span aria-hidden="true" className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs tabular-nums text-emerald-800">{members.length}</span>
            </button>
            <button type="button" onClick={() => openCreate()} disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-800 disabled:opacity-50">
              <Plus size={18} /> New task
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle size={18} className="shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="Dismiss error" className="rounded p-0.5 hover:bg-rose-100"><X size={16} /></button>
          </div>
        )}

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { title: 'Total tasks', number: tasks.length, icon: ListTodo, accent: 'bg-slate-600', color: 'bg-slate-100 text-slate-700' },
            { title: 'In progress', number: tasks.filter(task => task.status === 'in_progress').length, icon: Clock3, accent: 'bg-sky-500', color: 'bg-sky-50 text-sky-700' },
            { title: 'Completed', number: completed, icon: CircleCheck, accent: 'bg-emerald-500', color: 'bg-emerald-50 text-emerald-700' },
            { title: 'Overdue', number: overdue, icon: AlertCircle, accent: 'bg-rose-500', color: 'bg-rose-50 text-rose-700' },
          ].map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.title} className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_2px_10px_rgba(15,35,50,0.035)]">
                <span className={`absolute left-0 top-0 h-full w-1 ${stat.accent}`} />
                <div>
                  <p className="text-xs font-semibold text-slate-500">{stat.title}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-slate-900">{stat.number}</p>
                </div>
                <span className={`rounded-xl p-3 ${stat.color}`}><Icon size={22} /></span>
              </div>
            )
          })}
        </div>

        <div className="mb-7 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_2px_10px_rgba(15,35,50,0.03)]">
          <div className="flex min-w-[140px] items-center gap-3">
            <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><TrendingUp size={17} /></span>
            <div><p className="text-xs font-semibold text-slate-500">Completion</p><p className="text-lg font-bold tabular-nums">{completionRate}%</p></div>
          </div>
          <div className="min-w-[180px] flex-1">
            <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={completionRate} aria-label="Task completion" className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
          <p className="text-xs text-slate-500">{completed} of {tasks.length} tasks done</p>
        </div>

        {tasks.length === 0 && (
          <section className="mb-7 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-emerald-100 bg-gradient-to-r from-[#e9f7f1] via-white to-white px-6 py-6">
            <div className="max-w-xl">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">Getting started</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">Your board is ready.</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Create a task to see it in the To Do column. You can edit its details, assign teammates, and move it as work progresses.</p>
            </div>
            <button type="button" onClick={() => openCreate()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
              <Plus size={16} /> Create first task
            </button>
          </section>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_2px_10px_rgba(15,35,50,0.03)]">
          <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
            <Search size={17} className="absolute left-3 top-3 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </div>
          <Filter size={16} className="hidden text-slate-400 sm:block" />
          <select aria-label="Filter by priority" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
            <option value="">All priorities</option>
            {priorityOptions.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
          </select>
          <select aria-label="Filter by label" value={labelFilter} onChange={event => setLabelFilter(event.target.value)} className="max-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
            <option value="">All labels</option>
            {allLabels.map(label => <option key={label} value={label}>{label}</option>)}
          </select>
          <select aria-label="Filter by teammate" value={assigneeFilter} onChange={event => setAssigneeFilter(event.target.value)} className="max-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
            <option value="">All teammates</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          {filtersActive && (
            <button type="button" onClick={() => { setSearch(''); setPriorityFilter(''); setLabelFilter(''); setAssigneeFilter('') }}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
              <X size={14} /> Clear
            </button>
          )}
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800">Board view</h3>
            <span className="hidden text-xs text-slate-400 sm:inline">Drag a card to update its status</span>
          </div>
          {filtersActive && <span className="text-xs text-slate-500">Showing {filteredTasks.length} of {tasks.length}</span>}
        </div>

        <DndContext sensors={sensors} onDragStart={({ active }) => setActiveTaskId(active.id)} onDragCancel={() => setActiveTaskId(null)} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map(column => (
              <BoardColumn
                key={column.id}
                column={column}
                tasks={filteredTasks.filter(task => task.status === column.id)}
                members={members}
                onEdit={openEdit}
                onAdd={openCreate}
                saving={saving}
              />
            ))}
          </div>
          <DragOverlay>{activeTask ? <TaskCard task={activeTask} members={members} overlay /> : null}</DragOverlay>
        </DndContext>

        <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <CheckCircle2 size={14} className="text-emerald-600" /> Changes are saved to your guest workspace.
        </p>
      </main>

      {taskModalOpen && (
        <TaskModal
          key={editingId || 'create'}
          form={form} setForm={setForm} editing={Boolean(editingId)} saving={saving}
          onClose={() => setTaskModalOpen(false)} onSubmit={handleSave} onAutoSave={handleAutoSaveEdit} onDelete={handleDelete}
          members={members} tab={tab} setTab={setTab} commentText={commentText}
          setCommentText={setCommentText} comments={comments} activity={activity}
          detailLoading={detailLoading} detailError={detailError} commentSaving={commentSaving}
          onComment={handleComment} createError={error}
        />
      )}
      {teamModalOpen && (
        <TeamModal
          members={members} tasks={tasks} name={teamName} setName={setTeamName}
          color={teamColor} setColor={setTeamColor} saving={saving}
          onSubmit={addTeamMember} onDelete={deleteTeamMember}
          onClose={() => setTeamModalOpen(false)} error={teamError}
        />
      )}
    </div>
  )
}
