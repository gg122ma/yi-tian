/**
 * ═══════════════════════════════════════════════════════════════
 *  一天 · 种子数据（Seed Data）
 * ═══════════════════════════════════════════════════════════════
 *  预设活动库：8大分类、60+种活动
 *  示例数据：生成最近7天的模拟时间记录
 * ═══════════════════════════════════════════════════════════════
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from './database.js';
import { format, subDays } from 'date-fns';

// ─── 预设活动分类和数据 ──────────────────────────────────────

const ACTIVITY_CATEGORIES = {
  '工作': {
    color: '#4A90D9',
    icon: '💼',
    activities: [
      { name: '深度工作', name_en: 'Deep Work', icon: '🎯', color: '#2563EB', description: '高度集中的创造性工作' },
      { name: '会议', name_en: 'Meeting', icon: '👥', color: '#7C3AED', description: '团队会议或讨论' },
      { name: '邮件处理', name_en: 'Email', icon: '📧', color: '#6366F1', description: '查看和回复邮件' },
      { name: '代码编写', name_en: 'Coding', icon: '💻', color: '#3B82F6', description: '编写程序代码' },
      { name: '设计工作', name_en: 'Design', icon: '🎨', color: '#8B5CF6', description: 'UI/UX设计或创意设计' },
      { name: '文档撰写', name_en: 'Writing', icon: '📝', color: '#6D28D9', description: '撰写报告、文档、方案' },
      { name: '项目管理', name_en: 'PM', icon: '📋', color: '#4F46E5', description: '项目规划和跟进' },
      { name: '学习研究', name_en: 'Research', icon: '🔍', color: '#4338CA', description: '技术调研和学习' },
    ],
  },
  '生活': {
    color: '#10B981',
    icon: '🏠',
    activities: [
      { name: '用餐', name_en: 'Eating', icon: '🍽️', color: '#059669', description: '吃饭、准备食物' },
      { name: '家务', name_en: 'Chores', icon: '🧹', color: '#047857', description: '打扫、洗衣、整理' },
      { name: '购物', name_en: 'Shopping', icon: '🛒', color: '#065F46', description: '日常采购' },
      { name: '做饭', name_en: 'Cooking', icon: '👨‍🍳', color: '#064E3B', description: '烹饪食物' },
      { name: '通勤', name_en: 'Commute', icon: '🚗', color: '#0D9488', description: '上下班路上' },
      { name: '洗澡', name_en: 'Shower', icon: '🚿', color: '#0F766E', description: '洗漱、淋浴' },
      { name: '遛狗', name_en: 'Dog Walk', icon: '🐕', color: '#115E59', description: '带宠物散步' },
    ],
  },
  '健康': {
    color: '#F59E0B',
    icon: '💪',
    activities: [
      { name: '运动健身', name_en: 'Exercise', icon: '🏋️', color: '#D97706', description: '力量训练、有氧运动' },
      { name: '跑步', name_en: 'Running', icon: '🏃', color: '#B45309', description: '户外或室内跑步' },
      { name: '瑜伽', name_en: 'Yoga', icon: '🧘', color: '#92400E', description: '瑜伽练习' },
      { name: '散步', name_en: 'Walking', icon: '🚶', color: '#78350F', description: '休闲步行' },
      { name: '冥想', name_en: 'Meditation', icon: '🧠', color: '#F59E0B', description: '正念冥想' },
      { name: '午睡', name_en: 'Nap', icon: '😴', color: '#EAB308', description: '短暂午休' },
      { name: '看医生', name_en: 'Doctor', icon: '🏥', color: '#CA8A04', description: '就医或体检' },
    ],
  },
  '学习': {
    color: '#EC4899',
    icon: '📚',
    activities: [
      { name: '阅读', name_en: 'Reading', icon: '📖', color: '#DB2777', description: '读书或阅读文章' },
      { name: '在线课程', name_en: 'Course', icon: '🎓', color: '#BE185D', description: '在线学习课程' },
      { name: '写作练习', name_en: 'Writing', icon: '✍️', color: '#9D174D', description: '写作或日记' },
      { name: '语言学习', name_en: 'Language', icon: '🗣️', color: '#831843', description: '外语学习' },
      { name: '技能练习', name_en: 'Practice', icon: '🎯', color: '#EC4899', description: '乐器、绘画等技能练习' },
      { name: '播客', name_en: 'Podcast', icon: '🎙️', color: '#F472B6', description: '听播客学习' },
      { name: '看纪录片', name_en: 'Documentary', icon: '🎬', color: '#E11D48', description: '观看纪录片' },
    ],
  },
  '社交': {
    color: '#8B5CF6',
    icon: '💬',
    activities: [
      { name: '朋友聚会', name_en: 'Hangout', icon: '🎉', color: '#7C3AED', description: '与朋友聚会' },
      { name: '电话聊天', name_en: 'Phone Call', icon: '📱', color: '#6D28D9', description: '打电话聊天' },
      { name: '社交媒体', name_en: 'Social Media', icon: '📲', color: '#5B21B6', description: '刷社交媒体' },
      { name: '家庭时光', name_en: 'Family', icon: '👨‍👩‍👧‍👦', color: '#4C1D95', description: '与家人共处' },
      { name: '约会', name_en: 'Date', icon: '❤️', color: '#7E22CE', description: '浪漫约会' },
      { name: '志愿服务', name_en: 'Volunteer', icon: '🤝', color: '#6B21A8', description: '社区志愿服务' },
    ],
  },
  '娱乐': {
    color: '#EF4444',
    icon: '🎮',
    activities: [
      { name: '看剧/电影', name_en: 'Movie', icon: '🎬', color: '#DC2626', description: '观看影视作品' },
      { name: '游戏', name_en: 'Gaming', icon: '🎮', color: '#B91C1C', description: '电子游戏' },
      { name: '听音乐', name_en: 'Music', icon: '🎵', color: '#991B1B', description: '听音乐放松' },
      { name: '逛街', name_en: 'Browse', icon: '🛍️', color: '#7F1D1D', description: '随意闲逛' },
      { name: '户外活动', name_en: 'Outdoor', icon: '🏕️', color: '#EF4444', description: '登山、露营等' },
      { name: '摄影', name_en: 'Photography', icon: '📷', color: '#F87171', description: '拍照创作' },
      { name: '刷视频', name_en: 'Videos', icon: '📺', color: '#FCA5A5', description: '看短视频或B站' },
      { name: '看展览', name_en: 'Exhibition', icon: '🖼️', color: '#FE2D2D', description: '艺术展、博物馆' },
    ],
  },
  '休息': {
    color: '#6366F1',
    icon: '😴',
    activities: [
      { name: '夜间睡眠', name_en: 'Sleep', icon: '🌙', color: '#4F46E5', description: '夜间深度睡眠' },
      { name: '放松休息', name_en: 'Relax', icon: '🛋️', color: '#4338CA', description: '无所事事的放松' },
      { name: '泡澡', name_en: 'Bath', icon: '🛁', color: '#3730A3', description: '泡澡放松' },
      { name: '发呆', name_en: 'Idle', icon: '☁️', color: '#312E81', description: '放空大脑' },
      { name: '晒太阳', name_en: 'Sun', icon: '☀️', color: '#EEF2FF', description: '享受阳光' },
    ],
  },
  '个人成长': {
    color: '#14B8A6',
    icon: '🌱',
    activities: [
      { name: '复盘反思', name_en: 'Reflect', icon: '🪞', color: '#0D9488', description: '回顾和反思' },
      { name: '目标规划', name_en: 'Planning', icon: '🎯', color: '#0F766E', description: '设定和规划目标' },
      { name: '日记', name_en: 'Journal', icon: '📓', color: '#115E59', description: '写日记记录' },
      { name: '理财', name_en: 'Finance', icon: '💰', color: '#134E4A', description: '财务管理和规划' },
      { name: '整理空间', name_en: 'Organize', icon: '🗂️', color: '#14B8A6', description: '整理工作/生活空间' },
      { name: '副业', name_en: 'Side Project', icon: '🚀', color: '#2DD4BF', description: '个人项目和副业' },
    ],
  },
};

/**
 * 预设标签
 */
