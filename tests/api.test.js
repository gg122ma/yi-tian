/**
 * ═══════════════════════════════════════════════════════════════
 *  一天 · API 端点测试
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DB_PATH = path.join(__dirname, 'test-api-db.sqlite');

let app, server, request;

beforeAll(async () => {
  // 清理旧测试数据库
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // 设置环境变量
  process.env.DB_PATH = TEST_DB_PATH;
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0'; // 随机端口

  // 导入模块
  const supertest = await import('supertest');
  request = supertest.default;

  const serverModule = await import('../src/server.js');
  app = serverModule.app;

  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// ─── 健康检查 ────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('应该返回健康状态', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.name).toBe('一天（Yi Tian）');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });
});

// ─── 活动 API ────────────────────────────────────────────────

describe('活动 API', () => {
  let createdActivityId;

  describe('GET /api/activities', () => {
    it('应该返回活动列表', async () => {
      const res = await request(app).get('/api/activities');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('activities');
      expect(res.body.data).toHaveProperty('grouped');
      expect(Array.isArray(res.body.data.activities)).toBe(true);
    });

    it('应该支持按分类筛选', async () => {
      const res = await request(app).get('/api/activities?category=工作');
      expect(res.status).toBe(200);
      expect(res.body.data.activities.every(a => a.category === '工作')).toBe(true);
    });

    it('应该支持搜索', async () => {
      const res = await request(app).get('/api/activities?search=深度');
      expect(res.status).toBe(200);
      expect(res.body.data.activities.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/activities/categories', () => {
    it('应该返回分类列表', async () => {
      const res = await request(app).get('/api/activities/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/activities', () => {
    it('应该创建新活动', async () => {
      const res = await request(app)
        .post('/api/activities')
        .send({
          name: 'API测试活动',
          category: '测试',
          color: '#FF6B6B',
          icon: '🧪',
          description: '通过API创建的测试活动',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('API测试活动');
      createdActivityId = res.body.data.id;
    });

    it('应该拒绝缺少必填字段的请求', async () => {
      const res = await request(app)
        .post('/api/activities')
        .send({ name: '缺少分类' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('应该拒绝重复的活动名', async () => {
      const res = await request(app)
        .post('/api/activities')
        .send({ name: 'API测试活动', category: '测试' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/activities/:id', () => {
    it('应该返回活动详情和统计', async () => {
      const res = await request(app).get(`/api/activities/${createdActivityId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('API测试活动');
      expect(res.body.data).toHaveProperty('stats');
    });

    it('应该返回404对于不存在的ID', async () => {
      const res = await request(app).get('/api/activities/nonexistent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/activities/:id', () => {
    it('应该更新活动', async () => {
      const res = await request(app)
        .put(`/api/activities/${createdActivityId}`)
        .send({ name: '更新后的活动', description: '更新描述' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('更新后的活动');
    });
  });

  describe('PATCH /api/activities/:id/favorite', () => {
    it('应该切换收藏状态', async () => {
      const res = await request(app).patch(`/api/activities/${createdActivityId}/favorite`);
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/activities/:id', () => {
    it('应该删除活动', async () => {
      const res = await request(app).delete(`/api/activities/${createdActivityId}?force=true`);
      expect(res.status).toBe(200);
    });
  });
});

// ─── 时间轴 API ──────────────────────────────────────────────

describe('时间轴 API', () => {
  const testDate = '2026-06-13';
  let activityId;

  beforeAll(async () => {
    // 获取一个活动ID
    const res = await request(app).get('/api/activities');
    if (res.body.data.activities.length > 0) {
      activityId = res.body.data.activities[0].id;
    }
  });

  describe('GET /api/timeline/:date', () => {
    it('应该返回24小时时间轴', async () => {
      const res = await request(app).get(`/api/timeline/${testDate}`);
      expect(res.status).toBe(200);
      expect(res.body.data.timeline).toHaveLength(24);
      expect(res.body.data).toHaveProperty('goals');
      expect(res.body.data).toHaveProperty('moods');
      expect(res.body.data).toHaveProperty('stats');
    });

    it('应该拒绝无效日期格式', async () => {
      const res = await request(app).get('/api/timeline/invalid-date');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/timeline', () => {
    it('应该创建时间记录', async () => {
      if (!activityId) return;

      const res = await request(app)
        .post('/api/timeline')
        .send({
          date: testDate,
          hour: 14,
          activity_id: activityId,
          duration_min: 45,
          note: 'API测试记录',
          intensity: 4,
          location: '测试地点',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.hour).toBe(14);
    });

    it('应该更新已存在的时间记录', async () => {
      if (!activityId) return;

      const res = await request(app)
        .post('/api/timeline')
        .send({
          date: testDate,
          hour: 14,
          activity_id: activityId,
          duration_min: 30,
          note: '更新的记录',
        });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/timeline/:date/:hour', () => {
    it('应该删除时间记录', async () => {
      const res = await request(app).delete(`/api/timeline/${testDate}/14`);
      expect(res.status).toBe(200);
    });
  });
});

// ─── 目标 API ────────────────────────────────────────────────

describe('目标 API', () => {
  const testDate = '2026-06-13';
  let goalId;

  describe('POST /api/goals', () => {
    it('应该创建目标', async () => {
      const res = await request(app)
        .post('/api/goals')
        .send({
          date: testDate,
          title: 'API测试目标',
          category: '测试',
          priority: 4,
          target_value: 30,
          unit: '分钟',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('API测试目标');
      goalId = res.body.data.id;
    });
  });

  describe('GET /api/goals/:date', () => {
    it('应该返回某天的目标', async () => {
      const res = await request(app).get(`/api/goals/${testDate}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('goals');
      expect(res.body.data).toHaveProperty('completed');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('completionRate');
    });
  });

  describe('PATCH /api/goals/:id/complete', () => {
    it('应该标记目标完成', async () => {
      const res = await request(app).patch(`/api/goals/${goalId}/complete`);
      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/goals/:id', () => {
    it('应该更新目标', async () => {
      const res = await request(app)
        .put(`/api/goals/${goalId}`)
        .send({ title: '更新后的目标' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('更新后的目标');
    });
  });

  describe('DELETE /api/goals/:id', () => {
    it('应该删除目标', async () => {
      const res = await request(app).delete(`/api/goals/${goalId}`);
      expect(res.status).toBe(200);
    });
  });
});

// ─── 心情 API ────────────────────────────────────────────────

describe('心情 API', () => {
  const testDate = '2026-06-13';

  describe('POST /api/moods', () => {
    it('应该记录心情', async () => {
      const res = await request(app)
        .post('/api/moods')
        .send({
          date: testDate,
          hour: 10,
          mood_score: 8,
          energy_level: 7,
          stress_level: 3,
          focus_level: 9,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.mood_score).toBe(8);
    });

    it('应该更新已有心情记录', async () => {
      const res = await request(app)
        .post('/api/moods')
        .send({
          date: testDate,
          hour: 10,
          mood_score: 6,
          energy_level: 5,
        });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/moods/:date', () => {
    it('应该返回某天的心情', async () => {
      const res = await request(app).get(`/api/moods/${testDate}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('moods');
      expect(res.body.data).toHaveProperty('averages');
    });
  });
});

// ─── 统计 API ────────────────────────────────────────────────

describe('统计 API', () => {
  describe('GET /api/stats/overview', () => {
    it('应该返回总览统计', async () => {
      const res = await request(app).get('/api/stats/overview');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('dayCount');
      expect(res.body.data).toHaveProperty('totalEntries');
      expect(res.body.data).toHaveProperty('totalHours');
      expect(res.body.data).toHaveProperty('categoryTime');
      expect(res.body.data).toHaveProperty('currentStreak');
    });
  });

  describe('GET /api/stats/daily/:date', () => {
    it('应该返回日统计', async () => {
      const res = await request(app).get('/api/stats/daily/2026-06-13');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('categoryTime');
      expect(res.body.data).toHaveProperty('totalMinutes');
      expect(res.body.data).toHaveProperty('filledHours');
    });
  });
});

// ─── 设置 API ────────────────────────────────────────────────

describe('设置 API', () => {
  describe('GET /api/settings', () => {
    it('应该返回所有设置', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('theme');
      expect(res.body.data).toHaveProperty('language');
    });
  });

  describe('PUT /api/settings', () => {
    it('应该更新设置', async () => {
      const res = await request(app)
        .put('/api/settings')
        .send({ theme: 'dark', custom_setting: 'test' });

      expect(res.status).toBe(200);
    });
  });
});

// ─── 习惯 API ────────────────────────────────────────────────

describe('习惯 API', () => {
  let habitId;

  describe('GET /api/habits', () => {
    it('应该返回习惯列表', async () => {
      const res = await request(app).get('/api/habits');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/habits', () => {
    it('应该创建习惯', async () => {
      const res = await request(app)
        .post('/api/habits')
        .send({
          name: 'API测试习惯',
          frequency: 'daily',
          icon: '🧪',
          color: '#FF6B6B',
        });

      expect(res.status).toBe(201);
      habitId = res.body.data.id;
    });
  });

  describe('POST /api/habits/:id/log', () => {
    it('应该记录习惯完成', async () => {
      const res = await request(app)
        .post(`/api/habits/${habitId}/log`)
        .send({ date: '2026-06-13' });

      expect(res.status).toBe(200);
    });
  });
});

// ─── 标签 API ────────────────────────────────────────────────

describe('标签 API', () => {
  describe('GET /api/tags', () => {
    it('应该返回标签列表', async () => {
      const res = await request(app).get('/api/tags');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/tags', () => {
    it('应该创建标签', async () => {
      const res = await request(app)
        .post('/api/tags')
        .send({ name: 'API测试标签', color: '#FF6B6B' });

      expect(res.status).toBe(201);
    });
  });
});

// ─── 总结 API ────────────────────────────────────────────────

describe('总结 API', () => {
  const testDate = '2026-06-13';

  describe('POST /api/summaries', () => {
    it('应该创建每日总结', async () => {
      const res = await request(app)
        .post('/api/summaries')
        .send({
          date: testDate,
          overall_score: 8,
          highlight: 'API测试亮点',
          gratitude: '感恩测试',
        });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/summaries/:date', () => {
    it('应该返回每日总结', async () => {
      const res = await request(app).get(`/api/summaries/${testDate}`);
      expect(res.status).toBe(200);
      expect(res.body.data.overall_score).toBe(8);
    });
  });
});

// ─── 404 处理 ────────────────────────────────────────────────

describe('404 处理', () => {
  it('应该返回404对于不存在的API路由', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
