// Neon Study Planner JS (Full CRUD: add, edit, remove, bulk-remove for Tasks & Goals)
// Storage keys
const LS_TASKS = 'neon_tasks_v1';
const LS_GOALS = 'neon_goals_v1';
const LS_SELECTED = 'neon_selected_date';

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// State
let current = new Date();
let selectedKey = localStorage.getItem(LS_SELECTED) || keyFromDate(new Date());
let tasks = load(LS_TASKS, {});     // { 'YYYY-M-D': [ { id, text, note, done } ] }
let goals = load(LS_GOALS, []);     // [ { id, text, note, tags:[] } ]
let editing = { dateKey: null, id: null };

// Elements
const monthTitle = document.getElementById('monthTitle');
const daysEl = document.getElementById('days');
const drawerTitle = document.getElementById('drawerTitle');
const taskList = document.getElementById('taskList');
const statTasks = document.getElementById('statTasks');
const statDone = document.getElementById('statDone');
const statGoals = document.getElementById('statGoals');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const todayBtn = document.getElementById('todayBtn');
const searchInput = document.getElementById('searchInput');

const addTaskForSelectedBtn = document.getElementById('addTaskForSelectedBtn');
const clearDayBtn = document.getElementById('clearDayBtn');
const clearAllTasksBtn = document.getElementById('clearAllTasksBtn');

const quickText = document.getElementById('quickText');
const quickNote = document.getElementById('quickNote');
const quickAddBtn = document.getElementById('quickAddBtn');

const goalText = document.getElementById('goalText');
const goalNote = document.getElementById('goalNote');
const goalTags = document.getElementById('goalTags');
const addGoalBtn = document.getElementById('addGoalBtn');
const clearGoalsBtn = document.getElementById('clearGoalsBtn');
const goalsEl = document.getElementById('goals');
const activeFilters = document.getElementById('activeFilters');

const taskModal = document.getElementById('taskModal');
const taskModalTitle = document.getElementById('taskModalTitle');
const taskText = document.getElementById('taskText');
const taskNote = document.getElementById('taskNote');
const saveTaskBtn = document.getElementById('saveTaskBtn');
const deleteTaskBtn = document.getElementById('deleteTaskBtn');
const toast = document.getElementById('toast');

// Utils
function keyFromDate(d) { return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function labelFromKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function uid() { return Math.random().toString(36).slice(2, 10); }

function showToast(msg) {
  toast.textContent = msg; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1400);
}

// Calendar render
function renderCalendar() {
  const y = current.getFullYear();
  const m = current.getMonth();
  monthTitle.textContent = new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  daysEl.innerHTML = '';
  const firstDow = new Date(y, m, 1).getDay();
  const nDays = new Date(y, m+1, 0).getDate();

  for (let i = 0; i < firstDow; i++) {
    const pad = document.createElement('div');
    daysEl.appendChild(pad);
  }

  for (let d = 1; d <= nDays; d++) {
    const key = `${y}-${m+1}-${d}`;
    const day = document.createElement('button');
    day.className = 'day';
    day.setAttribute('aria-label', `Open tasks for ${key}`);

    const head = document.createElement('div');
    head.className = 'date-badge';
    head.textContent = d;
    day.appendChild(head);

    if (key === keyFromDate(new Date())) day.classList.add('today');
    if (key === selectedKey) day.style.outline = '2px solid rgba(0,229,255,.45)';

    const inds = document.createElement('div');
    inds.className = 'indicators';
    const list = tasks[key] || [];
    if (list.length) {
      const doneCount = list.filter(t => t.done).length;
      const c1 = document.createElement('span'); c1.className = 'pill c1';
      const c2 = document.createElement('span'); c2.className = 'pill c2';
      inds.appendChild(c1);
      if (doneCount) {
        const c3 = document.createElement('span'); c3.className = 'pill c3';
        inds.appendChild(c3);
      } else {
        inds.appendChild(c2);
      }
      day.appendChild(inds);
    }

    day.addEventListener('click', () => selectDate(key));
    day.addEventListener('dblclick', () => openModal(key));
    daysEl.appendChild(day);
  }

  updateStats();
}

function selectDate(key) {
  selectedKey = key; localStorage.setItem(LS_SELECTED, key);
  drawerTitle.textContent = labelFromKey(key);
  renderTasks();
}

// Tasks
function renderTasks() {
  const list = (tasks[selectedKey] || []).slice();
  const term = searchInput.value.trim().toLowerCase();
  const filtered = term ? list.filter(t => t.text.toLowerCase().includes(term) || t.note.toLowerCase().includes(term)) : list;

  taskList.innerHTML = '';
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'sub';
    empty.textContent = 'No tasks. Double click a date, use Add Task, or Quick Add.';
    taskList.appendChild(empty);
  } else {
    filtered.forEach(t => taskList.appendChild(taskItem(t)));
  }

  updateStats();
}