const DEFAULT_TAGS = [
  { name: '高效', color: '#10B981' },
  { name: '低效', color: '#EF4444' },
  { name: '开心', color: '#F59E0B' },
  { name: '疲惫', color: '#6B7280' },
  { name: '专注', color: '#3B82F6' },
  { name: '分心', color: '#F97316' },
  { name: '创造', color: '#8B5CF6' },
  { name: '社交', color: '#EC4899' },
  { name: '独处', color: '#6366F1' },
  { name: '户外', color: '#059669' },
  { name: '室内', color: '#0284C7' },
  { name: '重要', color: '#DC2626' },
  { name: '紧急', color: '#B91C1C' },
  { name: '有趣', color: '#D946EF' },
  { name: '无聊', color: '#9CA3AF' },
];

/**
 * 预设习惯
 */
const DEFAULT_HABITS = [
  { name: '早起（7点前）', icon: '🌅', frequency: 'daily', color: '#F59E0B' },
  { name: '运动30分钟', icon: '💪', frequency: 'daily', color: '#10B981' },
  { name: '阅读30分钟', icon: '📖', frequency: 'daily', color: '#3B82F6' },
  { name: '冥想10分钟', icon: '🧘', frequency: 'daily', color: '#8B5CF6' },
  { name: '喝8杯水', icon: '💧', frequency: 'daily', color: '#06B6D4' },
  { name: '写日记', icon: '📝', frequency: 'daily', color: '#EC4899' },
  { name: '不刷社交媒体', icon: '📵', frequency: 'daily', color: '#EF4444' },
  { name: '学英语30分钟', icon: '🇬🇧', frequency: 'daily', color: '#6366F1' },
];

