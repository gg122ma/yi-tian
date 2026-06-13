/**
 * ═══════════════════════════════════════════════════════════════
 *  一天 · API 路由层（Routes Layer）
 * ═══════════════════════════════════════════════════════════════
 *  RESTful API 端点：活动 · 时间轴 · 目标 · 心情 · 统计 · 习惯 · 设置
 * ═══════════════════════════════════════════════════════════════
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, differenceInMinutes } from 'date-fns';

import { getDatabase, runTransaction, saveDatabase } from '../db/database.js';
import {
  asyncHandler,
  responseFormatter,
  validateBody,
  validateQuery,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../middleware/index.js';

// ─── 主路由 ──────────────────────────────────────────────────

export const apiRouter = Router();

// 全局中间件
apiRouter.use(responseFormatter);

// 写操作后自动持久化数据库（sql.js 是内存数据库，需要显式保存）
apiRouter.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        try { saveDatabase(); } catch (e) { console.error('自动保存失败:', e.message); }
      }
    });
  }
  next();
});

// ─────────────────────────────────────────────────────────────
//  📋 活动管理（Activities）
// ─────────────────────────────────────────────────────────────

const activitiesRouter = Router();

// GET /api/activities - 获取所有活动
activitiesRouter.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { category, favorite, search, sort = 'sort_order', order = 'asc' } = req.query;

  let sql = 'SELECT * FROM activities WHERE 1=1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  if (favorite === 'true' || favorite === '1') {
    sql += ' AND is_favorite = 1';
  }

  if (search) {
    sql += ' AND (name LIKE ? OR name_en LIKE ? OR description LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // 排序
  const validSortFields = ['name', 'category', 'usage_count', 'total_minutes', 'sort_order', 'created_at'];
  const sortField = validSortFields.includes(sort) ? sort : 'sort_order';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
  sql += ` ORDER BY ${sortField} ${sortOrder}`;

  const activities = db.prepare(sql).all(...params);

  // 按分类分组
  const grouped = {};
  for (const activity of activities) {
    if (!grouped[activity.category]) {
      grouped[activity.category] = [];
    }
    grouped[activity.category].push(activity);
  }

  res.success({ activities, grouped, total: activities.length });
}));

// GET /api/activities/categories - 获取所有分类
activitiesRouter.get('/categories', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const categories = db.prepare(`
    SELECT category, COUNT(*) as count,
           GROUP_CONCAT(DISTINCT icon) as icons
    FROM activities
    GROUP BY category
    ORDER BY count DESC
  `).all();

  res.success(categories);
}));

// GET /api/activities/:id - 获取单个活动
activitiesRouter.get('/:id', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);

  if (!activity) {
    throw new NotFoundError('活动', req.params.id);
  }

  // 获取使用统计
  const stats = db.prepare(`
    SELECT COUNT(*) as entry_count,
           COALESCE(SUM(duration_min), 0) as total_minutes,
           MIN(date) as first_used,
           MAX(date) as last_used
    FROM time_entries
    WHERE activity_id = ?
  `).get(req.params.id);

  res.success({ ...activity, stats });
}));

// POST /api/activities - 创建新活动
activitiesRouter.post('/', validateBody({
  name: { required: true, type: 'string', label: '活动名称', minLength: 1, maxLength: 50 },
  category: { required: true, type: 'string', label: '分类' },
  color: { type: 'string', label: '颜色', pattern: /^#[0-9A-Fa-f]{6}$/ },
  icon: { type: 'string', label: '图标', maxLength: 10 },
  description: { type: 'string', label: '描述', maxLength: 200 },
}), asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { name, name_en, category, color = '#6c757d', icon = '📌', description } = req.body;

  // 检查是否重名
  const existing = db.prepare('SELECT id FROM activities WHERE name = ? AND category = ?').get(name, category);
  if (existing) {
    throw new ConflictError(`活动"${name}"在分类"${category}"中已存在`);
  }

  const id = uuidv4();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM activities').get();

  db.prepare(`
    INSERT INTO activities (id, name, name_en, category, color, icon, description, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, name_en || null, category, color, icon, description || null, (maxOrder.max_order || 0) + 1);

  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  res.created(activity, '活动创建成功');
}));

// PUT /api/activities/:id - 更新活动
activitiesRouter.put('/:id', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { name, name_en, category, color, icon, description, is_favorite, sort_order } = req.body;

  const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!existing) {
    throw new NotFoundError('活动', req.params.id);
  }

  db.prepare(`
    UPDATE activities SET
      name = COALESCE(?, name),
      name_en = COALESCE(?, name_en),
      category = COALESCE(?, category),
      color = COALESCE(?, color),
      icon = COALESCE(?, icon),
      description = COALESCE(?, description),
      is_favorite = COALESCE(?, is_favorite),
      sort_order = COALESCE(?, sort_order),
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(name, name_en, category, color, icon, description, is_favorite, sort_order, req.params.id);

  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  res.success(activity, '活动更新成功');
}));

// PATCH /api/activities/:id/favorite - 切换收藏
activitiesRouter.patch('/:id/favorite', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) throw new NotFoundError('活动', req.params.id);

  const newFavorite = activity.is_favorite ? 0 : 1;
  db.prepare('UPDATE activities SET is_favorite = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
    .run(newFavorite, req.params.id);

  res.success({ id: req.params.id, is_favorite: newFavorite }, newFavorite ? '已收藏' : '已取消收藏');
}));

// DELETE /api/activities/:id - 删除活动
activitiesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) throw new NotFoundError('活动', req.params.id);

  // 检查是否有关联的时间记录
  const entryCount = db.prepare('SELECT COUNT(*) as count FROM time_entries WHERE activity_id = ?').get(req.params.id);
  if (entryCount.count > 0 && req.query.force !== 'true') {
    throw new ConflictError(`该活动有 ${entryCount.count} 条时间记录，使用 ?force=true 强制删除`);
  }

  db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
  res.success(null, `活动"${activity.name}"已删除`);
}));

apiRouter.use('/activities', activitiesRouter);

// ─────────────────────────────────────────────────────────────
//  ⏰ 时间轴（Timeline）
// ─────────────────────────────────────────────────────────────

const timelineRouter = Router();

// GET /api/timeline/:date - 获取某天的时间轴
timelineRouter.get('/:date', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { date } = req.params;

  // 验证日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('日期格式应为 YYYY-MM-DD');
  }

  const entries = db.prepare(`
    SELECT te.*, a.name as activity_name, a.color as activity_color,
           a.icon as activity_icon, a.category as activity_category
    FROM time_entries te
    JOIN activities a ON te.activity_id = a.id
    WHERE te.date = ?
    ORDER BY te.hour ASC
  `).all(date);

  // 构建24小时完整视图
  const timeline = [];
  for (let hour = 0; hour < 24; hour++) {
    const entry = entries.find(e => e.hour === hour);
    timeline.push({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      entry: entry || null,
      isEmpty: !entry,
    });
  }

  // 获取当天目标
  const goals = db.prepare('SELECT * FROM daily_goals WHERE date = ? ORDER BY priority DESC').all(date);

  // 获取当天心情
  const moods = db.prepare('SELECT * FROM moods WHERE date = ? ORDER BY hour ASC').all(date);

  // 获取当天总结
  const summary = db.prepare('SELECT * FROM daily_summaries WHERE date = ?').get(date);

  // 计算当天统计
  const dayStats = calculateDayStats(db, date);

  res.success({ date, timeline, goals, moods, summary, stats: dayStats });
}));

// POST /api/timeline - 添加时间记录
timelineRouter.post('/', validateBody({
  date: { required: true, type: 'string', label: '日期', pattern: /^\d{4}-\d{2}-\d{2}$/ },
  hour: { required: true, type: 'number', label: '小时', min: 0, max: 23 },
  activity_id: { required: true, type: 'string', label: '活动ID' },
  intensity: { type: 'number', label: '强度', min: 1, max: 5 },
}), asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { date, hour, activity_id, duration_min = 60, note, intensity = 3, location } = req.body;

  // 验证活动存在
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activity_id);
  if (!activity) throw new NotFoundError('活动', activity_id);

  // 检查是否已有记录
  const existing = db.prepare('SELECT id FROM time_entries WHERE date = ? AND hour = ?').get(date, hour);
  if (existing) {
    // 更新现有记录
    db.prepare(`
      UPDATE time_entries SET
        activity_id = ?, duration_min = ?, note = ?, intensity = ?, location = ?,
        updated_at = datetime('now', 'localtime')
      WHERE date = ? AND hour = ?
    `).run(activity_id, duration_min, note || null, intensity, location || null, date, hour);
  } else {
    // 创建新记录
    const id = uuidv4();
    db.prepare(`
      INSERT INTO time_entries (id, date, hour, activity_id, duration_min, note, intensity, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, date, hour, activity_id, duration_min, note || null, intensity, location || null);
  }

  // 更新活动使用统计
  db.prepare(`
    UPDATE activities SET
      usage_count = usage_count + 1,
      total_minutes = total_minutes + ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(duration_min, activity_id);

  const entry = db.prepare(`
    SELECT te.*, a.name as activity_name, a.color as activity_color, a.icon as activity_icon
    FROM time_entries te JOIN activities a ON te.activity_id = a.id
    WHERE te.date = ? AND te.hour = ?
  `).get(date, hour);

  res.success(entry, '时间记录已保存');
}));

// DELETE /api/timeline/:date/:hour - 删除时间记录
timelineRouter.delete('/:date/:hour', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { date, hour } = req.params;

  const entry = db.prepare('SELECT * FROM time_entries WHERE date = ? AND hour = ?').get(date, parseInt(hour));
  if (!entry) throw new NotFoundError('时间记录');

  db.prepare('DELETE FROM time_entries WHERE date = ? AND hour = ?').run(date, parseInt(hour));
  res.success(null, `${date} ${hour}:00 的记录已删除`);
}));

// POST /api/timeline/copy - 复制一天的记录到另一天
timelineRouter.post('/copy', validateBody({
  source_date: { required: true, type: 'string', label: '源日期' },
  target_date: { required: true, type: 'string', label: '目标日期' },
}), asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { source_date, target_date } = req.body;

  const sourceEntries = db.prepare('SELECT * FROM time_entries WHERE date = ?').all(source_date);
  if (sourceEntries.length === 0) {
    throw new NotFoundError(`${source_date} 没有时间记录`);
  }

  // 删除目标日期现有记录
  db.prepare('DELETE FROM time_entries WHERE date = ?').run(target_date);

  // 复制记录
  const insertStmt = db.prepare(`
    INSERT INTO time_entries (id, date, hour, activity_id, duration_min, note, intensity, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const copyAll = db.transaction(() => {
    for (const entry of sourceEntries) {
      insertStmt.run(uuidv4(), target_date, entry.hour, entry.activity_id, entry.duration_min, entry.note, entry.intensity, entry.location);
    }
  });
  copyAll();

  res.success({ source_date, target_date, copied: sourceEntries.length }, `已复制 ${sourceEntries.length} 条记录`);
}));

apiRouter.use('/timeline', timelineRouter);

// ─────────────────────────────────────────────────────────────
//  🎯 每日目标（Goals）
// ─────────────────────────────────────────────────────────────

const goalsRouter = Router();

// GET /api/goals/:date - 获取某天的目标
goalsRouter.get('/:date', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const goals = db.prepare('SELECT * FROM daily_goals WHERE date = ? ORDER BY priority DESC, created_at ASC').all(req.params.date);

  const completed = goals.filter(g => g.is_completed).length;
  const total = goals.length;

  res.success({ goals, completed, total, completionRate: total > 0 ? Math.round(completed / total * 100) : 0 });
}));

// POST /api/goals - 创建目标
goalsRouter.post('/', validateBody({
  date: { required: true, type: 'string', label: '日期' },
  title: { required: true, type: 'string', label: '目标标题', minLength: 1, maxLength: 100 },
  category: { type: 'string', label: '分类' },
  priority: { type: 'number', label: '优先级', min: 1, max: 5 },
}), asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { date, title, description, category = '个人', target_value, unit, priority = 3, due_time } = req.body;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO daily_goals (id, date, title, description, category, target_value, current_value, unit, priority, due_time)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(id, date, title, description || null, category, target_value || null, unit || null, priority, due_time || null);

  const goal = db.prepare('SELECT * FROM daily_goals WHERE id = ?').get(id);
  res.created(goal, '目标创建成功');
}));

// PATCH /api/goals/:id/complete - 切换完成状态
goalsRouter.patch('/:id/complete', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const goal = db.prepare('SELECT * FROM daily_goals WHERE id = ?').get(req.params.id);
  if (!goal) throw new NotFoundError('目标', req.params.id);

  const newCompleted = goal.is_completed ? 0 : 1;
  db.prepare(`
    UPDATE daily_goals SET is_completed = ?, completed_at = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
  `).run(newCompleted, newCompleted ? new Date().toISOString() : null, req.params.id);

  res.success({ id: req.params.id, is_completed: newCompleted }, newCompleted ? '目标已完成' : '已标记为未完成');
}));

// PUT /api/goals/:id - 更新目标
goalsRouter.put('/:id', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const goal = db.prepare('SELECT * FROM daily_goals WHERE id = ?').get(req.params.id);
  if (!goal) throw new NotFoundError('目标', req.params.id);

  const { title, description, category, target_value, current_value, unit, priority, due_time } = req.body;

  db.prepare(`
    UPDATE daily_goals SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      category = COALESCE(?, category),
      target_value = COALESCE(?, target_value),
      current_value = COALESCE(?, current_value),
      unit = COALESCE(?, unit),
      priority = COALESCE(?, priority),
      due_time = COALESCE(?, due_time),
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(title, description, category, target_value, current_value, unit, priority, due_time, req.params.id);

  const updated = db.prepare('SELECT * FROM daily_goals WHERE id = ?').get(req.params.id);
  res.success(updated, '目标更新成功');
}));

// DELETE /api/goals/:id - 删除目标
goalsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const goal = db.prepare('SELECT * FROM daily_goals WHERE id = ?').get(req.params.id);
  if (!goal) throw new NotFoundError('目标', req.params.id);

  db.prepare('DELETE FROM daily_goals WHERE id = ?').run(req.params.id);
  res.success(null, '目标已删除');
}));

apiRouter.use('/goals', goalsRouter);

// ─────────────────────────────────────────────────────────────
//  😊 心情追踪（Moods）
// ─────────────────────────────────────────────────────────────

const moodsRouter = Router();

// GET /api/moods/:date - 获取某天的心情
moodsRouter.get('/:date', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const moods = db.prepare('SELECT * FROM moods WHERE date = ? ORDER BY hour ASC').all(req.params.date);

  // 计算平均值
  const averages = moods.length > 0 ? {
    mood_score: Math.round(moods.reduce((s, m) => s + m.mood_score, 0) / moods.length * 10) / 10,
    energy_level: Math.round(moods.reduce((s, m) => s + m.energy_level, 0) / moods.length * 10) / 10,
    stress_level: Math.round(moods.reduce((s, m) => s + m.stress_level, 0) / moods.length * 10) / 10,
    focus_level: Math.round(moods.reduce((s, m) => s + m.focus_level, 0) / moods.length * 10) / 10,
  } : null;

  res.success({ moods, averages, count: moods.length });
}));

// POST /api/moods - 记录心情
moodsRouter.post('/', validateBody({
  date: { required: true, type: 'string', label: '日期' },
  hour: { required: true, type: 'number', label: '小时', min: 0, max: 23 },
  mood_score: { required: true, type: 'number', label: '心情评分', min: 1, max: 10 },
  energy_level: { required: true, type: 'number', label: '精力水平', min: 1, max: 10 },
}), asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { date, hour, mood_score, energy_level, stress_level = 5, focus_level = 5, emotion_tags, note } = req.body;

  const existing = db.prepare('SELECT id FROM moods WHERE date = ? AND hour = ?').get(date, hour);

  if (existing) {
    db.prepare(`
      UPDATE moods SET mood_score = ?, energy_level = ?, stress_level = ?, focus_level = ?,
                       emotion_tags = ?, note = ? WHERE date = ? AND hour = ?
    `).run(mood_score, energy_level, stress_level, focus_level,
      emotion_tags ? JSON.stringify(emotion_tags) : null, note || null, date, hour);
  } else {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO moods (id, date, hour, mood_score, energy_level, stress_level, focus_level, emotion_tags, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, date, hour, mood_score, energy_level, stress_level, focus_level,
      emotion_tags ? JSON.stringify(emotion_tags) : null, note || null);
  }

  const mood = db.prepare('SELECT * FROM moods WHERE date = ? AND hour = ?').get(date, hour);
  res.success(mood, '心情已记录');
}));

// GET /api/moods/range - 获取日期范围的心情趋势
moodsRouter.get('/range/summary', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { start, end } = req.query;

  if (!start || !end) {
    throw new ValidationError('需要 start 和 end 参数');
  }

  const moods = db.prepare(`
    SELECT date,
           AVG(mood_score) as avg_mood,
           AVG(energy_level) as avg_energy,
           AVG(stress_level) as avg_stress,
           AVG(focus_level) as avg_focus,
           COUNT(*) as entries
    FROM moods WHERE date >= ? AND date <= ?
    GROUP BY date ORDER BY date ASC
  `).all(start, end);

  res.success(moods);
}));

apiRouter.use('/moods', moodsRouter);

// ─────────────────────────────────────────────────────────────
//  📊 统计分析（Statistics）
// ─────────────────────────────────────────────────────────────

const statsRouter = Router();

// GET /api/stats/daily/:date - 日统计
statsRouter.get('/daily/:date', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const stats = calculateDayStats(db, req.params.date);
  res.success(stats);
}));

// GET /api/stats/weekly/:date - 周统计
statsRouter.get('/weekly/:date', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const targetDate = parseISO(req.params.date);
  const weekStart = format(startOfWeek(targetDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(targetDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // 每天的活动时间分布
  const dailyBreakdown = db.prepare(`
    SELECT te.date, a.category, SUM(te.duration_min) as total_minutes
    FROM time_entries te
    JOIN activities a ON te.activity_id = a.id
    WHERE te.date >= ? AND te.date <= ?
    GROUP BY te.date, a.category
    ORDER BY te.date ASC
  `).all(weekStart, weekEnd);

  // 分类汇总
  const categorySummary = db.prepare(`
    SELECT a.category,
           COUNT(*) as entries,
           SUM(te.duration_min) as total_minutes,
           AVG(te.intensity) as avg_intensity
    FROM time_entries te
    JOIN activities a ON te.activity_id = a.id
    WHERE te.date >= ? AND te.date <= ?
    GROUP BY a.category
    ORDER BY total_minutes DESC
  `).all(weekStart, weekEnd);

  // 每日心情趋势
  const moodTrend = db.prepare(`
    SELECT date, AVG(mood_score) as avg_mood, AVG(energy_level) as avg_energy
    FROM moods WHERE date >= ? AND date <= ?
    GROUP BY date ORDER BY date ASC
  `).all(weekStart, weekEnd);

  // 目标完成率
  const goalStats = db.prepare(`
    SELECT date,
           COUNT(*) as total,
           SUM(is_completed) as completed
    FROM daily_goals
    WHERE date >= ? AND date <= ?
    GROUP BY date ORDER BY date ASC
  `).all(weekStart, weekEnd);

  res.success({
    weekStart,
    weekEnd,
    dailyBreakdown,
    categorySummary,
    moodTrend,
    goalStats,
  });
}));

// GET /api/stats/monthly/:year/:month - 月统计
statsRouter.get('/monthly/:year/:month', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { year, month } = req.params;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');

  // 活动热力图数据
  const heatmapData = db.prepare(`
    SELECT date, hour, a.category, te.duration_min, a.color
    FROM time_entries te
    JOIN activities a ON te.activity_id = a.id
    WHERE te.date >= ? AND te.date <= ?
    ORDER BY te.date, te.hour
  `).all(monthStart, monthEnd);

  // 分类统计
  const categoryStats = db.prepare(`
    SELECT a.category,
           COUNT(DISTINCT te.date) as active_days,
           COUNT(*) as total_entries,
           SUM(te.duration_min) as total_minutes,
           ROUND(SUM(te.duration_min) * 100.0 / (SELECT SUM(duration_min) FROM time_entries WHERE date >= ? AND date <= ?), 1) as percentage
    FROM time_entries te
    JOIN activities a ON te.activity_id = a.id
    WHERE te.date >= ? AND date <= ?
    GROUP BY a.category
    ORDER BY total_minutes DESC
  `).all(monthStart, monthEnd, monthStart, monthEnd);

  // 最常用的活动 Top 10
  const topActivities = db.prepare(`
    SELECT a.name, a.icon, a.category, a.color,
           COUNT(*) as entry_count,
           SUM(te.duration_min) as total_minutes
    FROM time_entries te
    JOIN activities a ON te.activity_id = a.id
    WHERE te.date >= ? AND te.date <= ?
    GROUP BY a.id
    ORDER BY total_minutes DESC
    LIMIT 10
  `).all(monthStart, monthEnd);

  // 心情月度趋势
  const moodMonthly = db.prepare(`
    SELECT date, AVG(mood_score) as avg_mood, AVG(energy_level) as avg_energy,
           AVG(stress_level) as avg_stress
    FROM moods WHERE date >= ? AND date <= ?
    GROUP BY date ORDER BY date ASC
  `).all(monthStart, monthEnd);

  // 每日总结汇总
  const summaries = db.prepare(`
    SELECT * FROM daily_summaries
    WHERE date >= ? AND date <= ?
    ORDER BY date ASC
  `).all(monthStart, monthEnd);

  res.success({
    year: parseInt(year),
    month: parseInt(month),
    monthStart,
    monthEnd,
    heatmapData,
    categoryStats,
    topActivities,
    moodMonthly,
    summaries,
  });
}));

// GET /api/stats/overview - 总览统计
statsRouter.get('/overview', asyncHandler(async (req, res) => {
  const db = getDatabase();

  // 总记录天数
  const dayCount = db.prepare('SELECT COUNT(DISTINCT date) as count FROM time_entries').get().count;

  // 总记录条数
  const totalEntries = db.prepare('SELECT COUNT(*) as count FROM time_entries').get().count;

  // 总时间（小时）
  const totalTime = db.prepare('SELECT COALESCE(SUM(duration_min), 0) as minutes FROM time_entries').get().minutes;

  // 各分类总时间
  const categoryTime = db.prepare(`
    SELECT a.category, SUM(te.duration_min) as total_minutes, COUNT(*) as entries
    FROM time_entries te JOIN activities a ON te.activity_id = a.id
    GROUP BY a.category ORDER BY total_minutes DESC
  `).all();

  // 平均心情
  const avgMood = db.prepare(`
    SELECT AVG(mood_score) as mood, AVG(energy_level) as energy,
           AVG(stress_level) as stress, AVG(focus_level) as focus
    FROM moods
  `).get();

  // 目标完成统计
  const goalOverview = db.prepare(`
    SELECT COUNT(*) as total, SUM(is_completed) as completed
    FROM daily_goals
  `).get();

  // 连续记录天数
  const dates = db.prepare('SELECT DISTINCT date FROM time_entries ORDER BY date DESC').all().map(r => r.date);
  let streak = 0;
  const today = format(new Date(), 'yyyy-MM-dd');
  for (let i = 0; i < dates.length; i++) {
    const expectedDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (dates[i] === expectedDate) {
      streak++;
    } else {
      break;
    }
  }

  res.success({
    dayCount,
    totalEntries,
    totalHours: Math.round(totalTime / 60),
    totalMinutes: totalTime,
    categoryTime,
    avgMood,
    goalOverview: {
      ...goalOverview,
      completionRate: goalOverview.total > 0 ? Math.round(goalOverview.completed / goalOverview.total * 100) : 0,
    },
    currentStreak: streak,
  });
}));

// GET /api/stats/export - 导出数据
statsRouter.get('/export', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { format: exportFormat = 'json', start, end } = req.query;

  let dateFilter = '';
  const params = [];
  if (start && end) {
    dateFilter = 'WHERE te.date >= ? AND te.date <= ?';
    params.push(start, end);
  }

  const entries = db.prepare(`
    SELECT te.*, a.name as activity_name, a.category, a.icon
    FROM time_entries te
    JOIN activities a ON te.activity_id = a.id
    ${dateFilter}
    ORDER BY te.date DESC, te.hour ASC
  `).all(...params);

  if (exportFormat === 'csv') {
    // CSV 导出
    const headers = ['日期', '小时', '活动', '分类', '时长(分钟)', '强度', '备注', '地点'];
    const rows = entries.map(e => [
      e.date, e.hour, e.activity_name, e.category, e.duration_min, e.intensity, e.note || '', e.location || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=yi-tian-export-${format(new Date(), 'yyyyMMdd')}.csv`);
    res.send('﻿' + csv); // BOM for Excel
  } else {
    res.success(entries, `导出了 ${entries.length} 条记录`);
  }
}));

apiRouter.use('/stats', statsRouter);

// ─────────────────────────────────────────────────────────────
//  ✅ 习惯追踪（Habits）
// ─────────────────────────────────────────────────────────────

const habitsRouter = Router();

// GET /api/habits - 获取所有习惯
habitsRouter.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const habits = db.prepare('SELECT * FROM habits WHERE is_active = 1 ORDER BY created_at ASC').all();

  // 获取每个习惯的最近记录
  const enriched = habits.map(habit => {
    const logs = db.prepare('SELECT * FROM habit_logs WHERE habit_id = ? ORDER BY date DESC LIMIT 30').all(habit.id);
    const todayLog = db.prepare('SELECT * FROM habit_logs WHERE habit_id = ? AND date = date(\'now\', \'localtime\')').get(habit.id);
    return { ...habit, logs, isCompletedToday: !!todayLog };
  });

  res.success(enriched);
}));

// POST /api/habits - 创建习惯
habitsRouter.post('/', validateBody({
  name: { required: true, type: 'string', label: '习惯名称' },
  frequency: { type: 'string', label: '频率', enum: ['daily', 'weekly', 'monthly'] },
}), asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { name, description, frequency = 'daily', icon = '✅', color = '#4CAF50', target_days } = req.body;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO habits (id, name, description, frequency, target_days, icon, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description || null, frequency, target_days ? JSON.stringify(target_days) : null, icon, color);

  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
  res.created(habit, '习惯创建成功');
}));

// POST /api/habits/:id/log - 记录习惯完成
habitsRouter.post('/:id/log', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(req.params.id);
  if (!habit) throw new NotFoundError('习惯', req.params.id);

  const { date = format(new Date(), 'yyyy-MM-dd'), note } = req.body;
  const existing = db.prepare('SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?').get(req.params.id, date);

  if (existing) {
    throw new ConflictError('该日期已有记录');
  }

  const id = uuidv4();
  db.prepare('INSERT INTO habit_logs (id, habit_id, date, completed, note) VALUES (?, ?, ?, 1, ?)')
    .run(id, req.params.id, date, note || null);

  // 更新连续天数
  updateHabitStreak(db, req.params.id);

  res.success({ id, habit_id: req.params.id, date }, '习惯记录已保存');
}));

// DELETE /api/habits/:id/log/:date - 删除习惯记录
habitsRouter.delete('/:id/log/:date', asyncHandler(async (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?').run(req.params.id, req.params.date);
  updateHabitStreak(db, req.params.id);
  res.success(null, '记录已删除');
}));

apiRouter.use('/habits', habitsRouter);

// ─────────────────────────────────────────────────────────────
//  📝 每日总结（Summaries）
// ─────────────────────────────────────────────────────────────

const summariesRouter = Router();

// GET /api/summaries/:date - 获取某天的总结
summariesRouter.get('/:date', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const summary = db.prepare('SELECT * FROM daily_summaries WHERE date = ?').get(req.params.date);
  if (!summary) throw new NotFoundError('每日总结');
  res.success(summary);
}));

// POST /api/summaries - 创建/更新总结
summariesRouter.post('/', validateBody({
  date: { required: true, type: 'string', label: '日期' },
  overall_score: { type: 'number', label: '评分', min: 1, max: 10 },
}), asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { date, overall_score, highlight, lowlight, gratitude, lesson, tomorrow_plan, sleep_hours, water_intake, exercise_min, screen_time } = req.body;

  const existing = db.prepare('SELECT id FROM daily_summaries WHERE date = ?').get(date);
  const id = existing ? existing.id : uuidv4();

  if (existing) {
    db.prepare(`
      UPDATE daily_summaries SET
        overall_score = COALESCE(?, overall_score), highlight = COALESCE(?, highlight),
        lowlight = COALESCE(?, lowlight), gratitude = COALESCE(?, gratitude),
        lesson = COALESCE(?, lesson), tomorrow_plan = COALESCE(?, tomorrow_plan),
        sleep_hours = COALESCE(?, sleep_hours), water_intake = COALESCE(?, water_intake),
        exercise_min = COALESCE(?, exercise_min), screen_time = COALESCE(?, screen_time),
        updated_at = datetime('now', 'localtime')
      WHERE date = ?
    `).run(overall_score, highlight, lowlight, gratitude, lesson, tomorrow_plan, sleep_hours, water_intake, exercise_min, screen_time, date);
  } else {
    db.prepare(`
      INSERT INTO daily_summaries (id, date, overall_score, highlight, lowlight, gratitude, lesson, tomorrow_plan, sleep_hours, water_intake, exercise_min, screen_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, date, overall_score || 5, highlight || null, lowlight || null, gratitude || null, lesson || null, tomorrow_plan || null, sleep_hours || null, water_intake || null, exercise_min || null, screen_time || null);
  }

  const summary = db.prepare('SELECT * FROM daily_summaries WHERE date = ?').get(date);
  res.success(summary, '总结已保存');
}));

apiRouter.use('/summaries', summariesRouter);

// ─────────────────────────────────────────────────────────────
//  ⚙️ 设置（Settings）
// ─────────────────────────────────────────────────────────────

const settingsRouter = Router();

// GET /api/settings - 获取所有设置
settingsRouter.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const settings = db.prepare('SELECT * FROM settings ORDER BY key ASC').all();

  // 转为键值对
  const settingsMap = {};
  for (const s of settings) {
    let value = s.value;
    if (s.type === 'number') value = Number(value);
    if (s.type === 'boolean') value = value === 'true';
    if (s.type === 'json') value = JSON.parse(value);
    settingsMap[s.key] = value;
  }

  res.success(settingsMap);
}));

// PUT /api/settings - 批量更新设置
settingsRouter.put('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const updates = req.body;

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now', 'localtime')
  `);

  const updateAll = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      upsert.run(key, strValue, strValue);
    }
  });
  updateAll();

  res.success(null, '设置已更新');
}));

apiRouter.use('/settings', settingsRouter);

// ─────────────────────────────────────────────────────────────
//  🏷️ 标签（Tags）
// ─────────────────────────────────────────────────────────────

const tagsRouter = Router();

// GET /api/tags - 获取所有标签
tagsRouter.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const tags = db.prepare('SELECT * FROM tags ORDER BY usage_count DESC').all();
  res.success(tags);
}));

// POST /api/tags - 创建标签
tagsRouter.post('/', validateBody({
  name: { required: true, type: 'string', label: '标签名' },
}), asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { name, color = '#6c757d' } = req.body;

  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (existing) throw new ConflictError(`标签"${name}"已存在`);

  const id = uuidv4();
  db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(id, name, color);

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  res.created(tag, '标签创建成功');
}));

apiRouter.use('/tags', tagsRouter);

// ─────────────────────────────────────────────────────────────
//  🔧 系统（System）
// ─────────────────────────────────────────────────────────────

const systemRouter = Router();

// GET /api/system/stats - 数据库统计
systemRouter.get('/stats', asyncHandler(async (req, res) => {
  const { getDatabaseStats } = await import('../db/database.js');
  const stats = getDatabaseStats();
  res.success(stats);
}));

// POST /api/system/backup - 备份数据库
systemRouter.post('/backup', asyncHandler(async (req, res) => {
  const { backupDatabase } = await import('../db/database.js');
  const backupPath = `./backups/yi-tian-backup-${format(new Date(), 'yyyyMMdd-HHmmss')}.db`;
  await backupDatabase(backupPath);
  res.success({ path: backupPath }, '数据库备份成功');
}));

apiRouter.use('/system', systemRouter);

// ═══════════════════════════════════════════════════════════════
//  辅助函数
// ═══════════════════════════════════════════════════════════════

/**
 * 计算某天的统计数据
 */
