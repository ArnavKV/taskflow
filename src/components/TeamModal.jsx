import { useEffect, useState } from 'react'
import { Trash2, UserPlus, X } from 'lucide-react'
import { memberColors, fieldClass } from '../taskUtils'
import { Avatar } from './TaskCard'
import ConfirmDialog from './ConfirmDialog'

export default function TeamModal({ members, tasks, name, setName, color, setColor, saving, onSubmit, onDelete, onClose, error }) {
  const [memberToDelete, setMemberToDelete] = useState(null)
  useEffect(() => {
    function onEscape(event) {
      if (event.key === 'Escape' && !saving && !memberToDelete) onClose()
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [saving, memberToDelete, onClose])

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
              <div key={member.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"><Avatar member={member} /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{member.name}</span><button type="button" title={used ? 'Unassign this teammate from tasks before deleting' : 'Delete teammate'} disabled={used || saving} onClick={() => setMemberToDelete(member)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Delete ${member.name}`}><Trash2 size={16} /></button></div>
            )
          }) : <p className="py-6 text-center text-sm text-slate-400">No teammates added yet.</p>}
        </div>
      </div>
      {memberToDelete && (
        <ConfirmDialog
          title="Remove teammate?"
          description={<>Remove <strong>{memberToDelete.name}</strong> from your team? You can add them again later.</>}
          confirmLabel="Remove teammate"
          onCancel={() => setMemberToDelete(null)}
          onConfirm={() => onDelete(memberToDelete)}
        />
      )}
    </div>
  )
}
