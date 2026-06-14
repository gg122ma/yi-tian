/**
 * 一天 · 数据层 — localStorage 版
 * 所有数据持久化在浏览器 localStorage
 */

const DB = {
  _key: (name) => `yi_${name}`,
  _get: (name, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(DB._key(name))) || fallback; }
    catch { return fallback; }
  },
  _set: (name, data) => localStorage.setItem(DB._key(name), JSON.stringify(data)),

  // Activities
  getActivities: () => DB._get('activities', DB._SEED_ACTIVITIES),
  saveActivities: (list) => DB._set('activities', list),

  // Time entries: stored as { [date]: { [hour]: entry } }
  getEntries: (date) => { const all = DB._get('entries', {}); return all[date] || {}; },
  saveEntry: (date, hour, entry) => {
    const all = DB._get('entries', {});
    if (!all[date]) all[date] = {};
    all[date][hour] = { ...entry, date, hour };
    DB._set('entries', all);
  },
  deleteEntry: (date, hour) => {
    const all = DB._get('entries', {});
    if (all[date]) { delete all[date][hour]; DB._set('entries', all); }
  },

  // Goals
  getGoals: (date) => DB._get(`goals_${date}`, []),
  saveGoals: (date, goals) => DB._set(`goals_${date}`, goals),
  toggleGoal: (date, id) => {
    const goals = DB.getGoals(date);
    const g = goals.find(x => x.id === id);
    if (g) { g.is_completed = g.is_completed ? 0 : 1; }
    DB.saveGoals(date, goals);
  },

  // Moods
  getMoods: (date) => DB._get(`moods_${date}`, []),
  saveMood: (date, mood) => {
    const moods = DB.getMoods(date);
    const idx = moods.findIndex(m => m.hour === mood.hour);
    if (idx >= 0) moods[idx] = mood; else moods.push(mood);
    DB._set(`moods_${date}`, moods);
  },

  // Habits
  getHabits: () => DB._get('habits', DB._SEED_HABITS),
  saveHabits: (h) => DB._set('habits', h),
  logHabit: (id, date) => {
    const habits = DB.getHabits();
    const h = habits.find(x => x.id === id);
    if (!h) return;
    if (!h.logs) h.logs = [];
    if (h.logs.find(l => l.date === date)) throw new Error('already logged');
    h.logs.push({ date });
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (h.logs.find(l => l.date === d.toISOString().split('T')[0])) streak++; else break;
    }
    h.streak = streak;
    h.best_streak = Math.max(streak, h.best_streak || 0);
    DB.saveHabits(habits);
  },

  // Diary
  getDiary: (date) => DB._get(`diary_${date}`, { date, content: '' }),
  saveDiary: (date, content) => DB._set(`diary_${date}`, { date, content, word_count: content.replace(/\s/g, '').length }),
  getDiaryMonth: (month) => {
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`yi_diary_${month}`)) {
        try { results.push(JSON.parse(localStorage.getItem(key))); } catch {}
      }
    }
    return results.sort((a, b) => a.date.localeCompare(b.date));
  },

  // Profile & Settings
  getProfile: () => DB._get('profile', {}),
  saveProfile: (p) => DB._set('profile', p),
  getSettings: () => DB._get('settings', { theme: 'light', language: 'zh' }),
  saveSettings: (s) => DB._set('settings', s),

  // Overview stats
  getOverview: () => {
    const acts = DB.getActivities();
    const catMap = {};
    acts.forEach(a => { if (!catMap[a.category]) catMap[a.category] = { category: a.category, minutes: 0, entries: 0 }; });
    let totalMin = 0, totalEntries = 0, days = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('yi_entries_')) {
        const date = key.replace('yi_entries_', '');
        try {
          const entries = JSON.parse(localStorage.getItem(key));
          Object.values(entries).forEach(e => {
            days.add(date); totalEntries++; totalMin += e.duration_min || 60;
            const act = acts.find(a => a.id === e.activity_id);
            if (act && catMap[act.category]) { catMap[act.category].minutes += e.duration_min || 60; catMap[act.category].entries++; }
          });
        } catch {}
      }
    }
    return { dayCount: days.size, totalEntries, totalHours: Math.round(totalMin / 60), totalMinutes: totalMin, categoryTime: Object.values(catMap).sort((a, b) => b.minutes - a.minutes) };
  },

  // Export / Import
  exportJSON: () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('yi_')) { try { data[key] = JSON.parse(localStorage.getItem(key)); } catch { data[key] = localStorage.getItem(key); } }
    }
    return data;
  },
  importJSON: (json) => { Object.entries(json).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))); },

  // Seed data
  _SEED_ACTIVITIES: (() => {
    const acts = []; let id = 1;
    const cats = [
      { cat: '工作', items: [['深度工作','🎯'],['会议','👥'],['邮件处理','📧'],['代码编写','💻'],['设计工作','🎨'],['文档撰写','📝'],['项目管理','📋'],['学习研究','🔍']] },
      { cat: '生活', items: [['用餐','🍽️'],['家务','🧹'],['购物','🛒'],['做饭','👨‍🍳'],['通勤','🚗'],['洗澡','🚿']] },
      { cat: '健康', items: [['运动健身','🏋️'],['跑步','🏃'],['瑜伽','🧘'],['散步','🚶'],['冥想','🧠'],['午睡','😴']] },
      { cat: '学习', items: [['阅读','📖'],['在线课程','🎓'],['写作练习','✍️'],['语言学习','🗣️'],['播客','🎙️'],['看纪录片','🎬']] },
      { cat: '社交', items: [['朋友聚会','🎉'],['电话聊天','📱'],['社交媒体','📲'],['家庭时光','👨‍👩‍👧‍👦']] },
      { cat: '娱乐', items: [['看剧/电影','🎬'],['游戏','🎮'],['听音乐','🎵'],['户外活动','🏕️'],['摄影','📷'],['刷视频','📺']] },
      { cat: '休息', items: [['夜间睡眠','🌙'],['放松休息','🛋️'],['泡澡','🛁'],['发呆','☁️'],['晒太阳','☀️']] },
      { cat: '个人成长', items: [['复盘反思','🪞'],['目标规划','🎯'],['日记','📓'],['理财','💰'],['整理空间','🗂️'],['副业','🚀']] },
    ];
    cats.forEach(c => c.items.forEach(([name, icon]) => { acts.push({ id: `a${id++}`, name, category: c.cat, icon, color: '#5B7B8A', usage_count: 0 }); }));
    return acts;
  })(),

  _SEED_HABITS: [
    { id: 'h1', name: '早起（7点前）', icon: '🌅', streak: 0, best_streak: 0, logs: [] },
    { id: 'h2', name: '运动30分钟', icon: '💪', streak: 0, best_streak: 0, logs: [] },
    { id: 'h3', name: '阅读30分钟', icon: '📖', streak: 0, best_streak: 0, logs: [] },
    { id: 'h4', name: '冥想10分钟', icon: '🧘', streak: 0, best_streak: 0, logs: [] },
    { id: 'h5', name: '喝8杯水', icon: '💧', streak: 0, best_streak: 0, logs: [] },
    { id: 'h6', name: '写日记', icon: '📝', streak: 0, best_streak: 0, logs: [] },
  ],
};

// Auto-init
if (!localStorage.getItem('yi_activities')) {
  DB.saveActivities(DB._SEED_ACTIVITIES);
  DB.saveHabits(DB._SEED_HABITS);
}

export default DB;
