import { useDraggable } from '@dnd-kit/core'
import { CalendarDays, Pencil } from 'lucide-react'
import { badgePriority, dueInfo, initials, memberColors } from '../taskUtils'

export function Avatar({ member, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'
  return (
    <span
      title={member.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-1 ${sizeClass} ${memberColors[member.color] || memberColors.emerald}`}
    >
      {initials(member.name)}
    </span>
  )
}

export default function TaskCard({ task, members, onEdit, disabled = false, overlay = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: disabled || overlay,
  })
  const due = dueInfo(task.due_date, task.status)
  const assignees = members.filter(member => (task.assignee_ids || []).includes(member.id))
  const priority = task.priority || 'normal'

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      {...(!overlay ? attributes : {})}
      {...(!overlay ? listeners : {})}
      style={{ touchAction: 'pan-y' }}
      className={`group relative rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_7px_rgba(15,35,50,0.05)] transition-[box-shadow,transform,opacity] duration-150 ${
        overlay ? 'shadow-2xl ring-2 ring-emerald-400' : 'cursor-grab hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,35,50,0.10)] active:cursor-grabbing'
      } ${isDragging ? 'opacity-30' : ''} ${disabled ? 'opacity-60' : ''}`}
    >
      <div className="mb-3 flex items-start gap-2">
        <button
          type="button"
          onKeyDown={event => event.stopPropagation()}
          onClick={() => onEdit?.(task)}
          disabled={overlay || disabled}
          className="min-w-0 flex-1 break-words text-left text-sm font-semibold leading-6 text-slate-900 hover:text-emerald-800 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-emerald-600"
          aria-label={`View or edit ${task.title}`}
        >
          {task.title}
        </button>
        {!overlay && (
          <button
            type="button"
            title="Open task details"
            aria-label={`Edit ${task.title}`}
            onPointerDown={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
            onClick={() => onEdit(task)}
            disabled={disabled}
            className="rounded-md p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            <Pencil size={15} />
          </button>
        )}
      </div>

      {task.description && (
        <p className="mb-3 line-clamp-2 break-words text-xs leading-5 text-slate-500">
          {task.description}
        </p>
      )}

      {(task.labels || []).length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {task.labels.slice(0, 3).map(label => (
            <span key={label} className="rounded-md border border-emerald-100 bg-emerald-50/80 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              {label}
            </span>
          ))}
          {task.labels.length > 3 && <span className="text-xs text-slate-400">+{task.labels.length - 3}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className={`rounded-md px-2 py-1 text-[11px] font-semibold capitalize ${badgePriority[priority] || badgePriority.normal}`}>
          {priority}
        </span>
        {due && (
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${due.style}`}>
            <CalendarDays size={12} /> {due.label}
          </span>
        )}
        {assignees.length > 0 && (
          <span className="ml-auto flex -space-x-1.5 pl-1" aria-label={`Assigned to ${assignees.map(member => member.name).join(', ')}`}>
            {assignees.slice(0, 3).map(member => <Avatar key={member.id} member={member} size="sm" />)}
            {assignees.length > 3 && (
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                +{assignees.length - 3}
              </span>
            )}
          </span>
        )}
      </div>
    </article>
  )
}