function calculateDayStats(db, date) {
  // 分类时间分配
  const categoryTime = db.prepare(`
    SELECT a.category, a.color,
           SUM(te.duration_min) as total_minutes,
           COUNT(*) as entries
    FROM time_entries te
    JOIN activities a ON te.activity_id = a.id
    WHERE te.date = ?
    GROUP BY a.category
    ORDER BY total_minutes DESC
  `).all(date);

  // 总记录时间
  const totalTime = categoryTime.reduce((sum, c) => sum + c.total_minutes, 0);

  // 平均强度
  const avgIntensity = db.prepare(`
    SELECT AVG(intensity) as avg FROM time_entries WHERE date = ?
  `).get(date);

  // 已记录的小时数
  const filledHours = db.prepare(`
    SELECT COUNT(DISTINCT hour) as count FROM time_entries WHERE date = ?
  `).get(date);

  // 最常做的活动
  const topActivity = db.prepare(`
    SELECT a.name, a.icon, COUNT(*) as count
    FROM time_entries te JOIN activities a ON te.activity_id = a.id
    WHERE te.date = ?
    GROUP BY a.id ORDER BY count DESC LIMIT 1
  `).get(date);

  return {
    date,
    categoryTime,
    totalMinutes: totalTime,
    totalHours: Math.round(totalTime / 60 * 10) / 10,
    filledHours: filledHours.count,
    emptyHours: 24 - filledHours.count,
    avgIntensity: avgIntensity.avg ? Math.round(avgIntensity.avg * 10) / 10 : null,
    topActivity: topActivity || null,
  };
}

/**
 * 更新习惯连续天数
 */
function updateHabitStreak(db, habitId) {
  const logs = db.prepare('SELECT date FROM habit_logs WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  const dates = logs.map(l => l.date);

  let streak = 0;
  const today = format(new Date(), 'yyyy-MM-dd');

  for (let i = 0; i < dates.length; i++) {
    const expectedDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (dates[i] === expectedDate) {
      streak++;
    } else {
      break;
    }
  }

  const habit = db.prepare('SELECT best_streak FROM habits WHERE id = ?').get(habitId);
  const bestStreak = Math.max(streak, habit?.best_streak || 0);

  db.prepare('UPDATE habits SET streak = ?, best_streak = ? WHERE id = ?')
    .run(streak, bestStreak, habitId);
}

export default apiRouter;
