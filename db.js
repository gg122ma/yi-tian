/**
 * 一天 · 静态数据层 — localStorage 版
 * 替代后端 API，所有数据存储在浏览器 localStorage
 */

const DB = {
  _key: (name) => `yi_${name}`,
  _get: (name, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(DB._key(name))) || fallback; }
    catch { return fallback; }
  },
  _set: (name, data) => localStorage.setItem(DB._key(name), JSON.stringify(data)),

  // ═══ 活动 ═══
  getActivities: () => DB._get('activities', DB.DEFAULT_ACTIVITIES),
  saveActivities: (list) => DB._set('activities', list),

  // ═══ 时间记录 ═══
  getEntries: (date) => {
    const all = DB._get('entries', {});
    return all[date] || {};
  },
  saveEntry: (date, hour, entry) => {
    const all = DB._get('entries', {});
    if (!all[date]) all[date] = {};
    all[date][hour] = { ...entry, date, hour, updated_at: new Date().toISOString() };
    DB._set('entries', all);
  },
  deleteEntry: (date, hour) => {
    const all = DB._get('entries', {});
    if (all[date]) { delete all[date][hour]; DB._set('entries', all); }
  },

  // ═══ 目标 ═══
  getGoals: (date) => DB._get(`goals_${date}`, []),
  saveGoals: (date, goals) => DB._set(`goals_${date}`, goals),
  toggleGoal: (date, goalId) => {
    const goals = DB.getGoals(date);
    const g = goals.find(x => x.id === goalId);
    if (g) { g.is_completed = g.is_completed ? 0 : 1; g.completed_at = g.is_completed ? new Date().toISOString() : null; }
    DB.saveGoals(date, goals);
  },

  // ═══ 心情 ═══
  getMoods: (date) => DB._get(`moods_${date}`, []),
  saveMood: (date, mood) => {
    const moods = DB.getMoods(date);
    const idx = moods.findIndex(m => m.hour === mood.hour);
    if (idx >= 0) moods[idx] = mood; else moods.push(mood);
    DB.saveMood(date, moods);
    // re-save
    const all = DB.getMoods(date);
    const i2 = all.findIndex(m => m.hour === mood.hour);
    if (i2 >= 0) all[i2] = mood; else all.push(mood);
    DB._set(`moods_${date}`, all);
  },

  // ═══ 习惯 ═══
  getHabits: () => DB._get('habits', DB.DEFAULT_HABITS),
  saveHabits: (habits) => DB._set('habits', habits),
  logHabit: (habitId, date) => {
    const habits = DB.getHabits();
    const h = habits.find(x => x.id === habitId);
    if (!h) return;
    if (!h.logs) h.logs = [];
    if (h.logs.find(l => l.date === date)) throw new Error('已存在');
    h.logs.push({ date, completed: 1 });
    // calc streak
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      if (h.logs.find(l => l.date === ds)) streak++; else break;
    }
    h.streak = streak;
    h.best_streak = Math.max(streak, h.best_streak || 0);
    DB.saveHabits(habits);
  },

  // ═══ 日记 ═══
  getDiary: (date) => DB._get(`diary_${date}`, { date, content: '' }),
  saveDiary: (date, content) => DB._set(`diary_${date}`, { date, content, word_count: content.replace(/\s/g, '').length, updated_at: new Date().toISOString() }),
  getDiaryMonth: (month) => {
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`yi_diary_${month}`)) {
        try { results.push(JSON.parse(localStorage.getItem(key))); } catch {}
      }
    }
    return results.sort((a, b) => a.date.localeCompare(b.date));
  },

  // ═══ 设置 ═══
  getSettings: () => DB._get('settings', { theme: 'light', language: 'zh', time_format: '24h', week_start: 'monday' }),
  saveSettings: (s) => DB._set('settings', s),

  // ═══ 个人信息 ═══
  getProfile: () => DB._get('profile', {}),
  saveProfile: (p) => DB._set('profile', p),

  // ═══ 统计 ═══
  getOverview: () => {
    const activities = DB.getActivities();
    const catMap = {};
    activities.forEach(a => { if (!catMap[a.category]) catMap[a.category] = { category: a.category, minutes: 0, entries: 0 }; });
    let totalMin = 0, totalEntries = 0, days = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('yi_entries_')) {
        const date = key.replace('yi_entries_', '');
        try {
          const entries = JSON.parse(localStorage.getItem(key));
          Object.values(entries).forEach(e => {
            days.add(date); totalEntries++; totalMin += e.duration_min || 60;
            const act = activities.find(a => a.id === e.activity_id);
            if (act && catMap[act.category]) { catMap[act.category].minutes += e.duration_min || 60; catMap[act.category].entries++; }
          });
        } catch {}
      }
    }
    return {
      dayCount: days.size, totalEntries, totalHours: Math.round(totalMin / 60), totalMinutes: totalMin,
      categoryTime: Object.values(catMap).sort((a, b) => b.minutes - a.minutes),
      currentStreak: 0, goalOverview: { completionRate: 0 },
    };
  },

  // ═══ 预设活动（60+） ═══
  DEFAULT_ACTIVITIES: (() => {
    const acts = [];
    const cats = [
      { name: '工作', color: '#5B7B8A', items: [
        ['深度工作','Deep Work','🎯','#2563EB'],['会议','Meeting','👥','#7C3AED'],['邮件处理','Email','📧','#6366F1'],
        ['代码编写','Coding','💻','#3B82F6'],['设计工作','Design','🎨','#8B5CF6'],['文档撰写','Writing','📝','#6D28D9'],
        ['项目管理','PM','📋','#4F46E5'],['学习研究','Research','🔍','#4338CA'],
      ]},
      { name: '生活', color: '#7A9E7E', items: [
        ['用餐','Eating','🍽️','#059669'],['家务','Chores','🧹','#047857'],['购物','Shopping','🛒','#065F46'],
        ['做饭','Cooking','👨‍🍳','#064E3B'],['通勤','Commute','🚗','#0D9488'],['洗澡','Shower','🚿','#0F766E'],
      ]},
      { name: '健康', color: '#C65D3E', items: [
        ['运动健身','Exercise','🏋️','#D97706'],['跑步','Running','🏃','#B45309'],['瑜伽','Yoga','🧘','#92400E'],
        ['散步','Walking','🚶','#78350F'],['冥想','Meditation','🧠','#F59E0B'],['午睡','Nap','😴','#EAB308'],
      ]},
      { name: '学习', color: '#8B6B8A', items: [
        ['阅读','Reading','📖','#DB2777'],['在线课程','Course','🎓','#BE185D'],['写作练习','Writing','✍️','#9D174D'],
        ['语言学习','Language','🗣️','#831843'],['播客','Podcast','🎙️','#EC4899'],['看纪录片','Documentary','🎬','#E11D48'],
      ]},
      { name: '社交', color: '#D4A84B', items: [
        ['朋友聚会','Hangout','🎉','#7C3AED'],['电话聊天','Phone Call','📱','#6D28D9'],
        ['社交媒体','Social Media','📲','#5B21B6'],['家庭时光','Family','👨‍👩‍👧‍👦','#4C1D95'],
      ]},
      { name: '娱乐', color: '#C4873B', items: [
        ['看剧/电影','Movie','🎬','#DC2626'],['游戏','Gaming','🎮','#B91C1C'],['听音乐','Music','🎵','#991B1B'],
        ['户外活动','Outdoor','🏕️','#EF4444'],['摄影','Photography','📷','#F87171'],['刷视频','Videos','📺','#FCA5A5'],
      ]},
      { name: '休息', color: '#9BB0C4', items: [
        ['夜间睡眠','Sleep','🌙','#4F46E5'],['放松休息','Relax','🛋️','#4338CA'],['泡澡','Bath','🛁','#3730A3'],
        ['发呆','Idle','☁️','#312E81'],['晒太阳','Sun','☀️','#EEF2FF'],
      ]},
      { name: '个人成长', color: '#6B8F71', items: [
        ['复盘反思','Reflect','🪞','#0D9488'],['目标规划','Planning','🎯','#0F766E'],['日记','Journal','📓','#115E59'],
        ['理财','Finance','💰','#134E4A'],['整理空间','Organize','🗂️','#14B8A6'],['副业','Side Project','🚀','#2DD4BF'],
      ]},
    ];
    let id = 1;
    cats.forEach(cat => {
      cat.items.forEach(([name, nameEn, icon, color]) => {
        acts.push({ id: `act_${id++}`, name, name_en: nameEn, category: cat.name, color, icon, description: '', is_favorite: 0, usage_count: 0 });
      });
    });
    return acts;
  })(),

  // ═══ 预设习惯 ═══
  DEFAULT_HABITS: [
    { id: 'h1', name: '早起（7点前）', icon: '🌅', color: '#F59E0B', frequency: 'daily', streak: 0, best_streak: 0, logs: [], is_active: 1 },
    { id: 'h2', name: '运动30分钟', icon: '💪', color: '#10B981', frequency: 'daily', streak: 0, best_streak: 0, logs: [], is_active: 1 },
    { id: 'h3', name: '阅读30分钟', icon: '📖', color: '#3B82F6', frequency: 'daily', streak: 0, best_streak: 0, logs: [], is_active: 1 },
    { id: 'h4', name: '冥想10分钟', icon: '🧘', color: '#8B5CF6', frequency: 'daily', streak: 0, best_streak: 0, logs: [], is_active: 1 },
    { id: 'h5', name: '喝8杯水', icon: '💧', color: '#06B6D4', frequency: 'daily', streak: 0, best_streak: 0, logs: [], is_active: 1 },
    { id: 'h6', name: '写日记', icon: '📝', color: '#EC4899', frequency: 'daily', streak: 0, best_streak: 0, logs: [], is_active: 1 },
    { id: 'h7', name: '不刷社交媒体', icon: '📵', color: '#EF4444', frequency: 'daily', streak: 0, best_streak: 0, logs: [], is_active: 1 },
  ],

  // ═══ 导出/导入 ═══
  exportJSON: () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('yi_')) {
        try { data[key] = JSON.parse(localStorage.getItem(key)); } catch { data[key] = localStorage.getItem(key); }
      }
    }
    return data;
  },
  importJSON: (json) => {
    Object.entries(json).forEach(([key, value]) => {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
  },
};

// 初始化：如果localStorage为空，写入默认数据
if (!localStorage.getItem('yi_activities')) {
  DB.saveActivities(DB.DEFAULT_ACTIVITIES);
  DB.saveHabits(DB.DEFAULT_HABITS);
}