// ─── 种子数据生成器 ──────────────────────────────────────────

/**
 * 生成指定范围内的随机整数
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 从数组中随机选择一个元素
 */
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 生成模拟的一天时间记录
 * @param {string} date - 日期 YYYY-MM-DD
 * @param {Object[]} activities - 可用活动列表
 * @returns {Object[]} 时间记录数组
 */
function generateDayEntries(date, activities) {
  const entries = [];

  // 定义典型的一天时间分配（概率分布）
  const hourPatterns = {
    0:  { categories: ['休息'], minDuration: 60 },   // 深夜 - 睡觉
    1:  { categories: ['休息'], minDuration: 60 },
    2:  { categories: ['休息'], minDuration: 60 },
    3:  { categories: ['休息'], minDuration: 60 },
    4:  { categories: ['休息'], minDuration: 60 },
    5:  { categories: ['休息'], minDuration: 60 },
    6:  { categories: ['休息', '健康'], minDuration: 30 },  // 可能早起
    7:  { categories: ['生活', '健康'], minDuration: 30 },  // 起床、洗漱
    8:  { categories: ['生活', '工作'], minDuration: 30 },  // 早餐、通勤
    9:  { categories: ['工作'], minDuration: 60 },           // 上午工作
    10: { categories: ['工作'], minDuration: 60 },
    11: { categories: ['工作'], minDuration: 60 },
    12: { categories: ['生活', '社交'], minDuration: 45 },  // 午餐
    13: { categories: ['工作', '休息'], minDuration: 30 },  // 午休或工作
    14: { categories: ['工作'], minDuration: 60 },           // 下午工作
    15: { categories: ['工作', '学习'], minDuration: 60 },
    16: { categories: ['工作', '学习'], minDuration: 60 },
    17: { categories: ['工作', '健康'], minDuration: 30 },  // 下班或运动
    18: { categories: ['生活', '健康'], minDuration: 30 },  // 晚餐
    19: { categories: ['娱乐', '学习', '社交'], minDuration: 60 },  // 晚间活动
    20: { categories: ['娱乐', '学习', '个人成长'], minDuration: 60 },
    21: { categories: ['娱乐', '休息', '个人成长'], minDuration: 45 },
    22: { categories: ['生活', '休息'], minDuration: 30 },  // 洗澡、准备睡觉
    23: { categories: ['休息'], minDuration: 60 },           // 睡觉
  };

  for (let hour = 0; hour < 24; hour++) {
    const pattern = hourPatterns[hour];
    const category = randomChoice(pattern.categories);

    // 找到该分类下的活动
    const categoryActivities = activities.filter(a => a.category === category);
    if (categoryActivities.length === 0) continue;

    const activity = randomChoice(categoryActivities);

    entries.push({
      id: uuidv4(),
      date,
      hour,
      activity_id: activity.id,
      duration_min: pattern.minDuration + randomInt(0, 30),
      note: generateRandomNote(activity.name),
      intensity: randomInt(1, 5),
      location: generateRandomLocation(category),
    });
  }

  return entries;
}

