/**
 * ═══════════════════════════════════════════════════════════════
 *  一天 · 数据库层测试
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 使用内存数据库进行测试
const TEST_DB_PATH = path.join(__dirname, 'test-db.sqlite');

// 动态导入模块（需要在测试环境中设置）
let db, initializeDatabase, getDatabase, closeDatabase, getDatabaseStats, clearAllData, runTransaction;

beforeAll(async () => {
  // 清理旧的测试数据库
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const databaseModule = await import('../src/db/database.js');
  initializeDatabase = databaseModule.initializeDatabase;
  getDatabase = databaseModule.getDatabase;
  closeDatabase = databaseModule.closeDatabase;
  getDatabaseStats = databaseModule.getDatabaseStats;
  clearAllData = databaseModule.clearAllData;
  runTransaction = databaseModule.runTransaction;

  db = initializeDatabase(TEST_DB_PATH);
});

afterAll(() => {
  closeDatabase();
  // 清理测试数据库
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

describe('数据库初始化', () => {
  it('应该成功初始化数据库', () => {
    expect(db).toBeDefined();
  });

  it('应该创建所有必要的表', () => {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('activities');
    expect(tableNames).toContain('time_entries');
    expect(tableNames).toContain('daily_goals');
    expect(tableNames).toContain('moods');
    expect(tableNames).toContain('daily_summaries');
    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('tags');
    expect(tableNames).toContain('habits');
    expect(tableNames).toContain('habit_logs');
  });

  it('应该启用 WAL 日志模式', () => {
    const mode = db.pragma('journal_mode', { simple: true });
    expect(mode).toBe('wal');
  });

  it('应该启用外键约束', () => {
    const fk = db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
  });
});

describe('活动（Activities）CRUD', () => {
  let activityId;

  it('应该插入新活动', () => {
    const id = 'test-activity-1';
    activityId = id;

    db.prepare(`
      INSERT INTO activities (id, name, category, color, icon, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, '测试活动', '工作', '#3B82F6', '🎯', '这是一个测试活动');

    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
    expect(activity).toBeDefined();
    expect(activity.name).toBe('测试活动');
    expect(activity.category).toBe('工作');
    expect(activity.color).toBe('#3B82F6');
    expect(activity.usage_count).toBe(0);
  });

  it('应该更新活动信息', () => {
    db.prepare('UPDATE activities SET name = ? WHERE id = ?').run('更新后的活动', activityId);

    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
    expect(activity.name).toBe('更新后的活动');
  });

  it('应该切换收藏状态', () => {
    db.prepare('UPDATE activities SET is_favorite = 1 WHERE id = ?').run(activityId);
    let activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
    expect(activity.is_favorite).toBe(1);

    db.prepare('UPDATE activities SET is_favorite = 0 WHERE id = ?').run(activityId);
    activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
    expect(activity.is_favorite).toBe(0);
  });

  it('应该按分类查询活动', () => {
    const activities = db.prepare('SELECT * FROM activities WHERE category = ?').all('工作');
    expect(activities.length).toBeGreaterThan(0);
    expect(activities.every(a => a.category === '工作')).toBe(true);
  });

  it('应该删除活动', () => {
    db.prepare('DELETE FROM activities WHERE id = ?').run(activityId);
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
    expect(activity).toBeUndefined();
  });
});

describe('时间记录（Time Entries）CRUD', () => {
  let testActivityId = 'test-te-activity';
  let testEntryId = 'test-te-entry';

  beforeAll(() => {
    // 创建测试活动
    db.prepare(`
      INSERT OR IGNORE INTO activities (id, name, category, color, icon)
      VALUES (?, ?, ?, ?, ?)
    `).run(testActivityId, '测试活动', '工作', '#3B82F6', '🎯');
  });

  it('应该插入时间记录', () => {
    db.prepare(`
      INSERT INTO time_entries (id, date, hour, activity_id, duration_min, note, intensity, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testEntryId, '2026-06-13', 10, testActivityId, 60, '测试备注', 4, '办公室');

    const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(testEntryId);
    expect(entry).toBeDefined();
    expect(entry.date).toBe('2026-06-13');
    expect(entry.hour).toBe(10);
    expect(entry.duration_min).toBe(60);
    expect(entry.intensity).toBe(4);
  });

  it('应该强制唯一约束（每天每小时一条）', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO time_entries (id, date, hour, activity_id, duration_min)
        VALUES (?, ?, ?, ?, ?)
      `).run('duplicate-entry', '2026-06-13', 10, testActivityId, 30);
    }).toThrow();
  });

  it('应该通过 JOIN 查询活动详情', () => {
    const entry = db.prepare(`
      SELECT te.*, a.name as activity_name, a.icon as activity_icon
      FROM time_entries te
      JOIN activities a ON te.activity_id = a.id
      WHERE te.id = ?
    `).get(testEntryId);

    expect(entry.activity_name).toBe('测试活动');
    expect(entry.activity_icon).toBe('🎯');
  });

  it('应该按日期查询时间记录', () => {
    const entries = db.prepare('SELECT * FROM time_entries WHERE date = ?').all('2026-06-13');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('应该按小时范围查询', () => {
    const entries = db.prepare('SELECT * FROM time_entries WHERE date = ? AND hour >= ? AND hour <= ?')
      .all('2026-06-13', 9, 12);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(e => e.hour >= 9 && e.hour <= 12)).toBe(true);
  });

  it('应该删除时间记录', () => {
    db.prepare('DELETE FROM time_entries WHERE id = ?').run(testEntryId);
    const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(testEntryId);
    expect(entry).toBeUndefined();
  });
});

describe('心情记录（Moods）', () => {
  it('应该插入心情记录', () => {
    db.prepare(`
      INSERT INTO moods (id, date, hour, mood_score, energy_level, stress_level, focus_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('test-mood-1', '2026-06-13', 10, 8, 7, 3, 9);

    const mood = db.prepare('SELECT * FROM moods WHERE date = ? AND hour = ?').get('2026-06-13', 10);
    expect(mood).toBeDefined();
    expect(mood.mood_score).toBe(8);
  });

  it('应该计算某天的平均心情', () => {
    db.prepare(`
      INSERT OR IGNORE INTO moods (id, date, hour, mood_score, energy_level, stress_level, focus_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('test-mood-2', '2026-06-13', 14, 6, 5, 6, 7);

    const avg = db.prepare(`
      SELECT AVG(mood_score) as avg_mood, AVG(energy_level) as avg_energy
      FROM moods WHERE date = ?
    `).get('2026-06-13');

    expect(avg.avg_mood).toBeDefined();
    expect(avg.avg_mood).toBeGreaterThan(0);
    expect(avg.avg_mood).toBeLessThanOrEqual(10);
  });
});

describe('每日目标（Goals）', () => {
  it('应该创建目标', () => {
    db.prepare(`
      INSERT INTO daily_goals (id, date, title, category, target_value, unit, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('test-goal-1', '2026-06-13', '运动30分钟', '健康', 30, '分钟', 4);

    const goal = db.prepare('SELECT * FROM daily_goals WHERE id = ?').get('test-goal-1');
    expect(goal).toBeDefined();
    expect(goal.is_completed).toBe(0);
  });

  it('应该标记目标完成', () => {
    db.prepare('UPDATE daily_goals SET is_completed = 1, completed_at = datetime(\'now\') WHERE id = ?')
      .run('test-goal-1');

    const goal = db.prepare('SELECT * FROM daily_goals WHERE id = ?').get('test-goal-1');
    expect(goal.is_completed).toBe(1);
    expect(goal.completed_at).toBeTruthy();
  });

  it('应该统计完成率', () => {
    db.prepare(`
      INSERT INTO daily_goals (id, date, title, is_completed) VALUES (?, ?, ?, ?)
    `).run('test-goal-2', '2026-06-13', '阅读30页', 0);

    const stats = db.prepare(`
      SELECT COUNT(*) as total, SUM(is_completed) as completed
      FROM daily_goals WHERE date = ?
    `).get('2026-06-13');

    expect(stats.total).toBe(2);
    expect(stats.completed).toBe(1);
  });
});

describe('设置（Settings）', () => {
  it('应该有默认设置', () => {
    const settings = db.prepare('SELECT * FROM settings').all();
    expect(settings.length).toBeGreaterThan(0);
  });

  it('应该读取和更新设置', () => {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('dark', 'theme');
    const theme = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme');
    expect(theme.value).toBe('dark');
  });

  it('应该支持 upsert', () => {
    db.prepare(`
      INSERT INTO settings (key, value, type) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `).run('custom_key', 'custom_value', 'string', 'updated_value');

    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('custom_key');
    expect(setting.value).toBe('updated_value');
  });
});

describe('数据库统计', () => {
  it('应该返回正确的统计信息', () => {
    const stats = getDatabaseStats();

    expect(stats).toHaveProperty('activities');
    expect(stats).toHaveProperty('time_entries');
    expect(stats).toHaveProperty('daily_goals');
    expect(stats).toHaveProperty('moods');
    expect(stats).toHaveProperty('database_size_bytes');

    expect(stats.activities).toBeGreaterThanOrEqual(0);
    expect(stats.time_entries).toBeGreaterThanOrEqual(0);
  });
});

describe('事务操作', () => {
  it('应该在事务中执行多个操作', () => {
    const result = runTransaction(() => {
      db.prepare(`
        INSERT INTO activities (id, name, category, color, icon)
        VALUES (?, ?, ?, ?, ?)
      `).run('tx-test-1', '事务测试1', '测试', '#000', '🔧');

      db.prepare(`
        INSERT INTO activities (id, name, category, color, icon)
        VALUES (?, ?, ?, ?, ?)
      `).run('tx-test-2', '事务测试2', '测试', '#000', '🔧');

      return 2;
    });

    expect(result).toBe(2);

    const count = db.prepare('SELECT COUNT(*) as c FROM activities WHERE category = ?').get('测试');
    expect(count.c).toBe(2);
  });

  it('应该在事务失败时回滚', () => {
    const initialCount = db.prepare('SELECT COUNT(*) as c FROM activities').get().c;

    try {
      runTransaction(() => {
        db.prepare(`
          INSERT INTO activities (id, name, category, color, icon)
          VALUES (?, ?, ?, ?, ?)
        `).run('tx-rollback', '将被回滚', '测试', '#000', '🔧');

        throw new Error('故意失败');
      });
    } catch (err) {
      // 预期的错误
    }

    const finalCount = db.prepare('SELECT COUNT(*) as c FROM activities').get().c;
    expect(finalCount).toBe(initialCount);
  });
});
