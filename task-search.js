/* Master of Disaster · Smart task search
   Central search module. Historical suggestions replace the former repeat action. */
(function () {
  'use strict';

  function norm(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
  }

  function timestamp(item) {
    const candidates = [item.completedAt, item.abortedAt, item.completedDate, item.startedAt];
    for (const value of candidates) {
      const ms = value ? new Date(value).getTime() : NaN;
      if (Number.isFinite(ms)) return ms;
    }
    return 0;
  }

  function categoryName(item) {
    if (!item || item.category == null || item.category === '') return 'OHNE KATEGORIE';
    const id = String(item.category);
    if (Array.isArray(window.categories)) {
      const category = window.categories.find(entry => entry && (String(entry.id) === id || norm(entry.name) === norm(id)));
      if (category && category.name) return String(category.name);
    }
    return String(item.categoryName || item.category || 'OHNE KATEGORIE');
  }

  function typeName(type) {
    if (type === 'leisure') return 'FREIZEIT';
    if (type === 'selfrunner') return 'SELBSTLÄUFER';
    if (type === 'cooking') return 'KOCHEN';
    return 'ARBEIT';
  }

  function collect() {
    const groups = new Map();
    const active = Array.isArray(window.tasks) ? window.tasks : [];
    const archived = Array.isArray(window.archive) ? window.archive : [];

    function add(item, source) {
      if (!item || !item.text) return;
      const name = String(item.text).trim().replace(/\s+/g, ' ');
      if (!name) return;
      const key = norm(name);
      let group = groups.get(key);
      if (!group) {
        group = { key, name, count: 0, activeCount: 0, latest: null, latestMs: -1 };
        groups.set(key, group);
      }
      group.count += 1;
      if (source === 'AKTIV' && !['completed', 'aborted'].includes(item.status)) group.activeCount += 1;
      const ms = timestamp(item);
      if (!group.latest || ms >= group.latestMs) {
        group.latest = item;
        group.latestMs = ms;
        group.name = name;
      }
    }

    active.forEach(item => add(item, 'AKTIV'));
    archived.forEach(item => add(item, 'ARCHIV'));
    return [...groups.values()];
  }

  function score(group, query) {
    const name = group.key;
    if (!query) return group.latestMs ? 10000000000000 - group.latestMs : 10000000000000;
    if (name === query) return 0;
    if (name.startsWith(query)) return 100;
    const words = name.split(' ');
    if (words.some(word => word.startsWith(query))) return 200;
    const index = name.indexOf(query);
    if (index >= 0) return 300 + index;
    return Infinity;
  }

  window.getKnownTaskSuggestions = function (query) {
    const q = norm(query);
    const groups = collect();
    return groups
      .map(group => ({ ...group, rank: score(group, q) }))
      .filter(group => Number.isFinite(group.rank))
      .sort((a, b) => a.rank - b.rank || b.latestMs - a.latestMs || a.name.localeCompare(b.name, 'de-DE'))
      .slice(0, 6)
      .map(group => ({
        name: group.name,
        source: group.activeCount ? 'BEREITS VORHANDEN' : 'VERLAUF',
        activeCount: group.activeCount,
        count: group.count,
        item: group.latest,
        latestMs: group.latestMs
      }));
  };

  window.selectTaskSuggestion = function (encodedName) {
    const name = decodeURIComponent(encodedName);
    const input = document.getElementById('taskInput');
    if (!input) return;
    const group = collect().find(item => item.key === norm(name));
    input.value = group ? group.name : name;

    if (group && group.latest) {
      const item = group.latest;
      if (typeof window.setNewTaskType === 'function') window.setNewTaskType(item.type || 'work');
      if (Object.prototype.hasOwnProperty.call(item, 'category')) {
        window.__modPendingSuggestionCategory = item.category == null ? null : item.category;
      } else {
        window.__modPendingSuggestionCategory = null;
      }
      if (typeof window.updateNewOptions === 'function') window.updateNewOptions();
    }

    if (typeof window.hideTaskSuggestions === 'function') window.hideTaskSuggestions();
    input.focus();
  };

  const originalAddTask = window.addTask;
  if (typeof originalAddTask === 'function') {
    window.addTask = function () {
      const input = document.getElementById('taskInput');
      const wantedText = input ? norm(input.value) : '';
      const beforeIds = new Set((Array.isArray(window.tasks) ? window.tasks : []).map(item => item && item.id));
      const pendingCategory = window.__modPendingSuggestionCategory;
      const result = originalAddTask.apply(this, arguments);
      if (wantedText && pendingCategory !== undefined && Array.isArray(window.tasks)) {
        const created = [...window.tasks].reverse().find(item => item && !beforeIds.has(item.id) && norm(item.text) === wantedText);
        if (created) {
          created.category = pendingCategory;
          if (typeof window.saveTasks === 'function') window.saveTasks();
          if (typeof window.render === 'function') window.render();
        }
      }
      window.__modPendingSuggestionCategory = undefined;
      return result;
    };
  }

  window.renderTaskSuggestions = function () {
    const input = document.getElementById('taskInput');
    const box = document.getElementById('taskSuggestions');
    if (!input || !box) return;
    const suggestions = window.getKnownTaskSuggestions(input.value);
    if (!suggestions.length) {
      if (typeof window.hideTaskSuggestions === 'function') window.hideTaskSuggestions();
      return;
    }
    box.innerHTML = suggestions.map(item => {
      const task = item.item || {};
      const meta = [typeName(task.type), categoryName(task)].join(' · ');
      const history = item.count > 1 ? ` · ${item.count}×` : '';
      const warning = item.activeCount ? `<span class="task-suggestion-active">BEREITS OFFEN</span>` : '';
      return `<button type="button" class="task-suggestion smart-task-suggestion" onmousedown="event.preventDefault()" onclick="selectTaskSuggestion('${encodeURIComponent(item.name)}')"><span class="task-suggestion-main"><span class="task-suggestion-name">${window.escapeHtml ? window.escapeHtml(item.name) : item.name}</span>${warning}</span><span class="task-suggestion-meta">${meta}${history}</span></button>`;
    }).join('');
    box.classList.add('visible');
  };

  function attach() {
    const input = document.getElementById('taskInput');
    if (!input || input.dataset.smartSearchV432 === '1') return;
    input.dataset.smartSearchV432 = '1';
    input.addEventListener('focus', window.renderTaskSuggestions);
  }
  attach();

  const style = document.createElement('style');
  style.textContent = `
    .smart-task-suggestion{display:flex!important;flex-direction:column;align-items:stretch!important;gap:4px;padding:10px 12px!important;text-align:left}
    .task-suggestion-main{display:flex;align-items:center;gap:8px;min-width:0}
    .smart-task-suggestion .task-suggestion-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .task-suggestion-meta{font-size:10px;letter-spacing:.06em;opacity:.68}
    .task-suggestion-active{flex:0 0 auto;font-size:9px;letter-spacing:.06em;border:1px solid currentColor;border-radius:999px;padding:2px 5px;opacity:.9}
  `;
  document.head.appendChild(style);
})();
