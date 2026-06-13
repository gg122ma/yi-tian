/**
 * ═══════════════════════════════════════════════════════════════
 *  一天 · 中间件层（Middleware Layer）
 * ═══════════════════════════════════════════════════════════════
 *  错误处理 · 请求日志 · 验证 · 速率限制 · CORS
 * ═══════════════════════════════════════════════════════════════
 */

import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

// ─── 自定义错误类 ────────────────────────────────────────────

/**
 * 应用错误基类
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends AppError {
  constructor(resource = '资源', id = '') {
    const msg = id ? `${resource}（ID: ${id}）不存在` : `${resource}不存在`;
    super(msg, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * 请求验证错误
 */
export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * 数据库操作错误
 */
export class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

/**
 * 冲突错误（如重复数据）
 */
export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/**
 * 未授权错误
 */
export class UnauthorizedError extends AppError {
  constructor(message = '未授权访问') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

// ─── 错误处理中间件 ──────────────────────────────────────────

/**
 * 全局错误处理中间件
 * 捕获所有未处理的错误并返回统一格式的响应
 */
export function errorHandler(err, req, res, next) {
  // 如果已经发送了响应，交给 Express 默认处理
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.isOperational ? err.message : '服务器内部错误';

  // 错误日志
  const logEntry = {
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode,
    code,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      originalError: err.originalError?.message,
    }),
  };

  if (statusCode >= 500) {
    console.error('❌ 服务器错误:', JSON.stringify(logEntry, null, 2));
  } else if (statusCode >= 400) {
    console.warn('⚠️ 客户端错误:', JSON.stringify(logEntry, null, 2));
  }

  // 构建响应
  const response = {
    success: false,
    error: {
      code,
      message,
      ...(err.errors && { details: err.errors }),
      ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && {
        stack: err.stack?.split('\n'),
      }),
    },
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
}

/**
 * 404 处理中间件
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路由 ${req.method} ${req.path} 不存在`,
    },
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
}

// ─── 请求日志中间件 ──────────────────────────────────────────

/**
 * 为每个请求分配唯一 ID 并记录请求信息
 */
export function requestLogger(req, res, next) {
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // 在响应头中包含请求 ID
  res.setHeader('X-Request-Id', req.requestId);

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.getHeader('content-length') || 0,
    };

    // 只在开发环境记录详细日志
    if (process.env.NODE_ENV === 'development' && process.env.LOG_LEVEL === 'debug') {
      console.log(`📎 ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    }
  });

  next();
}

// ─── 速率限制 ────────────────────────────────────────────────

/**
 * 创建速率限制中间件
 * @param {number} maxRequests - 窗口内最大请求数
 * @param {number} windowMs - 时间窗口（毫秒）
 * @returns {Function} Express 中间件
 */
export function rateLimiter(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: `请求过于频繁，请在 ${Math.ceil(windowMs / 1000 / 60)} 分钟后重试`,
      },
    },
    keyGenerator: (req) => {
      return req.ip || req.headers['x-forwarded-for'] || 'unknown';
    },
  });
}

// ─── CORS 配置 ───────────────────────────────────────────────

/**
 * 生成 CORS 配置
 * @param {string} origins - 允许的来源（逗号分隔或 *）
 * @returns {Object} CORS 配置对象
 */
export function corsOptions(origins = '*') {
  const originList = origins === '*'
    ? '*'
    : origins.split(',').map(o => o.trim());

  return {
    origin: originList === '*' ? '*' : (origin, callback) => {
      if (!origin || originList.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS 策略不允许此来源'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'X-Total-Count'],
    credentials: true,
    maxAge: 86400, // 24小时预检缓存
  };
}

// ─── 验证中间件 ──────────────────────────────────────────────

/**
 * 请求体验证中间件工厂
 * @param {Object} schema - 验证规则
 * @returns {Function} Express 中间件
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      // 必填检查
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${rules.label || field} 是必填项` });
        continue;
      }

      if (value === undefined || value === null) continue;

      // 类型检查
      if (rules.type === 'number' && (typeof value !== 'number' || isNaN(value))) {
        errors.push({ field, message: `${rules.label || field} 必须是数字` });
      }

      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push({ field, message: `${rules.label || field} 必须是字符串` });
      }

      if (rules.type === 'boolean' && typeof value !== 'boolean') {
        errors.push({ field, message: `${rules.label || field} 必须是布尔值` });
      }

      // 范围检查
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ field, message: `${rules.label || field} 不能小于 ${rules.min}` });
      }

      if (rules.max !== undefined && value > rules.max) {
        errors.push({ field, message: `${rules.label || field} 不能大于 ${rules.max}` });
      }

      // 长度检查
      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors.push({ field, message: `${rules.label || field} 长度不能少于 ${rules.minLength}` });
      }

      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors.push({ field, message: `${rules.label || field} 长度不能超过 ${rules.maxLength}` });
      }

      // 枚举检查
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({ field, message: `${rules.label || field} 必须是以下之一: ${rules.enum.join(', ')}` });
      }

      // 正则检查
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors.push({ field, message: `${rules.label || field} 格式不正确` });
      }

      // 自定义验证
      if (rules.validate && typeof rules.validate === 'function') {
        const customError = rules.validate(value, req.body);
        if (customError) {
          errors.push({ field, message: customError });
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('请求数据验证失败', errors);
    }

    next();
  };
}

