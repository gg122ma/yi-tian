/**
 * 一天 · 主应用 — 包含所有页面组件
 * 使用 React.createElement (无 JSX，兼容 ES Module)
 */
import DB from './db.js';
import { t as tr, getLang, setLang, LANGUAGES } from './i18n.js';
import { CAT_COLORS, MOOD_EMOJIS, fmtDate, today, fmtHour, showToast, getGreeting } from './utils.js';
import { ToastContainer, Modal, SearchOverlay, ActivityPicker } from './components.js';

const { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } = React;
const h = React.createElement;
const Ctx = createContext();

// ═══════════════════════════════════════════════
//  Today Page
// ═══════════════════════════════════════════════

function TodayPage() {
  const { lang } = useContext(Ctx);
  const tk = (k) => tr(lang, k);
  const [date, setDate] = useState(today());
  const [editH, setEditH] = useState(null);
  const [, refresh] = useState(0);
  const moodRef = useRef(null);
  const moodInst = useRef(null);

  const acts = DB.getActivities();
  const entries = DB.getEntries(date);
  const goals = DB.getGoals(date);
  const moods = DB.getMoods(date);
  const habits = DB.getHabits();
  const profile = DB.getProfile();

  const timeline = useMemo(() => {
    const tl = [];
    for (let hr = 0; hr < 24; hr++) {
      const e = entries[hr];
      const act = e ? acts.find(a => a.id === e.activity_id) : null;
      tl.push({ hour: hr, entry: e, act, isEmpty: !e });
    }
    return tl;
  }, [entries, acts]);

  const filled = timeline.filter(t => !t.isEmpty).length;
  const totalMin = timeline.filter(t => !t.isEmpty).reduce((s, t) => s + (t.entry.duration_min || 60), 0);
  const goalDone = goals.filter(g => g.is_completed).length;
  const goalRate = goals.length ? Math.round(goalDone / goals.length * 100) : 0;
  const moodAvg = moods.length ? Math.round(moods.reduce((s, m) => s + m.mood_score, 0) / moods.length * 10) / 10 : null;

  useEffect(() => {
    if (!moodRef.current || moods.length === 0) return;
    if (moodInst.current) moodInst.current.destroy();
    const d = [...moods].sort((a, b) => a.hour - b.hour);
    moodInst.current = new Chart(moodRef.current.getContext('2d'), {
      type: 'line',
      data: {
        labels: d.map(x => fmtHour(x.hour)),
        datasets: [
          { label: tk('aMood'), data: d.map(x => x.mood_score), borderColor: '#C4873B', backgroundColor: 'rgba(196,135,59,.08)', fill: true, tension: .4, pointRadius: 4, borderWidth: 2 },
          { label: 'Energy', data: d.map(x => x.energy_level), borderColor: '#5B7B8A', backgroundColor: 'rgba(91,123,138,.06)', fill: true, tension: .4, pointRadius: 4, borderWidth: 2 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 12 }, usePointStyle: true } } },
        scales: {
          y: { min: 0, max: 10, ticks: { stepSize: 2, font: { family: 'DM Mono', size: 11 }, color: '#9C9C9C' }, grid: { color: 'var(--b-s)' }, border: { display: false } },
          x: { ticks: { font: { family: 'DM Mono', size: 11 }, color: '#9C9C9C' }, grid: { display: false }, border: { display: false } },
        }
      }
    });
    return () => { if (moodInst.current) moodInst.current.destroy(); };
  }, [moods.length]);

  const catTime = {};
  timeline.filter(t => t.act).forEach(t => {
    const c = t.act.category;
    if (!catTime[c]) catTime[c] = { category: c, minutes: 0 };
    catTime[c].minutes += t.entry.duration_min || 60;
  });
  const catArr = Object.values(catTime).sort((a, b) => b.minutes - a.minutes);

  return h('div', null,
    h('div', { className: 'page-header an' },
      h('h1', null, profile.nickname ? `${getGreeting(tk)}，${profile.nickname}` : tk('today')),
      h('div', { className: 'sub' }, new Date().toLocaleDateString(document.documentElement.lang || 'zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })),
      h('div', { className: 'line' })
    ),

    // Stats
    h('div', { className: 'g4 an a1', style: { marginBottom: 24 } },
      h('div', { className: 'card' }, h('div', { className: 'stat-hero' }, h('span', { className: 'num' }, Math.round(totalMin / 60 * 10) / 10), h('span', { className: 'unit' }, tk('hLogged'))), h('div', { className: 'stat-desc' }, `${filled}/24h`)),
      h('div', { className: 'card' }, h('div', { className: 'stat-hero' }, h('span', { className: 'num' }, goalRate), h('span', { className: 'unit' }, '%')), h('div', { className: 'stat-desc' }, `${goalDone}/${goals.length} ${tk('gDone')}`)),
      h('div', { className: 'card' }, h('div', { className: 'stat-hero' }, h('span', { className: 'num' }, moodAvg || '—'), h('span', { className: 'unit' }, tk('aMood'))), h('div', { className: 'stat-desc' }, `${moodAvg ? MOOD_EMOJIS[Math.round(moodAvg)] : ''} ${moods.length}条`)),
      h('div', { className: 'card' }, h('div', { className: 'stat-hero' }, h('span', { className: 'num' }, '0'), h('span', { className: 'unit' }, tk('dStreak'))), h('div', { className: 'stat-desc' }, '🔥'))
    ),

    // Heatmap
    h('div', { className: 'card an a2', style: { marginBottom: 24 } },
      h('div', { className: 'card-title' }, tk('h24')),
      h('div', { className: 'heatmap-bar' },
        timeline.map(({ hour, act, isEmpty }) =>
          h('div', { key: hour, className: `heatmap-cell${isEmpty ? ' empty' : ''}`, style: act ? { background: CAT_COLORS[act.category] + 'CC' } : {}, onClick: () => setEditH(hour), title: act ? `${fmtHour(hour)}·${act.name}` : fmtHour(hour) },
            act && h('span', { className: 'icon' }, act.icon)
          )
        )
      ),
      h('div', { className: 'heatmap-labels' }, h('span', null, '00'), h('span', null, '06'), h('span', null, '12'), h('span', null, '18'), h('span', null, '23')),
      totalMin > 0 && h('div', { style: { marginTop: 14 } },
        h('div', { className: 'cat-bar' }, catArr.map((c, i) => h('div', { key: i, className: 'cat-seg', style: { width: `${c.minutes / totalMin * 100}%`, background: CAT_COLORS[c.category] || '#9C9C9C' } }))),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 } }, catArr.map((c, i) => h('span', { key: i, className: 'cat-tag', style: { background: (CAT_COLORS[c.category] || '#9C9C9C') + '18', color: CAT_COLORS[c.category] || '#9C9C9C' } }, `${c.category} ${Math.round(c.minutes / 60 * 10) / 10}h`)))
      )
    ),

    // Timeline + Goals + Habits
    h('div', { className: 'gt an a3', style: { marginBottom: 24 } },
      h('div', { className: 'card' },
        h('div', { className: 'card-title' }, tk('tDetail')),
        timeline.filter(t => !t.isEmpty).length === 0
          ? h('div', { className: 'empty' }, h('div', { className: 'empty-icon' }, '📝'), h('div', { className: 'empty-text' }, tk('noRec')))
          : timeline.filter(t => t.act).map(({ hour, entry, act }) =>
            h('div', { key: hour, className: 'tl-row' },
              h('span', { className: 'tl-time' }, fmtHour(hour)),
              h('div', { className: 'tl-icon', style: { background: CAT_COLORS[act.category] + '22' } }, act.icon),
              h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { className: 'tl-name' }, act.name), entry.note && h('div', { className: 'tl-note' }, entry.note)),
              h('div', { className: 'tl-dots' }, [1, 2, 3, 4, 5].map(i => h('div', { key: i, className: `dot${i <= entry.intensity ? ' filled' : ''}` })))
            )
          )
      ),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
        h('div', { className: 'card' },
          h('div', { className: 'card-title' }, tk('tGoals')),
          goals.length === 0 ? h('div', { className: 'empty' }, h('div', { className: 'empty-text' }, tk('noGoals')))
            : goals.map(g => h('div', { key: g.id, className: 'goal-item' },
              h('div', { className: `goal-check${g.is_completed ? ' done' : ''}`, onClick: () => { DB.toggleGoal(date, g.id); refresh(x => x + 1); } }, g.is_completed ? '✓' : ''),
              h('div', { style: { flex: 1 } }, h('div', { className: `goal-title${g.is_completed ? ' done' : ''}` }, g.title))
            ))
        ),
        h('div', { className: 'card' },
          h('div', { className: 'card-title' }, tk('hCheck')),
          habits.map(hab => {
            const logged = hab.logs?.find(l => l.date === date);
            return h('div', { key: hab.id, className: 'habit-row' },
              h('div', { className: `habit-dot${logged ? ' done' : ''}`, onClick: () => { try { DB.logHabit(hab.id, date); showToast(tk('saved'), 'success'); } catch { showToast(tk('saved'), 'info'); } refresh(x => x + 1); } }, logged ? '✓' : ''),
              h('span', { style: { fontSize: 18 } }, hab.icon),
              h('span', { style: { flex: 1, fontSize: 14, fontWeight: 500 } }, hab.name),
              hab.streak > 0 && h('span', { className: 'habit-streak' }, `🔥 ${hab.streak}`)
            );
          })
        )
      )
    ),

    // Mood chart
    moods.length > 0 && h('div', { className: 'card an a4', style: { marginBottom: 24 } },
      h('div', { className: 'card-title' }, tk('mCurve')),
      h('div', { className: 'chart-wrap' }, h('canvas', { ref: moodRef }))
    ),

    // Edit modal
    editH !== null && h(ActivityPicker, { hour: editH, date, onClose: () => setEditH(null), onSave: () => refresh(x => x + 1) })
  );
}