/**
 * 生成随机备注
 */
function generateRandomNote(activityName) {
  const notes = {
    '深度工作': ['完成了一个重要方案', '专注了50分钟', 'Flow状态很好', '攻克了一个难题'],
    '会议': ['周会讨论项目进展', '1on1沟通', '头脑风暴', '客户电话会议'],
    '运动健身': ['胸部训练日', '跑了5公里', 'HIIT 30分钟', '核心训练'],
    '阅读': ['读完了第三章', '《原则》第150页', '学习新概念', '做了读书笔记'],
    '用餐': ['和同事一起吃', '尝试了新餐厅', '自己做的饭', '简餐'],
    '看剧/电影': ['追了一集新剧', '看了一部好电影', '纪录片很精彩'],
    '冥想': ['正念呼吸15分钟', '身体扫描练习', '很平静的体验'],
    '夜间睡眠': ['睡了7.5小时', '睡眠质量不错', '做了个梦'],
    '代码编写': ['修了一个bug', '写了新功能', '代码审查', '重构了一段代码'],
    '游戏': ['和朋友联机', '通关了一个关卡', '休闲游戏放松'],
  };

  const activityNotes = notes[activityName];
  if (activityNotes && Math.random() > 0.4) {
    return randomChoice(activityNotes);
  }
  return null;
}

/**
 * 生成随机地点
 */
function generateRandomLocation(category) {
  const locations = {
    '工作': ['办公室', '家里', '咖啡厅', '会议室', '共享空间'],
    '生活': ['家里', '超市', '商场', '菜市场'],
    '健康': ['健身房', '公园', '家里', '瑜伽馆', '游泳池'],
    '学习': ['图书馆', '家里', '咖啡厅', '书店'],
    '社交': ['餐厅', '家里', '咖啡厅', '酒吧', '公园'],
    '娱乐': ['家里', '电影院', '商场', '游戏厅'],
    '休息': ['家里', '卧室', '沙发'],
    '个人成长': ['家里', '书房', '咖啡厅'],
  };

  const locs = locations[category] || ['家里'];
  return Math.random() > 0.3 ? randomChoice(locs) : null;
}

/**
 * 生成心情记录
 */
function generateMoodEntries(date) {
  const entries = [];
  const moodPatterns = [
    { hours: [7, 8], moodBase: 6, energyBase: 5 },   // 早上
    { hours: [9, 10, 11], moodBase: 7, energyBase: 8 }, // 上午
    { hours: [12, 13], moodBase: 6, energyBase: 5 },   // 午间
    { hours: [14, 15, 16], moodBase: 6, energyBase: 6 }, // 下午
    { hours: [17, 18], moodBase: 7, energyBase: 5 },   // 傍晚
    { hours: [19, 20, 21], moodBase: 7, energyBase: 6 }, // 晚间
    { hours: [22, 23], moodBase: 5, energyBase: 3 },   // 深夜
  ];

  for (const pattern of moodPatterns) {
    for (const hour of pattern.hours) {
      if (Math.random() > 0.5) { // 不是每小时都记录
        entries.push({
          id: uuidv4(),
          date,
          hour,
          mood_score: Math.max(1, Math.min(10, pattern.moodBase + randomInt(-2, 2))),
          energy_level: Math.max(1, Math.min(10, pattern.energyBase + randomInt(-2, 2))),
          stress_level: randomInt(2, 8),
          focus_level: randomInt(3, 9),
          emotion_tags: JSON.stringify([]),
          note: null,
        });
      }
    }
  }
  return entries;
}

/**
 * 生成每日目标
 */
