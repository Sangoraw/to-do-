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
let activeHour   = null;                // 開いているインライン入力の時間 (0-23 | 'none' | null)

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
  activeHour   = null;
  selectedDate = dateStr;

  const [y, m, d] = dateStr.split('-').map(Number);
  const dow      = new Date(y, m - 1, d).getDay();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  document.getElementById('panel-date').textContent =
    `${y}年${m}月${d}日（${dayNames[dow]}）`;

  renderTimeline();

  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('day-panel').classList.add('open');
  renderCalendar();
}

function closePanel() {
  selectedDate = null;
  activeHour   = null;
  document.getElementById('panel-overlay').classList.remove('open');
  document.getElementById('day-panel').classList.remove('open');
  renderCalendar();
}

// ================================================================
// Timeline rendering
// ================================================================

function renderTimeline() {
  if (!selectedDate) return;

  const tasks     = getTasksForDate(selectedDate);
  const panelBody = document.getElementById('panel-body');
  panelBody.innerHTML = '';

  const atLimit = tasks.length >= 10;

  // タスクを時間帯ごとに分類
  const tasksByHour = {};
  const unscheduled = [];

  tasks.forEach((task, i) => {
    if (task.notifyTime) {
      const hour = parseInt(task.notifyTime.split(':')[0], 10);
      if (!tasksByHour[hour]) tasksByHour[hour] = [];
      tasksByHour[hour].push({ task, index: i });
    } else {
      unscheduled.push({ task, index: i });
    }
  });

  // 「時刻なし」セクション（未スケジュールタスクがある場合、または入力中）
  if (unscheduled.length > 0 || activeHour === 'none') {
    const section = document.createElement('div');
    section.className = 'unscheduled-section';

    const header = document.createElement('div');
    header.className = 'section-label';
    header.textContent = '時刻なし';
    section.appendChild(header);

    unscheduled.forEach(({ task, index }) => {
      section.appendChild(buildTaskEl(task, index));
    });

    if (activeHour === 'none') {
      section.appendChild(buildInlineAdd('none'));
    } else if (!atLimit) {
      const btn = document.createElement('button');
      btn.className = 'time-add-btn';
      btn.textContent = '＋ 追加';
      btn.addEventListener('click', () => {
        activeHour = 'none';
        renderTimeline();
      });
      section.appendChild(btn);
    }

    panelBody.appendChild(section);
  }

  // タイムライン（0〜23時）
  const timeline = document.createElement('div');
  timeline.className = 'timeline';

  for (let h = 0; h < 24; h++) {
    const row = document.createElement('div');
    row.className = 'time-row';

    // 時刻ラベル（クリックでその時間にタスク追加）
    const label = document.createElement('div');
    label.className = 'time-label';
    label.textContent = `${String(h).padStart(2, '0')}:00`;
    if (!atLimit) {
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        activeHour = h;
        renderTimeline();
      });
    }
    row.appendChild(label);

    // コンテンツエリア
    const content = document.createElement('div');
    content.className = 'time-content';

    const hourTasks = tasksByHour[h] || [];
    hourTasks.forEach(({ task, index }) => {
      content.appendChild(buildTaskEl(task, index));
    });

    if (activeHour === h) {
      content.appendChild(buildInlineAdd(h));
    } else if (!atLimit) {
      const trigger = document.createElement('div');
      trigger.className = 'time-add-trigger';
      trigger.addEventListener('click', () => {
        activeHour = h;
        renderTimeline();
      });
      content.appendChild(trigger);
    }

    row.appendChild(content);
    timeline.appendChild(row);
  }

  panelBody.appendChild(timeline);

  // 現在時刻付近にスクロール
  if (activeHour === null) {
    const scrollTo = Math.max(0, new Date().getHours() - 1);
    const rows = timeline.querySelectorAll('.time-row');
    if (rows[scrollTo]) {
      setTimeout(() => rows[scrollTo].scrollIntoView({ block: 'start', behavior: 'auto' }), 80);
    }
  }
}

function buildTaskEl(task, index) {
  const div = document.createElement('div');
  div.className = 'task-item' + (task.done ? ' done' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = task.done;
  cb.setAttribute('aria-label', task.text);
  cb.addEventListener('change', () => toggleTask(index));

  const wrap = document.createElement('div');
  wrap.className = 'task-text-wrap';

  const span = document.createElement('span');
  span.className   = 'task-text';
  span.textContent = task.text;
  wrap.appendChild(span);

  const del = document.createElement('button');
  del.className   = 'delete-btn';
  del.textContent = '×';
  del.setAttribute('aria-label', '削除');
  del.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(index); });

  div.appendChild(cb);
  div.appendChild(wrap);
  div.appendChild(del);
  return div;
}

function buildInlineAdd(hour) {
  const container = document.createElement('div');
  container.className = 'inline-add';

  const input = document.createElement('input');
  input.type        = 'text';
  input.className   = 'inline-add-input';
  input.placeholder = 'タスクを入力...';
  input.autocomplete = 'off';
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  submitInlineAdd(input.value, hour);
    if (e.key === 'Escape') { activeHour = null; renderTimeline(); }
  });

  const addBtn = document.createElement('button');
  addBtn.className   = 'inline-add-submit';
  addBtn.textContent = '追加';
  addBtn.addEventListener('click', () => submitInlineAdd(input.value, hour));

  const cancelBtn = document.createElement('button');
  cancelBtn.className   = 'inline-add-cancel';
  cancelBtn.textContent = '✕';
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    activeHour = null;
    renderTimeline();
  });

  container.appendChild(input);
  container.appendChild(addBtn);
  container.appendChild(cancelBtn);

  setTimeout(() => input.focus(), 30);
  return container;
}

function submitInlineAdd(text, hour) {
  text = text.trim();
  if (!text) {
    activeHour = null;
    renderTimeline();
    return;
  }

  const tasks = getTasksForDate(selectedDate);
  if (tasks.length >= 10) return;

  const notifyTime = (hour !== 'none')
    ? `${String(hour).padStart(2, '0')}:00`
    : null;

  const task = {
    id:         `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    done:       false,
    notifyTime,
  };

  tasks.push(task);
  saveTasksForDate(selectedDate, tasks);

  if (task.notifyTime) {
    addScheduledNotification(task, selectedDate);
  }

  activeHour = null;
  renderTimeline();
  renderCalendar();
}

// ================================================================
// Task CRUD
// ================================================================

function toggleTask(index) {
  const tasks = getTasksForDate(selectedDate);
  tasks[index].done = !tasks[index].done;
  saveTasksForDate(selectedDate, tasks);
  renderTimeline();
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
  renderTimeline();
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
  // すでにブロックされている場合は解除方法を案内
  if (Notification.permission === 'denied') {
    alert(
      '通知がブロックされています。\n\n' +
      '解除するには：\n' +
      'ブラウザのアドレスバー左にある 🔒 アイコン（またはサイト設定）をクリックし、' +
      '「通知」を「許可」に変更してください。'
    );
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
    btn.disabled = false;
  } else if (permission === 'denied') {
    btn.textContent = '通知ブロック中（解除方法）';
    btn.classList.remove('active');
    btn.disabled = false;  // 押せるようにしてメッセージを表示
  } else {
    btn.textContent = '通知を許可';
    btn.disabled = false;
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