// ═══════════════════════════════════════════════
//  Settings Page
// ═══════════════════════════════════════════════

function SettingsPage() {
  const { lang, setLang: setL, theme, toggleTheme } = useContext(Ctx);
  const tk = (k) => tr(lang, k);
  const [showLang, setShowLang] = useState(false);

  const handleExport = () => {
    const data = DB.exportJSON();
    const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u; a.download = `yi-tian-${today()}.json`; a.click();
    URL.revokeObjectURL(u); showToast(tk('saved'), 'success');
  };

  const handleImport = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { DB.importJSON(JSON.parse(await f.text())); showToast(tk('saved'), 'success'); }
      catch { showToast('Error', 'error'); }
    };
    inp.click();
  };

  return h('div', null,
    h('div', { className: 'page-header an' }, h('h1', null, tk('settings')), h('div', { className: 'line' })),
    h('div', { className: 'g2 an a1' },
      h('div', { className: 'card' },
        h('div', { className: 'card-title' }, tk('pref')),
        h('div', { className: 'form-group' }, h('label', { className: 'form-label' }, tk('language')),
          h('button', { className: 'btn', style: { width: '100%', justifyContent: 'flex-start' }, onClick: () => setShowLang(true) }, `${LANGUAGES.find(l => l.code === lang)?.flag} ${LANGUAGES.find(l => l.code === lang)?.name}`)),
        h('div', { className: 'form-group' }, h('label', { className: 'form-label' }, tk('darkMode')),
          h('button', { className: 'btn', style: { width: '100%', justifyContent: 'flex-start' }, onClick: toggleTheme }, `${theme === 'dark' ? '☀️' : '🌙'} ${theme === 'dark' ? 'Dark' : 'Light'}`))
      ),
      h('div', { className: 'card' },
        h('div', { className: 'card-title' }, tk('data')),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          h('button', { className: 'btn', onClick: handleExport }, `📄 ${tk('exportJSON')}`),
          h('button', { className: 'btn', onClick: handleImport }, `📥 ${tk('importJSON')}`)
        )
      )
    ),
    h('div', { className: 'card an a2', style: { marginTop: 20 } },
      h('div', { className: 'card-title' }, tk('about')),
      h('div', { style: { fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8 } },
        h('p', { style: { fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600 } }, '一天 · Yi Tian'),
        h('p', null, 'v2.0 · 24小时生命画布 · GitHub Pages'),
        h('p', { style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 8 } }, 'React 18 · Chart.js · localStorage · 20 Languages')
      )
    ),
    showLang && h(Modal, { title: tk('language'), onClose: () => setShowLang(false) },
      h('div', { className: 'lang-grid' },
        LANGUAGES.map(l => h('div', { key: l.code, className: `lang-opt${lang === l.code ? ' active' : ''}`, onClick: () => { setL(l.code); setShowLang(false); } },
          h('div', { className: 'lang-flag' }, l.flag), h('div', { className: 'lang-name' }, l.name)
        ))
      )
    )
  );
}