function taskItem(t) {
  const el = document.createElement('div'); el.className = 'task' + (t.done ? ' done' : '');
  const row = document.createElement('div'); row.className = 'row';

  const left = document.createElement('div'); left.className = 'left';
  const toggle = document.createElement('div'); toggle.className = 'toggle' + (t.done ? ' on' : '');
  toggle.addEventListener('click', () => {
    t.done = !t.done; toggle.classList.toggle('on');
    if (t.done) el.classList.add('done'); else el.classList.remove('done');
    save(LS_TASKS, tasks); renderCalendar(); updateStats(); showToast(t.done ? 'Marked done' : 'Marked not done');
  });

  const title = document.createElement('div'); title.className = 'title'; title.textContent = t.text;
  left.appendChild(toggle); left.appendChild(title);

  const actions = document.createElement('div'); actions.className = 'actions';
  const edit = buttonSm('Edit', () => openModal(selectedKey, t.id));
  const del = buttonSm('Delete', () => deleteTask(selectedKey, t.id));
  actions.appendChild(edit); actions.appendChild(del);

  row.appendChild(left); row.appendChild(actions);
  el.appendChild(row);
  if (t.note) { const note = document.createElement('div'); note.className = 'note'; note.textContent = t.note; el.appendChild(note); }
  return el;
}

function buttonSm(label, onClick) {
  const b = document.createElement('button');
  b.className = 'neon-btn'; b.textContent = label; b.style.padding = '6px 8px';
  b.addEventListener('click', onClick); return b;
}

function openModal(dateKey, taskId = null) {
  editing.dateKey = dateKey; editing.id = taskId;
  taskModal.classList.add('open');
  if (taskId) {
    const t = (tasks[dateKey] || []).find(x => x.id === taskId);
    taskModalTitle.textContent = `Edit task · ${labelFromKey(dateKey)}`;
    taskText.value = t?.text || '';
    taskNote.value = t?.note || '';
    deleteTaskBtn.style.display = 'inline-block';
  } else {
    taskModalTitle.textContent = `Add task · ${labelFromKey(dateKey)}`;
    taskText.value = '';
    taskNote.value = '';
    deleteTaskBtn.style.display = 'none';
  }
  setTimeout(() => taskText.focus(), 0);
}

function closeModal() { taskModal.classList.remove('open'); }

function upsertTask() {
  const { dateKey, id } = editing;
  const text = taskText.value.trim(); const note = taskNote.value.trim();
  if (!text) { showToast('Enter a title'); return; }
  tasks[dateKey] = tasks[dateKey] || [];
  if (id) {
    const idx = tasks[dateKey].findIndex(t => t.id === id);
    if (idx >= 0) tasks[dateKey][idx] = { ...tasks[dateKey][idx], text, note };
    showToast('Task updated');
  } else {
    tasks[dateKey].push({ id: uid(), text, note, done: false });
    showToast('Task added');
  }
  save(LS_TASKS, tasks);
  renderCalendar(); if (selectedKey === dateKey) renderTasks();
  closeModal();
}

function deleteTask(dateKey, id) {
  const list = tasks[dateKey] || [];
  const next = list.filter(t => t.id !== id);
  tasks[dateKey] = next; save(LS_TASKS, tasks);
  renderCalendar(); renderTasks(); showToast('Task deleted');
}

// Bulk actions for tasks
clearDayBtn.addEventListener('click', () => {
  const list = tasks[selectedKey] || [];
  if (!list.length) return showToast('No tasks on selected day');
  if (confirm(`Remove all ${list.length} task(s) on ${labelFromKey(selectedKey)}?`)) {
    tasks[selectedKey] = [];
    save(LS_TASKS, tasks); renderCalendar(); renderTasks(); showToast('Selected day cleared');
  }
});

clearAllTasksBtn.addEventListener('click', () => {
  const allCount = Object.values(tasks).reduce((acc, arr) => acc + arr.length, 0);
  if (!allCount) return showToast('No tasks to clear');
  if (confirm(`Remove ALL ${allCount} tasks in the planner?`)) {
    tasks = {};
    save(LS_TASKS, tasks); renderCalendar(); renderTasks(); showToast('All tasks cleared');
  }
});

addTaskForSelectedBtn.addEventListener('click', () => openModal(selectedKey));

// Goals
function renderGoals() {
  goalsEl.innerHTML = '';
  const filters = currentFilters();
  const list = goals.filter(g => filters.length ? g.tags.some(t => filters.includes(t)) : true);
  if (!list.length) {
    const empty = document.createElement('div'); empty.className = 'sub'; empty.textContent = 'No goals yet'; goalsEl.appendChild(empty);
  } else {
    list.forEach(g => goalsEl.appendChild(goalItem(g)));
  }
  statGoals.textContent = `${goals.length} goals`;
  renderFilterChips();
}

