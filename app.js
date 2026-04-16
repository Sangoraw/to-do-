'use strict';

// ================================================================
// Data helpers
// ================================================================

function getData() {
  try {
    return JSON.parse(localStorage.getItem('calendarTasks') || '{}');
  } catch {
    return {};
  }
}

function saveData(data) {
  localStorage.setItem('calendarTasks', JSON.stringify(data));
}

function getTasksForDate(dateStr) {
  return getData()[dateStr] || [];
}

function saveTasksForDate(dateStr, tasks) {
  const data = getData();
  if (tasks.length === 0) {
    delete data[dateStr];
  } else {
    data[dateStr] = tasks;
  }
  saveData(data);
}

// ================================================================
// State
// ================================================================

const _today = new Date();
let currentYear  = _today.getFullYear();
let currentMonth = _today.getMonth();   // 0-based
let selectedDate = null;                // 'YYYY-MM-DD'

// ================================================================
// Date utilities
// ================================================================

function toDateStr(year, month, day) {
  // month is 0-based
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayStr() {
  return toDateStr(_today.getFullYear(), _today.getMonth(), _today.getDate());
}

// ================================================================
// Calendar rendering
// ================================================================

function renderCalendar() {
  const grid  = document.getElementById('cal-grid');
  const title = document.getElementById('cal-title');

  title.textContent = `${currentYear}年 ${currentMonth + 1}月`;
  grid.innerHTML = '';

  // Day-of-week headers
  ['日', '月', '火', '水', '木', '金', '土'].forEach((label, i) => {
    const div = document.createElement('div');
    div.className = 'day-header';
    if (i === 0) div.classList.add('sun');
    if (i === 6) div.classList.add('sat');
    div.textContent = label;
    grid.appendChild(div);
  });

  const firstDow    = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const data        = getData();
  const tStr        = todayStr();

  // Leading empty cells
  for (let i = 0; i < firstDow; i++) {
    const div = document.createElement('div');
    div.className = 'cal-day empty';
    grid.appendChild(div);
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dow     = (firstDow + day - 1) % 7;
    const dateStr = toDateStr(currentYear, currentMonth, day);
    const tasks   = data[dateStr] || [];

    const div = document.createElement('div');
    div.className = 'cal-day';
    if (dow === 0) div.classList.add('sun');
    if (dow === 6) div.classList.add('sat');
    if (dateStr === tStr)          div.classList.add('today');
    if (dateStr === selectedDate)  div.classList.add('selected');

    const num = document.createElement('span');
    num.className   = 'day-num';
    num.textContent = day;
    div.appendChild(num);

    if (tasks.length > 0) {
      const dot = document.createElement('span');
      dot.className = 'task-dot';
      if (tasks.every(t => t.done)) dot.classList.add('all-done');
      div.appendChild(dot);
    }

    div.addEventListener('click', () => openPanel(dateStr));
    grid.appendChild(div);
  }
}

// ================================================================
// Day panel
// ================================================================

function openPanel(dateStr) {
  selectedDate = dateStr;

  const [y, m, d] = dateStr.split('-').map(Number);
  const dow      = new Date(y, m - 1, d).getDay();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  document.getElementById('panel-date').textContent =
    `${y}年${m}月${d}日（${dayNames[dow]}）`;

  renderTaskList();

  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('day-panel').classList.add('open');
  renderCalendar();

  // Focus input after animation
  setTimeout(() => {
    const input = document.getElementById('new-task-input');
    if (input) input.focus();
  }, 350);
}

function closePanel() {
  selectedDate = null;
  document.getElementById('panel-overlay').classList.remove('open');
  document.getElementById('day-panel').classList.remove('open');
  renderCalendar();
}

function renderTaskList() {
  if (!selectedDate) return;

  const tasks    = getTasksForDate(selectedDate);
  const list     = document.getElementById('day-task-list');
  const emptyMsg = document.getElementById('day-empty-msg');
  const limitMsg = document.getElementById('limit-msg');
  const addArea  = document.getElementById('add-task-area');
  const countEl  = document.getElementById('task-count');

  list.innerHTML       = '';
  countEl.textContent  = `${tasks.length} / 10 件`;
  emptyMsg.style.display = tasks.length === 0 ? 'block' : 'none';

  const atLimit = tasks.length >= 10;
  limitMsg.style.display = atLimit ? 'block' : 'none';
  addArea.style.display  = atLimit ? 'none'  : 'flex';

  tasks.forEach((task, i) => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '');

    // Checkbox
    const cb    = document.createElement('input');
    cb.type     = 'checkbox';
    cb.checked  = task.done;
    cb.setAttribute('aria-label', task.text);
    cb.addEventListener('change', () => toggleTask(i));

    // Text area
    const wrap  = document.createElement('div');
    wrap.className = 'task-text-wrap';

    const span  = document.createElement('span');
    span.className   = 'task-text';
    span.textContent = task.text;
    wrap.appendChild(span);

    if (task.notifyTime) {
      const tag   = document.createElement('span');
      tag.className   = 'notify-time-tag';
      tag.textContent = `🔔 ${task.notifyTime}`;
      wrap.appendChild(tag);
    }

    // Delete button
    const del   = document.createElement('button');
    del.className    = 'delete-btn';
    del.textContent  = '×';
    del.setAttribute('aria-label', '削除');
    del.addEventListener('click', () => deleteTask(i));

    li.appendChild(cb);
    li.appendChild(wrap);
    li.appendChild(del);
    list.appendChild(li);
  });
}

