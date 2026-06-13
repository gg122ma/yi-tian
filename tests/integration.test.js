/**
 * ═══════════════════════════════════════════════════════════════
 *  一天 · 集成测试 & 功能测试
 * ═══════════════════════════════════════════════════════════════
 *  端到端工作流测试、数据完整性测试、边界条件测试
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { format, subDays } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DB_PATH = path.join(__dirname, 'test-integration-db.sqlite');

let app, request;
let db;

beforeAll(async () => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  process.env.DB_PATH = TEST_DB_PATH;
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';

  const supertest = await import('supertest');
  request = supertest.default;

  const serverModule = await import('../src/server.js');
  app = serverModule.app;

  const databaseModule = await import('../src/db/database.js');
  db = databaseModule.getDatabase();

  await new Promise(resolve => setTimeout(resolve, 500));
});

afterAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// ═══════════════════════════════════════════════════════════════
//  完整工作流测试
// ═══════════════════════════════════════════════════════════════

describe('完整工作流：一天的记录', () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  let activityIds = [];

  it('Step 1: 获取预设活动列表', async () => {
    const res = await request(app).get('/api/activities');
    expect(res.status).toBe(200);

    activityIds = res.body.data.activities.map(a => a.id);
    expect(activityIds.length).toBeGreaterThan(0);
  });

  it('Step 2: 创建自定义活动', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({
        name: '写代码',
        category: '工作',
        color: '#3B82F6',
        icon: '💻',
        description: '编写程序代码',
      });

    expect(res.status).toBe(201);
    activityIds.push(res.body.data.id);
  });

  it('Step 3: 记录一天的时间（填充多个小时）', async () => {
    const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

    for (const hour of hours) {
      const activityId = activityIds[hour % activityIds.length];
      const res = await request(app)
        .post('/api/timeline')
        .send({
          date: today,
          hour,
          activity_id: activityId,
          duration_min: 45 + Math.floor(Math.random() * 30),
          intensity: 2 + Math.floor(Math.random() * 4),
        });

      expect(res.status).toBe(200);
    }
  });

  it('Step 4: 验证时间轴完整性', async () => {
    const res = await request(app).get(`/api/timeline/${today}`);
    expect(res.status).toBe(200);

    const filledHours = res.body.data.timeline.filter(t => !t.isEmpty);
    expect(filledHours.length).toBe(16);
    expect(res.body.data.stats.filledHours).toBe(16);
    expect(res.body.data.stats.emptyHours).toBe(8);
  });

  it('Step 5: 设置每日目标', async () => {
    const goals = [
      { title: '完成代码审查', category: '工作', priority: 5 },
      { title: '运动30分钟', category: '健康', priority: 4, target_value: 30, unit: '分钟' },
      { title: '阅读20页', category: '学习', priority: 3, target_value: 20, unit: '页' },
    ];

    for (const goal of goals) {
      const res = await request(app)
        .post('/api/goals')
        .send({ date: today, ...goal });

      expect(res.status).toBe(201);
    }

    // 验证目标
    const goalsRes = await request(app).get(`/api/goals/${today}`);
    expect(goalsRes.body.data.total).toBe(3);
  });

  it('Step 6: 完成部分目标', async () => {
    const goalsRes = await request(app).get(`/api/goals/${today}`);
    const goalId = goalsRes.body.data.goals[0].id;

    const res = await request(app).patch(`/api/goals/${goalId}/complete`);
    expect(res.status).toBe(200);

    // 验证完成率
    const updatedGoals = await request(app).get(`/api/goals/${today}`);
    expect(updatedGoals.body.data.completed).toBe(1);
    expect(updatedGoals.body.data.completionRate).toBeGreaterThan(0);
  });

  it('Step 7: 记录心情', async () => {
    const moodEntries = [
      { hour: 8, mood_score: 6, energy_level: 5 },
      { hour: 12, mood_score: 7, energy_level: 7 },
      { hour: 18, mood_score: 8, energy_level: 6 },
      { hour: 22, mood_score: 5, energy_level: 3 },
    ];

    for (const entry of moodEntries) {
      const res = await request(app)
        .post('/api/moods')
        .send({ date: today, ...entry });

      expect(res.status).toBe(200);
    }

    // 验证心情平均值
    const moodRes = await request(app).get(`/api/moods/${today}`);
    expect(moodRes.body.data.averages).toBeDefined();
    expect(moodRes.body.data.count).toBe(4);
  });

  it('Step 8: 写每日总结', async () => {
    const res = await request(app)
      .post('/api/summaries')
      .send({
        date: today,
        overall_score: 7,
        highlight: '完成了一个重要的功能',
        gratitude: '感恩团队的支持',
        lesson: '合理安排时间很重要',
        tomorrow_plan: '继续推进项目',
        sleep_hours: 7.5,
        water_intake: 2000,
        exercise_min: 30,
      });

    expect(res.status).toBe(200);
  });

  it('Step 9: 查看日统计', async () => {
    const res = await request(app).get(`/api/stats/daily/${today}`);
    expect(res.status).toBe(200);
    expect(res.body.data.categoryTime.length).toBeGreaterThan(0);
    expect(res.body.data.totalMinutes).toBeGreaterThan(0);
  });

  it('Step 10: 查看总览统计', async () => {
    const res = await request(app).get('/api/stats/overview');
    expect(res.status).toBe(200);
    expect(res.body.data.dayCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalEntries).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  多日数据测试
// ═══════════════════════════════════════════════════════════════

describe('多日数据查询', () => {
  it('应该为最近7天都生成统计数据', async () => {
    const today = new Date();
    const activityRes = await request(app).get('/api/activities');
    const activities = activityRes.body.data.activities;

    // 为过去几天添加数据
    for (let d = 1; d <= 5; d++) {
      const date = format(subDays(today, d), 'yyyy-MM-dd');
      const activityId = activities[d % activities.length].id;

      await request(app)
        .post('/api/timeline')
        .send({ date, hour: 10, activity_id: activityId, intensity: 3 });
    }

    // 查询周统计
    const todayStr = format(today, 'yyyy-MM-dd');
    const res = await request(app).get(`/api/stats/weekly/${todayStr}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('dailyBreakdown');
    expect(res.body.data).toHaveProperty('categorySummary');
  });
});

// ═══════════════════════════════════════════════════════════════
//  边界条件测试
// ═══════════════════════════════════════════════════════════════

describe('边界条件', () => {
  let activityId;

  beforeAll(async () => {
    const res = await request(app).get('/api/activities');
    activityId = res.body.data.activities[0]?.id;
  });

  it('应该处理小时边界值（0和23）', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    // 小时 0
    const res0 = await request(app)
      .post('/api/timeline')
      .send({ date: today, hour: 0, activity_id: activityId });
    expect(res0.status).toBe(200);

    // 小时 23
    const res23 = await request(app)
      .post('/api/timeline')
      .send({ date: today, hour: 23, activity_id: activityId });
    expect(res23.status).toBe(200);
  });

  it('应该拒绝超出范围的小时', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    const res = await request(app)
      .post('/api/timeline')
      .send({ date: today, hour: 24, activity_id: activityId });

    expect(res.status).toBe(400);
  });

  it('应该处理心情评分边界值', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    // 最低分
    const res1 = await request(app)
      .post('/api/moods')
      .send({ date: today, hour: 5, mood_score: 1, energy_level: 1 });
    expect(res1.status).toBe(200);

    // 最高分
    const res10 = await request(app)
      .post('/api/moods')
      .send({ date: today, hour: 6, mood_score: 10, energy_level: 10 });
    expect(res10.status).toBe(200);
  });

  it('应该拒绝超出范围的心情评分', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    const res = await request(app)
      .post('/api/moods')
      .send({ date: today, hour: 7, mood_score: 11, energy_level: 5 });

    expect(res.status).toBe(400);
  });

  it('应该处理不存在的活动ID', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    const res = await request(app)
      .post('/api/timeline')
      .send({ date: today, hour: 8, activity_id: 'nonexistent-id' });

    expect(res.status).toBe(404);
  });

  it('应该处理空搜索结果', async () => {
    const res = await request(app).get('/api/activities?search=xxxxxxxxx不存在的活动');
    expect(res.status).toBe(200);
    expect(res.body.data.activities).toHaveLength(0);
  });

  it('应该处理极端日期查询', async () => {
    const res = await request(app).get('/api/timeline/1970-01-01');
    expect(res.status).toBe(200);
    expect(res.body.data.timeline.every(t => t.isEmpty)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  数据完整性测试
// ═══════════════════════════════════════════════════════════════

describe('数据完整性', () => {
  it('外键约束应该阻止删除被引用的活动', async () => {
    // 创建一个活动并关联时间记录
    const createRes = await request(app)
      .post('/api/activities')
      .send({ name: 'FK测试', category: '测试', color: '#000', icon: '🔑' });
    const actId = createRes.body.data.id;

    const today = format(new Date(), 'yyyy-MM-dd');
    await request(app)
      .post('/api/timeline')
      .send({ date: today, hour: 3, activity_id: actId });

    // 不带 force=true 删除应该失败
    const deleteRes = await request(app).delete(`/api/activities/${actId}`);
    expect(deleteRes.status).toBe(409);
  });

  it('设置表应该保持键值一致性', async () => {
    const res = await request(app).get('/api/settings');
    const settings = res.body.data;

    // 检查核心设置
    expect(settings).toHaveProperty('theme');
    expect(settings).toHaveProperty('language');
    expect(settings).toHaveProperty('time_format');

    // 类型应该正确
    expect(typeof settings.theme).toBe('string');
  });

  it('统计查询应该返回一致的数据', async () => {
    const overview = await request(app).get('/api/stats/overview');
    const stats = overview.body.data;

    // 总时间应该是合理的
    expect(stats.totalMinutes).toBeGreaterThan(0);
    expect(stats.totalHours).toBe(Math.round(stats.totalMinutes / 60));

    // 分类时间总和应该等于总时间
    const categoryTotal = stats.categoryTime.reduce((sum, c) => sum + c.total_minutes, 0);
    expect(categoryTotal).toBe(stats.totalMinutes);
  });
});

// ═══════════════════════════════════════════════════════════════
//  并发安全测试
// ═══════════════════════════════════════════════════════════════

describe('并发操作', () => {
  it('应该正确处理同时写入同一小时', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const actRes = await request(app).get('/api/activities');
    const actId = actRes.body.data.activities[0].id;

    // 并发写入同一小时
    const results = await Promise.all([
      request(app).post('/api/timeline').send({ date: today, hour: 15, activity_id: actId, note: 'A' }),
      request(app).post('/api/timeline').send({ date: today, hour: 15, activity_id: actId, note: 'B' }),
    ]);

    // 至少一个应该成功
    expect(results.some(r => r.status === 200)).toBe(true);
  });

  it('应该正确处理同时创建多个目标', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    const results = await Promise.all([
      request(app).post('/api/goals').send({ date: today, title: '并发目标1' }),
      request(app).post('/api/goals').send({ date: today, title: '并发目标2' }),
      request(app).post('/api/goals').send({ date: today, title: '并发目标3' }),
    ]);

    expect(results.every(r => r.status === 201)).toBe(true);
  });
});
