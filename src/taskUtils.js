export const columns = [
  { id: 'todo', name: 'To Do', accent: 'bg-slate-400', soft: 'bg-slate-100' },
  { id: 'in_progress', name: 'In Progress', accent: 'bg-sky-500', soft: 'bg-sky-50' },
  { id: 'in_review', name: 'In Review', accent: 'bg-amber-500', soft: 'bg-amber-50' },
  { id: 'done', name: 'Done', accent: 'bg-emerald-500', soft: 'bg-emerald-50' },
]

export const priorityOptions = ['low', 'normal', 'high']

export const memberColors = {
  emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  blue: 'bg-blue-100 text-blue-800 ring-blue-200',
  purple: 'bg-violet-100 text-violet-800 ring-violet-200',
  amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  rose: 'bg-rose-100 text-rose-800 ring-rose-200',
}

export const badgePriority = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-sky-50 text-sky-700',
  high: 'bg-rose-50 text-rose-700',
}

export const blankForm = {
  title: '',
  description: '',
  priority: 'normal',
  due_date: '',
  status: 'todo',
  labels: [],
  assignee_ids: [],
}

export const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base sm:text-sm text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'

export function todayLocalISO(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dueInfo(date, status, today = todayLocalISO()) {
  if (!date) return null
  if (status !== 'done' && date < today) {
    return { label: 'Overdue', style: 'bg-rose-50 text-rose-700' }
  }
  if (status !== 'done' && date === today) {
    return { label: 'Due today', style: 'bg-amber-50 text-amber-800' }
  }
  const label = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  })
  const daysUntil = Math.round(
    (new Date(`${date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000,
  )
  if (status !== 'done' && daysUntil > 0 && daysUntil <= 3) {
    return { label: `Due ${label}`, style: 'bg-amber-50 text-amber-800' }
  }
  return { label, style: 'bg-slate-100 text-slate-600' }
}

export function displayStatus(status) {
  return columns.find(column => column.id === status)?.name || status
}

export function niceTime(date) {
  if (!date) return ''
  return new Date(date).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2)
    .map(piece => piece[0]).join('').toUpperCase()
}

export function filterTasks(tasks, { search = '', priority = '', label = '', assignee = '' } = {}) {
  const query = search.toLowerCase().trim()
  return tasks.filter(task => {
    const searchable = `${task.title} ${task.description || ''}`.toLowerCase()
    return searchable.includes(query)
      && (!priority || task.priority === priority)
      && (!label || (task.labels || []).includes(label))
      && (!assignee || (task.assignee_ids || []).includes(assignee))
  })
}