// ================================================================
// Task CRUD
// ================================================================

function addTask() {
  if (!selectedDate) return;

  const input     = document.getElementById('new-task-input');
  const timeInput = document.getElementById('notify-time-input');
  const text      = input.value.trim();
  if (!text) return;

  const tasks = getTasksForDate(selectedDate);
  if (tasks.length >= 10) return;

  const task = {
    id:         `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    done:       false,
    notifyTime: timeInput.value || null,
  };

  tasks.push(task);
  saveTasksForDate(selectedDate, tasks);

  if (task.notifyTime) {
    addScheduledNotification(task, selectedDate);
  }

  input.value     = '';
  timeInput.value = '';
  renderTaskList();
  renderCalendar();
  input.focus();
}

function toggleTask(index) {
  const tasks = getTasksForDate(selectedDate);
  tasks[index].done = !tasks[index].done;
  saveTasksForDate(selectedDate, tasks);
  renderTaskList();
  renderCalendar();
}

function deleteTask(index) {
  const tasks = getTasksForDate(selectedDate);
  const task  = tasks[index];

  if (task.notifyTime) {
    removeScheduledNotification(task.id);
  }

  tasks.splice(index, 1);
  saveTasksForDate(selectedDate, tasks);
  renderTaskList();
  renderCalendar();
}

// ================================================================
// Scheduled notifications (stored in localStorage)
// ================================================================

function getScheduledNotifications() {
  try {
    return JSON.parse(localStorage.getItem('scheduledNotifications') || '[]');
  } catch {
    return [];
  }
}

function saveScheduledNotifications(list) {
  localStorage.setItem('scheduledNotifications', JSON.stringify(list));
}

function addScheduledNotification(task, dateStr) {
  const list = getScheduledNotifications();
  list.push({
    id:         task.id,
    text:       task.text,
    dateStr,
    notifyTime: task.notifyTime,
    shown:      false,
  });
  saveScheduledNotifications(list);
}

function removeScheduledNotification(taskId) {
  const list = getScheduledNotifications().filter(n => n.id !== taskId);
  saveScheduledNotifications(list);
}

// Called every minute to fire due notifications
function checkNotifications() {
  if (Notification.permission !== 'granted') return;

  const now  = new Date();
  const list = getScheduledNotifications();
  let changed = false;

  const updated = list.map(notif => {
    if (notif.shown) return notif;

    const target = new Date(`${notif.dateStr}T${notif.notifyTime}:00`);
    const diff   = now - target; // ms since target time

    // Fire if within the past 2 minutes (handles brief app inactivity)
    if (diff >= 0 && diff < 120_000) {
      const tasks = getTasksForDate(notif.dateStr);
      const task  = tasks.find(t => t.id === notif.id);
      if (task && !task.done) {
        fireNotification(notif.text, notif.dateStr);
      }
      changed = true;
      return { ...notif, shown: true };
    }

    // Auto-expire notifications more than 2 minutes old
    if (diff >= 120_000) {
      changed = true;
      return { ...notif, shown: true };
    }

    return notif;
  });

  if (changed) saveScheduledNotifications(updated);
}

function fireNotification(text, dateStr) {
  const title   = 'タスクのお知らせ';
  const options = {
    body:  text,
    icon:  './icons/icon.svg',
    badge: './icons/icon.svg',
    data:  { dateStr },
  };

  // Prefer SW notification (works when backgrounded on Android)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      options,
    });
  } else {
    new Notification(title, options);
  }
}

// ================================================================
// Notification permission UI
// ================================================================

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('このブラウザは通知に対応していません');
    return;
  }
  const permission = await Notification.requestPermission();
  updateNotifyBtn(permission);
  if (permission === 'granted') {
    // Test notification so the user knows it's working
    setTimeout(() => fireNotification('通知が有効になりました！', null), 800);
  }
}

function updateNotifyBtn(permission) {
  const btn = document.getElementById('notify-permission-btn');
  if (!btn) return;
  if (permission === 'granted') {
    btn.textContent = '通知 ON ✓';
    btn.classList.add('active');
    btn.disabled    = false;
  } else if (permission === 'denied') {
    btn.textContent = '通知ブロック中';
    btn.disabled    = true;
  } else {
    btn.textContent = '通知を許可';
    btn.disabled    = false;
  }
}

// ================================================================
// Service Worker registration
// ================================================================

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
  } catch (e) {
    console.warn('Service Worker registration failed:', e);
  }
}

// ================================================================
// PWA install prompt
// ================================================================

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem('installDismissed')) {
    document.getElementById('install-banner').style.display = 'flex';
  }
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').style.display = 'none';
  deferredPrompt = null;
});

// ================================================================
// Bootstrap
// ================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await registerSW();

  // Notification button state
  if ('Notification' in window) {
    updateNotifyBtn(Notification.permission);
  } else {
    document.getElementById('notify-permission-btn').style.display = 'none';
  }

  // Calendar navigation
  document.getElementById('prev-month').addEventListener('click', () => {
    if (--currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    if (++currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });
  document.getElementById('today-btn').addEventListener('click', () => {
    const now    = new Date();
    currentYear  = now.getFullYear();
    currentMonth = now.getMonth();
    renderCalendar();
  });

  // Panel controls
  document.getElementById('close-panel-btn').addEventListener('click', closePanel);
  document.getElementById('panel-overlay').addEventListener('click', closePanel);

  // Task input
  document.getElementById('add-task-btn').addEventListener('click', addTask);
  document.getElementById('new-task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Notification permission
  document.getElementById('notify-permission-btn').addEventListener('click',
    requestNotificationPermission);

  // PWA install
  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('install-banner').style.display = 'none';
    }
    deferredPrompt = null;
  });
  document.getElementById('dismiss-install').addEventListener('click', () => {
    document.getElementById('install-banner').style.display = 'none';
    localStorage.setItem('installDismissed', '1');
  });

  // Initial render
  renderCalendar();

  // Notification check: every 60 seconds + immediately on load
  checkNotifications();
  setInterval(checkNotifications, 60_000);
});
