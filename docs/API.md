# 一天 · API 文档

> RESTful API 接口文档 v1.0

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`
- **编码**: UTF-8

所有响应遵循统一格式：

```json
{
  "success": true,
  "message": "操作成功",
  "data": { ... },
  "timestamp": "2026-06-13T10:30:00.000Z"
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求数据验证失败",
    "details": [...]
  },
  "requestId": "uuid",
  "timestamp": "..."
}
```

---

## 活动（Activities）

### GET /api/activities

获取所有活动。

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| category | string | 按分类筛选 |
| favorite | boolean | 只看收藏 |
| search | string | 搜索关键词 |
| sort | string | 排序字段：name/usage_count/total_minutes/sort_order |
| order | string | asc/desc |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "activities": [...],
    "grouped": { "工作": [...], "生活": [...] },
    "total": 60
  }
}
```

### GET /api/activities/categories

获取所有分类及活动数量。

### GET /api/activities/:id

获取单个活动详情及使用统计。

### POST /api/activities

创建新活动。

**请求体：**
```json
{
  "name": "写代码",
  "name_en": "Coding",
  "category": "工作",
  "color": "#3B82F6",
  "icon": "💻",
  "description": "编写程序代码"
}
```

必填：`name`、`category`

### PUT /api/activities/:id

更新活动。所有字段均可选。

### PATCH /api/activities/:id/favorite

切换收藏状态。

### DELETE /api/activities/:id

删除活动。如果有时间记录关联，需要 `?force=true`。

---

## 时间轴（Timeline）

### GET /api/timeline/:date

获取某天的完整时间轴。

**路径参数：**
- `date`：日期，格式 YYYY-MM-DD

**响应包含：**
- `timeline`：24小时完整视图（含活动详情）
- `goals`：当日目标
- `moods`：当日心情
- `summary`：当日总结
- `stats`：当日统计

### POST /api/timeline

创建/更新时间记录。

**请求体：**
```json
{
  "date": "2026-06-13",
  "hour": 14,
  "activity_id": "活动UUID",
  "duration_min": 60,
  "note": "完成了一个重要功能",
  "intensity": 4,
  "location": "办公室"
}
```

必填：`date`、`hour`（0-23）、`activity_id`

如果该小时已有记录，将自动更新。

### DELETE /api/timeline/:date/:hour

删除指定时间记录。

### POST /api/timeline/copy

复制一天的记录到另一天。

**请求体：**
```json
{
  "source_date": "2026-06-12",
  "target_date": "2026-06-13"
}
```

---

## 每日目标（Goals）

### GET /api/goals/:date

获取某天的目标列表。

**响应：**
```json
{
  "data": {
    "goals": [...],
    "completed": 2,
    "total": 5,
    "completionRate": 40
  }
}
```

### POST /api/goals

创建目标。

**请求体：**
```json
{
  "date": "2026-06-13",
  "title": "运动30分钟",
  "description": "跑步或健身",
  "category": "健康",
  "target_value": 30,
  "unit": "分钟",
  "priority": 4,
  "due_time": "18:00"
}
```

必填：`date`、`title`

### PATCH /api/goals/:id/complete

切换目标完成状态。

### PUT /api/goals/:id

更新目标。

### DELETE /api/goals/:id

删除目标。

---

## 心情追踪（Moods）

### GET /api/moods/:date

获取某天的心情记录及平均值。

### POST /api/moods

记录/更新心情。

**请求体：**
```json
{
  "date": "2026-06-13",
  "hour": 14,
  "mood_score": 8,
  "energy_level": 7,
  "stress_level": 3,
  "focus_level": 9,
  "emotion_tags": ["开心", "专注"],
  "note": "工作很顺利"
}
```

必填：`date`、`hour`、`mood_score`（1-10）、`energy_level`（1-10）

### GET /api/moods/range/summary

获取日期范围的心情趋势。

**查询参数：**
- `start`：开始日期 YYYY-MM-DD
- `end`：结束日期 YYYY-MM-DD

---

## 习惯追踪（Habits）

### GET /api/habits

获取所有活跃习惯及其完成状态。

### POST /api/habits

创建习惯。

**请求体：**
```json
{
  "name": "早起（7点前）",
  "description": "培养早起习惯",
  "frequency": "daily",
  "icon": "🌅",
  "color": "#F59E0B",
  "target_days": [1, 2, 3, 4, 5]
}
```

### POST /api/habits/:id/log

记录习惯完成。

**请求体：**
```json
{
  "date": "2026-06-13",
  "note": "6:30起床"
}
```

默认为当天日期。

### DELETE /api/habits/:id/log/:date

删除指定日期的习惯记录。

---

## 每日总结（Summaries）

### GET /api/summaries/:date

获取某天的总结。

### POST /api/summaries

创建/更新每日总结。

**请求体：**
```json
{
  "date": "2026-06-13",
  "overall_score": 8,
  "highlight": "完成了一个重要项目",
  "lowlight": "时间管理可以更好",
  "gratitude": "感恩团队的支持",
  "lesson": "专注力是有限资源",
  "tomorrow_plan": "继续推进项目",
  "sleep_hours": 7.5,
  "water_intake": 2000,
  "exercise_min": 30,
  "screen_time": 360
}
```

---

## 统计分析（Statistics）

### GET /api/stats/overview

全局统计总览。

**响应包含：**
- `dayCount`：总记录天数
- `totalEntries`：总记录条数
- `totalHours`：总追踪小时数
- `categoryTime`：分类时间分布
- `avgMood`：平均心情
- `goalOverview`：目标完成概况
- `currentStreak`：连续记录天数

### GET /api/stats/daily/:date

某天的详细统计。

### GET /api/stats/weekly/:date

某周的统计（传入该周任意日期）。

### GET /api/stats/monthly/:year/:month

某月的统计。

### GET /api/stats/export

导出数据。

**查询参数：**
- `format`：json / csv

---

## 设置（Settings）

### GET /api/settings

获取所有设置（键值对格式）。

### PUT /api/settings

批量更新设置。

**请求体：**
```json
{
  "theme": "dark",
  "language": "zh-CN",
  "time_format": "24h"
}
```

---

## 标签（Tags）

### GET /api/tags

获取所有标签。

### POST /api/tags

创建标签。

**请求体：**
```json
{
  "name": "高效",
  "color": "#10B981"
}
```

---

## 系统（System）

### GET /api/health

健康检查。

### GET /api/system/stats

数据库统计信息。

### POST /api/system/backup

触发数据库备份。

---

## 错误码

| HTTP | Code | 说明 |
|------|------|------|
| 400 | VALIDATION_ERROR | 请求数据验证失败 |
| 404 | NOT_FOUND | 资源不存在 |
| 408 | REQUEST_TIMEOUT | 请求超时 |
| 409 | CONFLICT | 数据冲突（如重复） |
| 429 | RATE_LIMIT | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |
| 500 | DATABASE_ERROR | 数据库错误 |
