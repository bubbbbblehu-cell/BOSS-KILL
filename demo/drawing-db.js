/**
 * 绘图服务数据库模块
 * 使用 SQLite 模拟绘图服务数据库
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'drawing.db');

// 创建数据库连接
const db = new sqlite3.Database(DB_PATH);

// 初始化数据库
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 绘画作品表
      db.run(`
        CREATE TABLE IF NOT EXISTS drawings (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          image_code TEXT UNIQUE NOT NULL,
          image_url TEXT,
          thumbnail_url TEXT,
          title TEXT,
          description TEXT,
          canvas_data TEXT,
          canvas_width INTEGER,
          canvas_height INTEGER,
          review_status TEXT DEFAULT 'pending',
          review_reason TEXT,
          reviewed_at TEXT,
          like_count INTEGER DEFAULT 0,
          view_count INTEGER DEFAULT 0,
          share_count INTEGER DEFAULT 0,
          is_public INTEGER DEFAULT 0,
          is_deleted INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          published_at TEXT
        )
      `);

      // 绘画标签表
      db.run(`
        CREATE TABLE IF NOT EXISTS drawing_tags (
          id TEXT PRIMARY KEY,
          drawing_id TEXT NOT NULL,
          tag_name TEXT NOT NULL,
          tag_category TEXT,
          UNIQUE(drawing_id, tag_name)
        )
      `);

      // 标签定义表
      db.run(`
        CREATE TABLE IF NOT EXISTS tag_definitions (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          category TEXT NOT NULL,
          color TEXT,
          icon TEXT,
          usage_count INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0
        )
      `);

      // 贴纸分类表
      db.run(`
        CREATE TABLE IF NOT EXISTS sticker_categories (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          color TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1
        )
      `);

      // 贴纸表
      db.run(`
        CREATE TABLE IF NOT EXISTS stickers (
          id TEXT PRIMARY KEY,
          category_id TEXT NOT NULL,
          name TEXT NOT NULL,
          image_url TEXT NOT NULL,
          thumbnail_url TEXT,
          is_premium INTEGER DEFAULT 0,
          unlock_type TEXT DEFAULT 'free',
          unlock_value INTEGER DEFAULT 0,
          usage_count INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0
        )
      `);

      // 用户解锁贴纸表
      db.run(`
        CREATE TABLE IF NOT EXISTS user_stickers (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          sticker_id TEXT NOT NULL,
          unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, sticker_id)
        )
      `);

      // 绘画使用的贴纸记录
      db.run(`
        CREATE TABLE IF NOT EXISTS drawing_stickers (
          id TEXT PRIMARY KEY,
          drawing_id TEXT NOT NULL,
          sticker_id TEXT NOT NULL,
          position_x REAL,
          position_y REAL,
          scale REAL DEFAULT 1.0,
          rotation REAL DEFAULT 0,
          z_index INTEGER DEFAULT 0
        )
      `);

      // 审核记录表
      db.run(`
        CREATE TABLE IF NOT EXISTS drawing_reviews (
          id TEXT PRIMARY KEY,
          drawing_id TEXT NOT NULL,
          review_type TEXT NOT NULL,
          review_result TEXT NOT NULL,
          review_reason TEXT,
          ai_score REAL,
          ai_categories TEXT,
          reviewer_id TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 用户积分表（简化版，仅用于贴纸解锁）
      db.run(`
        CREATE TABLE IF NOT EXISTS user_points (
          user_id TEXT PRIMARY KEY,
          available_points INTEGER DEFAULT 0
        )
      `);

      // 插入初始数据
      insertInitialData(resolve);
    });
  });
}

function insertInitialData(callback) {
  // 插入贴纸分类
  const categories = [
    ['cat_boss', 'boss', '老板系列', '各种老板形象贴纸', 'person', '#FF5722', 1],
    ['cat_emotion', 'emotion', '表情系列', '表达情绪的贴纸', 'mood', '#FFC107', 2],
    ['cat_poop', 'poop', '便便系列', '各种便便造型', 'emoji', '#795548', 3],
    ['cat_effect', 'effect', '特效系列', '动态特效贴纸', 'auto_awesome', '#9C27B0', 4],
    ['cat_text', 'text', '文字系列', '吐槽文字贴纸', 'text', '#2196F3', 5],
    ['cat_premium', 'premium', '限定系列', 'VIP限定贴纸', 'star', '#FFD700', 6]
  ];

  const catStmt = db.prepare(`INSERT OR IGNORE INTO sticker_categories (id, name, display_name, description, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  categories.forEach(c => catStmt.run(c));
  catStmt.finalize();

  // 插入贴纸
  const stickers = [
    // 老板系列
    ['sticker_001', 'cat_boss', '秃头老板', '/assets/stickers/boss/bald.png', 0, 'free', 0, 1],
    ['sticker_002', 'cat_boss', '胖老板', '/assets/stickers/boss/fat.png', 0, 'free', 0, 2],
    ['sticker_003', 'cat_boss', '瘦老板', '/assets/stickers/boss/thin.png', 0, 'free', 0, 3],
    ['sticker_004', 'cat_boss', '眼镜老板', '/assets/stickers/boss/glasses.png', 0, 'points', 50, 4],
    ['sticker_005', 'cat_boss', '西装老板', '/assets/stickers/boss/suit.png', 0, 'points', 100, 5],
    // 表情系列
    ['sticker_101', 'cat_emotion', '愤怒', '/assets/stickers/emotion/angry.png', 0, 'free', 0, 1],
    ['sticker_102', 'cat_emotion', '无语', '/assets/stickers/emotion/speechless.png', 0, 'free', 0, 2],
    ['sticker_103', 'cat_emotion', '大哭', '/assets/stickers/emotion/cry.png', 0, 'free', 0, 3],
    ['sticker_104', 'cat_emotion', '得意', '/assets/stickers/emotion/proud.png', 0, 'points', 30, 4],
    // 便便系列
    ['sticker_201', 'cat_poop', '普通便便', '/assets/stickers/poop/normal.png', 0, 'free', 0, 1],
    ['sticker_202', 'cat_poop', '金色便便', '/assets/stickers/poop/golden.png', 0, 'points', 100, 2],
    ['sticker_203', 'cat_poop', '彩虹便便', '/assets/stickers/poop/rainbow.png', 1, 'points', 500, 3],
    ['sticker_204', 'cat_poop', '爱心便便', '/assets/stickers/poop/heart.png', 0, 'points', 50, 4],
    // 特效系列
    ['sticker_301', 'cat_effect', '火焰', '/assets/stickers/effect/fire.png', 0, 'points', 80, 1],
    ['sticker_302', 'cat_effect', '闪电', '/assets/stickers/effect/lightning.png', 0, 'points', 80, 2],
    ['sticker_303', 'cat_effect', '爆炸', '/assets/stickers/effect/explosion.png', 1, 'points', 200, 3],
    // 文字系列
    ['sticker_401', 'cat_text', '996', '/assets/stickers/text/996.png', 0, 'free', 0, 1],
    ['sticker_402', 'cat_text', '加油', '/assets/stickers/text/jiayou.png', 0, 'free', 0, 2],
    ['sticker_403', 'cat_text', '打工人', '/assets/stickers/text/worker.png', 0, 'free', 0, 3],
    ['sticker_404', 'cat_text', 'OMG', '/assets/stickers/text/omg.png', 0, 'points', 30, 4]
  ];

  const stickerStmt = db.prepare(`INSERT OR IGNORE INTO stickers (id, category_id, name, image_url, is_premium, unlock_type, unlock_value, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  stickers.forEach(s => stickerStmt.run(s));
  stickerStmt.finalize();

  // 插入标签定义
  const tags = [
    // 老板类型
    ['tag_001', 'bald_boss', '秃头老板', 'boss_type', '#FF5722', 1],
    ['tag_002', '996_boss', '996老板', 'boss_type', '#F44336', 2],
    ['tag_003', 'pua_boss', 'PUA老板', 'boss_type', '#9C27B0', 3],
    ['tag_004', 'meeting_boss', '开会老板', 'boss_type', '#3F51B5', 4],
    ['tag_005', 'blame_boss', '甩锅老板', 'boss_type', '#009688', 5],
    // 情绪
    ['tag_101', 'angry', '愤怒', 'emotion', '#F44336', 1],
    ['tag_102', 'sad', '悲伤', 'emotion', '#2196F3', 2],
    ['tag_103', 'happy', '开心', 'emotion', '#4CAF50', 3],
    ['tag_104', 'tired', '疲惫', 'emotion', '#9E9E9E', 4],
    // 风格
    ['tag_201', 'cute', '可爱', 'style', '#E91E63', 1],
    ['tag_202', 'funny', '搞笑', 'style', '#FF9800', 2],
    ['tag_203', 'sarcastic', '讽刺', 'style', '#795548', 3],
    ['tag_204', 'realistic', '写实', 'style', '#607D8B', 4]
  ];

  const tagStmt = db.prepare(`INSERT OR IGNORE INTO tag_definitions (id, name, display_name, category, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)`);
  tags.forEach(t => tagStmt.run(t));
  tagStmt.finalize();

  // 插入测试用户积分
  db.run(`INSERT OR IGNORE INTO user_points (user_id, available_points) VALUES ('demo_user_001', 500)`);
  db.run(`INSERT OR IGNORE INTO user_points (user_id, available_points) VALUES ('demo_user_002', 100)`);

  // 预解锁一些贴纸给测试用户
  const unlockedStickers = [
    ['demo_user_001', 'sticker_001'],
    ['demo_user_001', 'sticker_101'],
    ['demo_user_001', 'sticker_201'],
    ['demo_user_001', 'sticker_401'],
  ];
  const unlockStmt = db.prepare(`INSERT OR IGNORE INTO user_stickers (id, user_id, sticker_id) VALUES (?, ?, ?)`);
  unlockedStickers.forEach(([userId, stickerId]) => {
    unlockStmt.run([`unlock_${userId}_${stickerId}`, userId, stickerId]);
  });
  unlockStmt.finalize();

  // 插入测试绘画作品
  const drawings = [
    ['drawing_001', 'demo_user_001', 'BOSS20260127001', '/uploads/demo1.png', '/uploads/demo1_thumb.png', '我的秃头老板', '画了一个天天开会的秃头老板', 'approved', 128, 560, 1],
    ['drawing_002', 'demo_user_001', 'BOSS20260127002', '/uploads/demo2.png', '/uploads/demo2_thumb.png', '996福报', '加班到深夜的日常', 'approved', 89, 320, 1],
    ['drawing_003', 'demo_user_001', 'BOSS20260127003', '/uploads/demo3.png', '/uploads/demo3_thumb.png', '未完成的作品', '还在画...', 'pending', 0, 0, 0]
  ];
  
  const drawingStmt = db.prepare(`INSERT OR IGNORE INTO drawings (id, user_id, image_code, image_url, thumbnail_url, title, description, review_status, like_count, view_count, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  drawings.forEach(d => drawingStmt.run(d));
  drawingStmt.finalize();

  // 插入测试标签
  const drawingTags = [
    ['drawing_001', 'bald_boss', 'boss_type'],
    ['drawing_001', 'meeting_boss', 'boss_type'],
    ['drawing_001', 'funny', 'style'],
    ['drawing_002', '996_boss', 'boss_type'],
    ['drawing_002', 'tired', 'emotion']
  ];
  
  const drawTagStmt = db.prepare(`INSERT OR IGNORE INTO drawing_tags (id, drawing_id, tag_name, tag_category) VALUES (?, ?, ?, ?)`);
  drawingTags.forEach(([drawingId, tagName, tagCategory]) => {
    drawTagStmt.run([`tag_${drawingId}_${tagName}`, drawingId, tagName, tagCategory]);
  });
  drawTagStmt.finalize();

  console.log('📦 数据库初始化完成');
  callback();
}

// 生成UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 生成图像编号
function generateImageCode() {
  return new Promise((resolve, reject) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    db.get(
      `SELECT COUNT(*) as count FROM drawings WHERE date(created_at) = date('now')`,
      (err, row) => {
        if (err) return reject(err);
        const num = String(row.count + 1).padStart(3, '0');
        resolve(`BOSS${dateStr}${num}`);
      }
    );
  });
}

module.exports = { db, initializeDatabase, generateUUID, generateImageCode };