/**
 * 查询参数验证中间件
 * @param {Object} schema - 验证规则
 * @returns {Function} Express 中间件
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      let value = req.query[field];

      if (value === undefined) {
        if (rules.default !== undefined) {
          req.query[field] = rules.default;
        }
        if (rules.required) {
          errors.push({ field, message: `查询参数 ${field} 是必填项` });
        }
        continue;
      }

      // 类型转换
      if (rules.type === 'number') {
        value = Number(value);
        if (isNaN(value)) {
          errors.push({ field, message: `${field} 必须是数字` });
          continue;
        }
        req.query[field] = value;
      }

      if (rules.type === 'boolean') {
        req.query[field] = value === 'true' || value === '1';
      }

      if (rules.type === 'array') {
        req.query[field] = typeof value === 'string' ? value.split(',') : value;
      }

      // 范围检查
      if (rules.min !== undefined && Number(value) < rules.min) {
        errors.push({ field, message: `${field} 不能小于 ${rules.min}` });
      }

      if (rules.max !== undefined && Number(value) > rules.max) {
        errors.push({ field, message: `${field} 不能大于 ${rules.max}` });
      }

      // 枚举检查
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({ field, message: `${field} 必须是以下之一: ${rules.enum.join(', ')}` });
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('查询参数验证失败', errors);
    }

    next();
  };
}

// ─── 通用中间件 ──────────────────────────────────────────────

/**
 * 异步路由处理器包装器
 * 自动捕获 async 函数中的错误并传递给错误处理中间件
 * @param {Function} fn - 异步路由处理函数
 * @returns {Function} 包装后的路由处理函数
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 响应格式化中间件
 * 为 res 对象添加统一的响应方法
 */
export function responseFormatter(req, res, next) {
  /**
   * 成功响应
   */
  res.success = (data = null, message = '操作成功', meta = {}) => {
    const response = {
      success: true,
      message,
      data,
      ...meta,
      timestamp: new Date().toISOString(),
    };
    return res.json(response);
  };

  /**
   * 创建成功响应（201）
   */
  res.created = (data = null, message = '创建成功') => {
    return res.status(201).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * 无内容响应（204）
   */
  res.noContent = () => {
    return res.status(204).send();
  };

  /**
   * 分页响应
   */
  res.paginated = (data, total, page, pageSize) => {
    const totalPages = Math.ceil(total / pageSize);
    return res.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  };

  next();
}

/**
 * 请求超时中间件
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Function} Express 中间件
 */
export function requestTimeout(timeout = 30000) {
  return (req, res, next) => {
    req.setTimeout(timeout, () => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: `请求超时（${timeout / 1000}秒）`,
          },
        });
      }
    });
    next();
  };
}

/**
 * 安全头中间件（补充 helmet）
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

/**
 * API 版本中间件
 */
export function apiVersion(req, res, next) {
  const version = req.headers['accept-version'] || req.query.v || '1';
  req.apiVersion = version;
  res.setHeader('X-API-Version', version);
  next();
}

export default {
  errorHandler,
  notFoundHandler,
  requestLogger,
  rateLimiter,
  corsOptions,
  validateBody,
  validateQuery,
  asyncHandler,
  responseFormatter,
  requestTimeout,
  securityHeaders,
  apiVersion,
  AppError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  ConflictError,
  UnauthorizedError,
};