function generateDailyGoals(date) {
  const goalPool = [
    { title: '完成项目报告', category: '工作', targetValue: 1, unit: '份', priority: 5 },
    { title: '运动30分钟', category: '健康', targetValue: 30, unit: '分钟', priority: 4 },
    { title: '阅读30页', category: '学习', targetValue: 30, unit: '页', priority: 3 },
    { title: '冥想10分钟', category: '健康', targetValue: 10, unit: '分钟', priority: 3 },
    { title: '写日记', category: '个人成长', targetValue: 1, unit: '篇', priority: 2 },
    { title: '整理桌面', category: '生活', targetValue: 1, unit: '次', priority: 2 },
    { title: '学习英语30分钟', category: '学习', targetValue: 30, unit: '分钟', priority: 3 },
    { title: '喝水2升', category: '健康', targetValue: 2000, unit: 'ml', priority: 4 },
    { title: '早睡（23点前）', category: '生活', targetValue: 1, unit: '次', priority: 3 },
    { title: '不刷社交媒体', category: '个人成长', targetValue: 1, unit: '天', priority: 4 },
  ];

  // 每天随机选3-5个目标
  const count = randomInt(3, 5);
  const shuffled = [...goalPool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  return selected.map((goal, index) => ({
    id: uuidv4(),
    date,
    title: goal.title,
    description: null,
    category: goal.category,
    target_value: goal.targetValue,
    current_value: Math.random() > 0.4 ? goal.targetValue * (Math.random() * 0.8 + 0.2) : 0,
    unit: goal.unit,
    priority: goal.priority,
    is_completed: Math.random() > 0.5 ? 1 : 0,
    completed_at: null,
    due_time: null,
  }));
}

/**
 * 生成每日总结
 */
function generateDailySummary(date) {
  const highlights = [
    '完成了一个重要的项目里程碑',
    '运动感觉很棒，精力充沛',
    '读了一本很有启发的书',
    '和朋友度过了愉快的时光',
    '学习了新技能，很有成就感',
    '冥想后感觉非常平静',
    '做了一顿美味的晚餐',
    '早起看到了美丽的日出',
  ];

  const gratitudes = [
    '感恩健康的身体',
    '感恩家人的陪伴',
    '感恩有学习的机会',
    '感恩今天的好天气',
    '感恩同事的帮助',
    '感恩有温暖的家',
  ];

  return {
    id: uuidv4(),
    date,
    overall_score: randomInt(5, 9),
    highlight: randomChoice(highlights),
    lowlight: Math.random() > 0.5 ? '时间管理还可以更好' : null,
    gratitude: randomChoice(gratitudes),
    lesson: '专注力是有限的资源，需要合理分配',
    tomorrow_plan: '继续推进项目，注意休息',
    sleep_hours: 6.5 + Math.random() * 2,
    water_intake: randomInt(1200, 2500),
    exercise_min: Math.random() > 0.3 ? randomInt(15, 60) : 0,
    screen_time: randomInt(240, 600),
  };
}

// ─── 主种子函数 ──────────────────────────────────────────────

/**
 * 填充数据库种子数据
 * @param {Object} options - 配置选项
 * @param {number} options.days - 生成最近几天的数据（默认7天）
 * @param {boolean} options.force - 是否强制重新填充
 */
export function seedDatabase(options = {}) {
  const { days = 7, force = false } = options;
  const db = getDatabase();

  // 检查是否已有数据
  const activityCount = db.prepare('SELECT COUNT(*) as count FROM activities').get().count;
  if (activityCount > 0 && !force) {
    console.log(`ℹ️  数据库已有 ${activityCount} 个活动，跳过种子数据填充`);
    return;
  }

  if (force) {
    console.log('🔄 强制重新填充种子数据...');
    db.exec('DELETE FROM tag_relations');
    db.exec('DELETE FROM habit_logs');
    db.exec('DELETE FROM habits');
    db.exec('DELETE FROM moods');
    db.exec('DELETE FROM daily_goals');
    db.exec('DELETE FROM daily_summaries');
    db.exec('DELETE FROM time_entries');
    db.exec('DELETE FROM tags');
    db.exec('DELETE FROM activities');
  }

  const insertActivity = db.prepare(`
    INSERT INTO activities (id, name, name_en, category, color, icon, description, is_favorite, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTimeEntry = db.prepare(`
    INSERT OR IGNORE INTO time_entries (id, date, hour, activity_id, duration_min, note, intensity, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMood = db.prepare(`
    INSERT OR IGNORE INTO moods (id, date, hour, mood_score, energy_level, stress_level, focus_level, emotion_tags, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertGoal = db.prepare(`
    INSERT INTO daily_goals (id, date, title, description, category, target_value, current_value, unit, priority, is_completed, completed_at, due_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSummary = db.prepare(`
    INSERT OR REPLACE INTO daily_summaries (id, date, overall_score, highlight, lowlight, gratitude, lesson, tomorrow_plan, sleep_hours, water_intake, exercise_min, screen_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO tags (id, name, color) VALUES (?, ?, ?)
  `);

  const insertHabit = db.prepare(`
    INSERT INTO habits (id, name, description, frequency, target_days, icon, color, streak, best_streak, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // ── 使用事务批量插入 ──
  const allActivities = [];

  const seedAll = db.transaction(() => {
    // 1) 插入活动
    let sortOrder = 0;
    for (const [category, data] of Object.entries(ACTIVITY_CATEGORIES)) {
      for (const act of data.activities) {
        const id = uuidv4();
        insertActivity.run(
          id, act.name, act.name_en || null, category,
          act.color, act.icon, act.description,
          Math.random() > 0.7 ? 1 : 0, sortOrder++
        );
        allActivities.push({ id, name: act.name, category });
      }
    }
    console.log(`  📋 插入了 ${allActivities.length} 个活动类型`);

    // 2) 插入标签
    for (const tag of DEFAULT_TAGS) {
      insertTag.run(uuidv4(), tag.name, tag.color);
    }
    console.log(`  🏷️  插入了 ${DEFAULT_TAGS.length} 个标签`);

    // 3) 插入习惯
    for (const habit of DEFAULT_HABITS) {
      insertHabit.run(
        uuidv4(), habit.name, null, habit.frequency,
        JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
        habit.icon, habit.color, 0, 0, 1
      );
    }
    console.log(`  ✅ 插入了 ${DEFAULT_HABITS.length} 个习惯`);

    // 4) 生成最近 N 天的数据
    const today = new Date();
    let totalEntries = 0;
    let totalMoods = 0;
    let totalGoals = 0;

    for (let d = 0; d < days; d++) {
      const date = format(subDays(today, d), 'yyyy-MM-dd');

      // 时间记录
      const entries = generateDayEntries(date, allActivities);
      for (const entry of entries) {
        insertTimeEntry.run(
          entry.id, entry.date, entry.hour, entry.activity_id,
          entry.duration_min, entry.note, entry.intensity, entry.location
        );
      }
      totalEntries += entries.length;

      // 心情记录
      const moods = generateMoodEntries(date);
      for (const mood of moods) {
        insertMood.run(
          mood.id, mood.date, mood.hour, mood.mood_score,
          mood.energy_level, mood.stress_level, mood.focus_level,
          mood.emotion_tags, mood.note
        );
      }
      totalMoods += moods.length;

      // 每日目标
      const goals = generateDailyGoals(date);
      for (const goal of goals) {
        insertGoal.run(
          goal.id, goal.date, goal.title, goal.description,
          goal.category, goal.target_value, goal.current_value,
          goal.unit, goal.priority, goal.is_completed,
          goal.is_completed ? new Date().toISOString() : null,
          goal.due_time
        );
      }
      totalGoals += goals.length;

      // 每日总结（最近3天有总结）
      if (d < 3) {
        const summary = generateDailySummary(date);
        insertSummary.run(
          summary.id, summary.date, summary.overall_score,
          summary.highlight, summary.lowlight, summary.gratitude,
          summary.lesson, summary.tomorrow_plan, summary.sleep_hours,
          summary.water_intake, summary.exercise_min, summary.screen_time
        );
      }
    }

    console.log(`  ⏰ 插入了 ${totalEntries} 条时间记录`);
    console.log(`  😊 插入了 ${totalMoods} 条心情记录`);
    console.log(`  🎯 插入了 ${totalGoals} 条每日目标`);
    console.log(`  📊 插入了 ${Math.min(days, 3)} 条每日总结`);
  });

  seedAll();
  saveDatabase();

  console.log(`✅ 种子数据填充完成（最近 ${days} 天）`);
}

// ── 直接运行时执行种子 ──
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('seed.js') ||
  process.argv[1].endsWith('seed')
);

if (isMainModule) {
  const { initializeDatabase } = await import('./database.js');
  const dbPath = process.env.DB_PATH || './data/yi-tian.db';
  initializeDatabase(dbPath);
  seedDatabase({ force: process.argv.includes('--force'), days: parseInt(process.argv.find((_, i, a) => a[i-1] === '--days') || '7') });
}

export default { seedDatabase, ACTIVITY_CATEGORIES };
