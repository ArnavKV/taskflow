import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import TaskCard from './TaskCard'

export default function BoardColumn({ column, tasks, members, onEdit, onAdd, saving }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.name} column`}
      className={`relative flex min-h-[340px] flex-col overflow-hidden rounded-2xl border transition-colors ${
        isOver ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-200 bg-[#f0f4f6]'
      }`}
    >
      <div className={`h-1 w-full ${column.accent}`} />
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
        <h3 className="text-sm font-bold text-slate-800">{column.name}</h3>
        <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
          {tasks.length}
        </span>
        <button
          type="button"
          onClick={() => onAdd(column.id)}
          disabled={saving}
          aria-label={`Add task to ${column.name}`}
          title={`Add task to ${column.name}`}
          className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-40"
        >
          <Plus size={17} />
        </button>
      </div>

      <div className="flex-1 space-y-3 px-3 pb-3">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} members={members} disabled={saving} onEdit={onEdit} />
        ))}
        {tasks.length === 0 && (
          <div className={`rounded-xl border border-dashed px-4 py-10 text-center text-xs ${
            isOver ? 'border-emerald-300 bg-white/60 text-emerald-700' : 'border-slate-300 bg-white/40 text-slate-400'
          }`}>
            {isOver ? 'Release to move task' : 'No tasks in this column'}
          </div>
        )}
      </div>
    </section>
  )
}
