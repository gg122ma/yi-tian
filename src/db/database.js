/**
 * ═══════════════════════════════════════════════════════════════
 *  一天 · 数据库层（Database Layer）
 * ═══════════════════════════════════════════════════════════════
 *  使用 sql.js（纯 JavaScript SQLite，无需原生编译）
 *  提供与 better-sqlite3 兼容的包装 API
 * ═══════════════════════════════════════════════════════════════
 */

import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── 数据库实例 ──────────────────────────────────────────────
let db = null;
let dbPath = null;

/**
 * 将 sql.js 的 exec 结果转为 better-sqlite3 风格的对象数组
 */
function extractRows(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

/**
 * 包装 sql.js 数据库，提供 prepare().run/get/all 接口
 */
function wrapDb(sqlDb) {
  return {
    _raw: sqlDb,

    exec(sql) {
      sqlDb.run(sql);
    },

    prepare(sql) {
      return {
        run(...params) {
          sqlDb.run(sql, params);
        },
        get(...params) {
          const result = sqlDb.exec(sql, params);
          const rows = extractRows(result);
          return rows.length > 0 ? rows[0] : undefined;
        },
        all(...params) {
          const result = sqlDb.exec(sql, params);
          return extractRows(result);
        },
      };
    },

    pragma(str) {
      try {
        const result = sqlDb.exec(`PRAGMA ${str}`);
        if (str.includes('=')) return undefined;
        if (result.length > 0 && result[0].values.length > 0) {
          const val = result[0].values[0][0];
          if (str === 'journal_mode') return val;
          return val;
        }
        return undefined;
      } catch {
        return undefined;
      }
    },

    close() {
      sqlDb.close();
    },

    backup(destPath) {
      const data = sqlDb.export();
      fs.writeFileSync(destPath, Buffer.from(data));
      return Promise.resolve();
    },

    transaction(fn) {
      return function (...args) {
        sqlDb.run('BEGIN TRANSACTION');
        try {
          const result = fn(...args);
          sqlDb.run('COMMIT');
          return result;
        } catch (err) {
          sqlDb.run('ROLLBACK');
          throw err;
        }
      };
    },
  };
}

/**
 * 初始化数据库连接并创建表结构
 * @param {string} databasePath - 数据库文件路径
 * @returns {Promise<Object>} 包装后的数据库实例
 */
export async function initializeDatabase(databasePath) {
  dbPath = databasePath;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  // 如果数据库文件已存在，加载它；否则创建新数据库
  let sqlDb;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db = wrapDb(sqlDb);

  // 性能优化设置
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA cache_size = -64000');
  db.exec('PRAGMA foreign_keys = ON');

  // 创建表结构
  createTables();
  runMigrations();

  // 持久化到文件
  saveDatabase();

  console.log('✅ 数据库初始化完成');
  return db;
}

/**
 * 保存数据库到文件
 */
export function saveDatabase() {
  if (db && dbPath) {
    const data = db._raw.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

/**
 * 获取数据库实例
 */
export function getDatabase() {
  if (!db) {
    throw new Error('数据库尚未初始化，请先调用 initializeDatabase()');
  }
  return db;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    console.log('📦 数据库连接已关闭');
  }
}

/**
 * 创建所有表结构
 */
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      name_en       TEXT,
      category      TEXT NOT NULL DEFAULT '其他',
      color         TEXT NOT NULL DEFAULT '#6c757d',
      icon          TEXT NOT NULL DEFAULT '📌',
      description   TEXT,
      is_favorite   INTEGER NOT NULL DEFAULT 0,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      usage_count   INTEGER NOT NULL DEFAULT 0,
      total_minutes INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id            TEXT PRIMARY KEY,
      date          TEXT NOT NULL,
      hour          INTEGER NOT NULL,
      activity_id   TEXT NOT NULL,
      duration_min  INTEGER NOT NULL DEFAULT 60,
      note          TEXT,
      intensity     INTEGER NOT NULL DEFAULT 3,
      location      TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_goals (
      id            TEXT PRIMARY KEY,
      date          TEXT NOT NULL,
      title         TEXT NOT NULL,
      description   TEXT,
      category      TEXT NOT NULL DEFAULT '个人',
      target_value  REAL,
      current_value REAL NOT NULL DEFAULT 0,
      unit          TEXT,
      priority      INTEGER NOT NULL DEFAULT 3,
      is_completed  INTEGER NOT NULL DEFAULT 0,
      completed_at  TEXT,
      due_time      TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS moods (
      id            TEXT PRIMARY KEY,
      date          TEXT NOT NULL,
      hour          INTEGER NOT NULL,
      mood_score    INTEGER NOT NULL,
      energy_level  INTEGER NOT NULL,
      stress_level  INTEGER NOT NULL DEFAULT 5,
      focus_level   INTEGER NOT NULL DEFAULT 5,
      emotion_tags  TEXT,
      note          TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS daily_summaries (
      id            TEXT PRIMARY KEY,
      date          TEXT NOT NULL UNIQUE,
      overall_score INTEGER NOT NULL DEFAULT 5,
      highlight     TEXT,
      lowlight      TEXT,
      gratitude     TEXT,
      lesson        TEXT,
      tomorrow_plan TEXT,
      sleep_hours   REAL,
      water_intake  INTEGER,
      exercise_min  INTEGER,
      screen_time   INTEGER,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key           TEXT PRIMARY KEY,
      value         TEXT NOT NULL,
      type          TEXT NOT NULL DEFAULT 'string',
      description   TEXT,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL UNIQUE,
      color         TEXT NOT NULL DEFAULT '#6c757d',
      usage_count   INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS tag_relations (
      tag_id        TEXT NOT NULL,
      entity_type   TEXT NOT NULL,
      entity_id     TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (tag_id, entity_type, entity_id),
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  `);

  // 索引
  db.exec('CREATE INDEX IF NOT EXISTS idx_te_date ON time_entries(date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_te_date_hour ON time_entries(date, hour)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_te_activity ON time_entries(activity_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_goals_date ON daily_goals(date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_goals_completed ON daily_goals(date, is_completed)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_moods_date ON moods(date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_summaries_date ON daily_summaries(date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_act_category ON activities(category)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_act_favorite ON activities(is_favorite)');
}

/**
 * 数据库版本迁移
 */
function runMigrations() {
  const getVersion = db.prepare(`SELECT value FROM settings WHERE key = 'db_version'`);
  const versionRow = getVersion.get();
  const currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

  const migrations = [
    {
      version: 1,
      up: () => {
        const insertSetting = db.prepare(
          `INSERT OR IGNORE INTO settings (key, value, type, description) VALUES (?, ?, ?, ?)`
        );
        const defaults = [
          ['theme', 'auto', 'string', '界面主题'],
          ['language', 'zh-CN', 'string', '界面语言'],
          ['start_hour', '0', 'number', '一天的起始小时'],
          ['default_view', 'dashboard', 'string', '默认视图'],
          ['time_format', '24h', 'string', '时间格式'],
          ['week_start', 'monday', 'string', '一周起始日'],
          ['notification_enabled', 'true', 'boolean', '通知提醒'],
          ['auto_save', 'true', 'boolean', '自动保存'],
          ['show_mood_tracker', 'true', 'boolean', '心情追踪器'],
          ['show_goal_panel', 'true', 'boolean', '目标面板'],
          ['chart_style', 'default', 'string', '图表样式'],
          ['db_version', '1', 'number', '数据库版本号'],
        ];
        for (const [key, value, type, description] of defaults) {
          insertSetting.run(key, value, type, description);
        }
      },
    },
    {
      version: 2,
      up: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS activity_templates (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT,
            activities  TEXT NOT NULL,
            time_slots  TEXT NOT NULL,
            category    TEXT NOT NULL DEFAULT '日常',
            is_default  INTEGER NOT NULL DEFAULT 0,
            usage_count INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
          );
        `);
        db.prepare(`UPDATE settings SET value = '2' WHERE key = 'db_version'`).run();
      },
    },
    {
      version: 3,
      up: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS habits (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            description   TEXT,
            frequency     TEXT NOT NULL DEFAULT 'daily',
            target_days   TEXT,
            icon          TEXT NOT NULL DEFAULT '✅',
            color         TEXT NOT NULL DEFAULT '#4CAF50',
            streak        INTEGER NOT NULL DEFAULT 0,
            best_streak   INTEGER NOT NULL DEFAULT 0,
            is_active     INTEGER NOT NULL DEFAULT 1,
            created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
          );

          CREATE TABLE IF NOT EXISTS habit_logs (
            id          TEXT PRIMARY KEY,
            habit_id    TEXT NOT NULL,
            date        TEXT NOT NULL,
            completed   INTEGER NOT NULL DEFAULT 1,
            note        TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
          );
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_habits_active ON habits(is_active)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_hlogs_date ON habit_logs(date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_hlogs_habit ON habit_logs(habit_id)');
        db.prepare(`UPDATE settings SET value = '3' WHERE key = 'db_version'`).run();
      },
    },
  ];

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`🔄 迁移 v${migration.version}`);
      migration.up();
    }
  }

  saveDatabase();
}