function goalItem(g) {
  const wrap = document.createElement('div'); wrap.className = 'goal';
  const row = document.createElement('div'); row.className = 'row';
  const title = document.createElement('div'); title.textContent = g.text; title.style.fontWeight = '700';
  const actions = document.createElement('div'); actions.className = 'actions';
  const edit = buttonSm('Edit', () => editGoal(g.id));
  const del = buttonSm('Delete', () => { goals = goals.filter(x => x.id !== g.id); save(LS_GOALS, goals); renderGoals(); showToast('Goal deleted'); });
  actions.appendChild(edit); actions.appendChild(del);
  row.appendChild(title); row.appendChild(actions);

  const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = g.note || '';

  const chips = document.createElement('div'); chips.className = 'chips';
  g.tags.forEach(t => { const c = document.createElement('span'); c.className = 'chip'; c.textContent = t; c.addEventListener('click', () => toggleFilter(t)); chips.appendChild(c); });

  wrap.appendChild(row); wrap.appendChild(meta); wrap.appendChild(chips);
  return wrap;
}

function addGoal() {
  const text = goalText.value.trim();
  const note = goalNote.value.trim();
  const tags = goalTags.value.split(',').map(s => s.trim()).filter(Boolean);
  if (!text) { showToast('Enter a goal'); return; }
  goals.push({ id: uid(), text, note, tags });
  save(LS_GOALS, goals);
  goalText.value = ''; goalNote.value = ''; goalTags.value = '';
  renderGoals(); showToast('Goal added');
}

function editGoal(id) {
  const g = goals.find(x => x.id === id); if (!g) return;
  goalText.value = g.text; goalNote.value = g.note; goalTags.value = g.tags.join(', ');
  addGoalBtn.textContent = 'Update goal';
  addGoalBtn.onclick = () => {
    g.text = goalText.value.trim(); g.note = goalNote.value.trim(); g.tags = goalTags.value.split(',').map(s => s.trim()).filter(Boolean);
    save(LS_GOALS, goals); renderGoals(); showToast('Goal updated');
    goalText.value = ''; goalNote.value = ''; goalTags.value = ''; addGoalBtn.textContent = 'Add goal'; addGoalBtn.onclick = addGoal;
  };
}

// Remove all goals
clearGoalsBtn.addEventListener('click', () => {
  if (!goals.length) return showToast('No goals to remove');
  if (confirm('Remove all goals?')) {
    goals = []; save(LS_GOALS, goals); renderGoals(); showToast('All goals removed');
  }
});

// Filters
function allTags() { return [...new Set(goals.flatMap(g => g.tags))]; }
function currentFilters() { return [...activeFilters.querySelectorAll('[data-filter].on')].map(el => el.getAttribute('data-filter')); }
function toggleFilter(tag) {
  const chip = [...activeFilters.children].find(x => x.getAttribute('data-filter') === tag);
  if (chip) chip.classList.toggle('on');
  renderGoals();
}
function renderFilterChips() {
  activeFilters.innerHTML = '';
  const tags = allTags();
  tags.forEach(t => {
    const c = document.createElement('button'); c.className = 'chip'; c.textContent = t; c.setAttribute('data-filter', t);
    c.addEventListener('click', () => { c.classList.toggle('on'); renderGoals(); });
    activeFilters.appendChild(c);
  });
}

// Stats
function updateStats() {
  const all = Object.values(tasks).flat();
  const done = all.filter(t => t.done).length;
  statTasks.textContent = `${all.length} tasks`;
  statDone.textContent = `${done} done`;
  statGoals.textContent = `${goals.length} goals`;
}

// Quick add
quickAddBtn.addEventListener('click', () => {
  const text = quickText.value.trim(); const note = quickNote.value.trim(); if (!text) { showToast('Enter a title'); return; }
  tasks[selectedKey] = tasks[selectedKey] || [];
  tasks[selectedKey].push({ id: uid(), text, note, done: false });
  save(LS_TASKS, tasks); quickText.value = ''; quickNote.value = '';
  renderCalendar(); renderTasks(); showToast('Task added');
});

// Modal events
taskModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeModal(); });
saveTaskBtn.addEventListener('click', upsertTask);
deleteTaskBtn.addEventListener('click', () => { if (!editing.id) return; deleteTask(editing.dateKey, editing.id); closeModal(); });

// Nav
prevBtn.addEventListener('click', () => { current.setMonth(current.getMonth()-1); renderCalendar(); });
nextBtn.addEventListener('click', () => { current.setMonth(current.getMonth()+1); renderCalendar(); });
todayBtn.addEventListener('click', () => { current = new Date(); renderCalendar(); selectDate(keyFromDate(new Date())); });

// Search
searchInput.addEventListener('input', renderTasks);

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (['ArrowLeft', 'h'].includes(e.key)) { current.setMonth(current.getMonth()-1); renderCalendar(); }
  if (['ArrowRight', 'l'].includes(e.key)) { current.setMonth(current.getMonth()+1); renderCalendar(); }
});

// Init
function init() {
  renderCalendar();
  renderGoals();
  if (selectedKey) { drawerTitle.textContent = labelFromKey(selectedKey); renderTasks(); }
  else drawerTitle.textContent = 'Select a date to view tasks';
}

init();
