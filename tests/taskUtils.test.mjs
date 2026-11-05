import test from 'node:test'
import assert from 'node:assert/strict'
import { columns, dueInfo, filterTasks, initials, todayLocalISO } from '../src/taskUtils.js'

test('board has the four required status values', () => {
  assert.deepEqual(columns.map(column => column.id), [
    'todo', 'in_progress', 'in_review', 'done',
  ])
})

test('dates are formatted using local calendar day', () => {
  assert.equal(todayLocalISO(new Date(2026, 10, 4, 9, 15)), '2026-11-04')
})

test('due dates distinguish overdue, today, and completed tasks', () => {
  assert.equal(dueInfo('2026-11-03', 'todo', '2026-11-04').label, 'Overdue')
  assert.equal(dueInfo('2026-11-04', 'in_progress', '2026-11-04').label, 'Due today')
  assert.notEqual(dueInfo('2026-11-03', 'done', '2026-11-04').label, 'Overdue')
  assert.equal(dueInfo(null, 'todo', '2026-11-04'), null)
})

test('filterTasks matches title, description, priority, labels, and members', () => {
  const tasks = [
    { id: '1', title: 'Review landing page', description: 'Fix layout', priority: 'high', labels: ['Design'], assignee_ids: ['a'] },
    { id: '2', title: 'Write docs', description: 'API reference', priority: 'normal', labels: ['Docs'], assignee_ids: [] },
  ]
  assert.equal(filterTasks(tasks, { search: 'LAYOUT' }).length, 1)
  assert.equal(filterTasks(tasks, { priority: 'high', label: 'Design', assignee: 'a' })[0].id, '1')
  assert.equal(filterTasks(tasks, { priority: 'low' }).length, 0)
  assert.equal(filterTasks(tasks).length, 2)
})

test('initials use up to two names', () => {
  assert.equal(initials('Alex Morgan'), 'AM')
  assert.equal(initials('  Kim  '), 'K')
})