// ═══════════════════════════════════════════════
//  App — Main Application
// ═══════════════════════════════════════════════

function App() {
  const [lang, setLangState] = useState(getLang());
  const [theme, setTheme] = useState(() => localStorage.getItem('yi_theme') || 'light');
  const [page, setPage] = useState('today');
  const [time, setTime] = useState(new Date());
  const [showSearch, setShowSearch] = useState(false);
  const profile = useMemo(() => DB.getProfile(), []);

  const setL = (l) => { setLang(l); setLangState(l); };
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('yi_theme', next);
  };
  const tk = (k) => tr(lang, k);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, []);
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true); }
      if (e.key === 'Escape') setShowSearch(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const ts = time.toLocaleTimeString(document.documentElement.lang === 'ar' ? 'ar-SA' : 'zh-CN', { hour12: false });
  const ds = time.toLocaleDateString(document.documentElement.lang || 'zh-CN', { month: 'short', day: 'numeric' });

  const navItems = [
    { id: 'today', icon: '◉', label: tk('today') },
    { id: 'settings', icon: '⚙', label: tk('settings') },
  ];

  return h(Ctx.Provider, { value: { lang, setLang: setL, theme, toggleTheme } },
    h('div', { className: 'app' },
      h('nav', { className: 'sidebar' },
        h('div', { className: 'sb-brand' },
          h('div', { className: 'brand-icon' }, profile.avatar || '一'),
          h('span', { className: 'brand-text' }, '一天')
        ),
        h('div', { className: 'sb-nav' },
          navItems.map(n => h('div', { key: n.id, className: `nav-item${page === n.id ? ' active' : ''}`, onClick: () => setPage(n.id) },
            h('span', { className: 'ico' }, n.icon), h('span', { className: 'lbl' }, n.label)
          ))
        ),
        h('div', { className: 'sb-foot' },
          h('div', { className: 'sb-clock' }, ts),
          h('div', { className: 'sb-date' }, ds),
          h('button', { className: 'theme-btn', onClick: toggleTheme, title: tk('darkMode') }, theme === 'dark' ? '☀️' : '🌙'),
          h('button', { className: 'lang-btn', onClick: () => setPage('settings') }, LANGUAGES.find(l => l.code === lang)?.flag)
        )
      ),
      h('main', { className: 'main' },
        page === 'today' && h(TodayPage),
        page === 'settings' && h(SettingsPage)
      ),
      h(ToastContainer),
      showSearch && h(SearchOverlay, { onClose: () => setShowSearch(false), onNavigate: p => setPage(p), lang })
    )
  );
}

// Mount
ReactDOM.createRoot(document.getElementById('root')).render(h(App));