/**
 * 事务包装器
 */
export function runTransaction(fn) {
  return db.transaction(fn)();
}

/**
 * 备份数据库
 */
export async function backupDatabase(backupPath) {
  if (!db) throw new Error('数据库未初始化');
  await db.backup(backupPath);
  console.log(`💾 数据库已备份到: ${backupPath}`);
}

/**
 * 获取数据库统计信息
 */
export function getDatabaseStats() {
  if (!db) throw new Error('数据库未初始化');
  const stats = {};

  const tables = ['activities', 'time_entries', 'daily_goals', 'moods', 'daily_summaries', 'settings', 'tags'];
  for (const table of tables) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      stats[table] = row.count;
    } catch {
      stats[table] = 0;
    }
  }

  stats.database_size_bytes = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  stats.database_size_mb = (stats.database_size_bytes / 1024 / 1024).toFixed(2);

  try {
    const range = db.prepare(`SELECT MIN(date) as earliest, MAX(date) as latest FROM time_entries`).get();
    stats.date_range = { earliest: range?.earliest || null, latest: range?.latest || null };
  } catch {
    stats.date_range = { earliest: null, latest: null };
  }

  return stats;
}

/**
 * 清空所有数据
 */
export function clearAllData(confirm = false) {
  if (!confirm) throw new Error('需要 confirm = true');
  const tables = ['tag_relations', 'habit_logs', 'habits', 'moods', 'daily_goals', 'daily_summaries', 'time_entries', 'tags'];
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  saveDatabase();
  console.log('🗑️ 所有数据已清空');
}

export default {
  initializeDatabase, getDatabase, closeDatabase, saveDatabase,
  runTransaction, backupDatabase, getDatabaseStats, clearAllData,
};
