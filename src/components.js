/**
 * 一天 · 共享组件：Toast / Modal / Search
 */
import { onToast, CAT_COLORS, fmtHour, showToast } from './utils.js';
import { t as tr, LANGUAGES } from './i18n.js';
import DB from './db.js';

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Toast ───
export function ToastContainer() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const fn = (t) => { setList(p => [...p, t]); setTimeout(() => setList(p => p.filter(x => x.id !== t.id)), 3000); };
    const unsub = onToast(fn);
    return unsub;
  }, []);
  return React.createElement('div', { className: 'toast-container' },
    list.map(t => React.createElement('div', { key: t.id, className: `toast ${t.type}` }, t.msg))
  );
}

// ─── Modal ───
export function Modal({ title, onClose, children, footer }) {
  return React.createElement('div', { className: 'modal-overlay', onClick: onClose },
    React.createElement('div', { className: 'modal', onClick: e => e.stopPropagation() },
      React.createElement('div', { className: 'modal-head' },
        React.createElement('h3', null, title),
        React.createElement('button', { className: 'modal-close', onClick: onClose }, '×')
      ),
      React.createElement('div', { className: 'modal-body' }, children),
      footer && React.createElement('div', { className: 'modal-foot' }, footer)
    )
  );
}

// ─── Search Overlay ───
export function SearchOverlay({ onClose, onNavigate, lang }) {
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const activities = useMemo(() => DB.getActivities(), []);

  useEffect(() => { ref.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    const m = [];
    activities.filter(a => a.name.toLowerCase().includes(s)).slice(0, 5)
      .forEach(a => m.push({ icon: a.icon, label: a.name, sub: a.category }));
    [
      { icon: '◉', label: tr(lang, 'today'), page: 'today' },
      { icon: '≡', label: tr(lang, 'timeline'), page: 'timeline' },
      { icon: '◈', label: tr(lang, 'insights'), page: 'insights' },
      { icon: '✎', label: tr(lang, 'diary'), page: 'diary' },
    ].filter(p => p.label.toLowerCase().includes(s)).forEach(p => m.push(p));
    return m;
  }, [q, activities, lang]);

  return React.createElement('div', { className: 'search-overlay', onClick: onClose },
    React.createElement('div', { className: 'search-box', onClick: e => e.stopPropagation() },
      React.createElement('input', {
        ref, className: 'search-input', placeholder: tr(lang, 'search'), value: q,
        onChange: e => setQ(e.target.value),
        onKeyDown: e => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && results[0]?.page) { onNavigate(results[0].page); onClose(); }
        }
      }),
      results.length > 0 && React.createElement('div', { className: 'search-results' },
        results.map((r, i) => React.createElement('div', {
          key: i, className: 'search-item',
          onClick: () => { if (r.page) { onNavigate(r.page); onClose(); } }
        }, React.createElement('span', null, r.icon), React.createElement('span', null, r.label),
          r.sub && React.createElement('span', { style: { marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' } }, r.sub)))
      ),
      q && results.length === 0 && React.createElement('div', { style: { padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 } }, tr(lang, 'noRes'))
    )
  );
}

// ─── Activity Picker Modal ───
export function ActivityPicker({ hour, date, onClose, onSave }) {
  const activities = useMemo(() => DB.getActivities(), []);
  const handleSave = (actId) => {
    DB.saveEntry(date, hour, { activity_id: actId, duration_min: 60, intensity: 3 });
    showToast('已保存', 'success');
    onSave();
    onClose();
  };
  return React.createElement(Modal, { title: `${tr(localStorage.getItem('yi_lang')||'zh', 'record')} ${fmtHour(hour)}`, onClose },
    React.createElement('div', { className: 'act-picker' },
      activities.map(a => React.createElement('div', {
        key: a.id, className: 'act-option', onClick: () => handleSave(a.id)
      }, React.createElement('span', { className: 'act-icon' }, a.icon), React.createElement('span', { className: 'act-name' }, a.name)))
    )
  );
}
