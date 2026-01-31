/**
 * 滑一滑服务 SQLite 数据库连接模块
 * 用于演示滑一滑功能的API调用流程
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'swipe.db');

// 创建数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('✅ 成功连接到滑一滑数据库');
    initializeDatabase();
  }
});

// 初始化数据库表结构
function initializeDatabase() {
  db.serialize(() => {
    // 内容表
    db.run(`
      CREATE TABLE IF NOT EXISTS contents (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        image_code TEXT,
        title TEXT,
        description TEXT,
        like_count INTEGER DEFAULT 0,
        favorite_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        review_status TEXT DEFAULT 'approved',
        is_active INTEGER DEFAULT 1,
        is_top INTEGER DEFAULT 0,
        top_rank INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 内容标签表
    db.run(`
      CREATE TABLE IF NOT EXISTS content_tags (
        id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        tag_name TEXT NOT NULL
      )
    `);

    // 用户点赞表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_likes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_id)
      )
    `);

    // 用户收藏表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_id)
      )
    `);

    // 用户浏览记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_views (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        view_duration INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 插入测试数据
    insertTestData();
  });
}

// 插入测试数据
function insertTestData() {
  const contents = [
    { id: 'content_001', author_id: 'user_001', image_url: 'https://example.com/boss1.png', image_code: 'BOSS001', title: '我的老板是秃头', description: '画了一个秃头老板', like_count: 1520, favorite_count: 320, view_count: 5600, is_top: 1, top_rank: 1 },
    { id: 'content_002', author_id: 'user_002', image_url: 'https://example.com/boss2.png', image_code: 'BOSS002', title: '996福报老板', description: '加班到深夜的老板', like_count: 1280, favorite_count: 280, view_count: 4200, is_top: 1, top_rank: 2 },
    { id: 'content_003', author_id: 'user_003', image_url: 'https://example.com/boss3.png', image_code: 'BOSS003', title: '画饼老板', description: '总是画大饼的老板', like_count: 980, favorite_count: 210, view_count: 3100, is_top: 1, top_rank: 3 },
    { id: 'content_004', author_id: 'user_001', image_url: 'https://example.com/boss4.png', image_code: 'BOSS004', title: '爱开会老板', description: '天天开会的老板', like_count: 650, favorite_count: 150, view_count: 2800, is_top: 0 },
    { id: 'content_005', author_id: 'user_004', image_url: 'https://example.com/boss5.png', image_code: 'BOSS005', title: '甩锅老板', description: '有问题就甩锅的老板', like_count: 520, favorite_count: 120, view_count: 2100, is_top: 0 },
    { id: 'content_006', author_id: 'user_002', image_url: 'https://example.com/boss6.png', image_code: 'BOSS006', title: '微管理老板', description: '事无巨细都要管的老板', like_count: 380, favorite_count: 90, view_count: 1500, is_top: 0 },
    { id: 'content_007', author_id: 'user_005', image_url: 'https://example.com/boss7.png', image_code: 'BOSS007', title: 'PUA大师', description: '精神打压的老板', like_count: 890, favorite_count: 200, view_count: 3500, is_top: 0 },
    { id: 'content_008', author_id: 'user_003', image_url: 'https://example.com/boss8.png', image_code: 'BOSS008', title: '朝令夕改', description: '想法多变的老板', like_count: 450, favorite_count: 100, view_count: 1800, is_top: 0 },
  ];

  const tags = [
    { content_id: 'content_001', tag_name: '秃头' },
    { content_id: 'content_001', tag_name: '搞笑' },
    { content_id: 'content_002', tag_name: '996' },
    { content_id: 'content_002', tag_name: '加班' },
    { content_id: 'content_003', tag_name: '画饼' },
    { content_id: 'content_003', tag_name: '忽悠' },
    { content_id: 'content_004', tag_name: '开会' },
    { content_id: 'content_005', tag_name: '甩锅' },
    { content_id: 'content_006', tag_name: '微管理' },
    { content_id: 'content_007', tag_name: 'PUA' },
    { content_id: 'content_007', tag_name: '压力' },
    { content_id: 'content_008', tag_name: '朝令夕改' },
  ];

  const insertContent = db.prepare(`
    INSERT OR REPLACE INTO contents (id, author_id, image_url, image_code, title, description, like_count, favorite_count, view_count, is_top, top_rank)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTag = db.prepare(`
    INSERT OR REPLACE INTO content_tags (id, content_id, tag_name)
    VALUES (?, ?, ?)
  `);

  contents.forEach(c => {
    insertContent.run(c.id, c.author_id, c.image_url, c.image_code, c.title, c.description, c.like_count, c.favorite_count, c.view_count, c.is_top, c.top_rank || null);
  });
  insertContent.finalize();

  tags.forEach((t, idx) => {
    insertTag.run(`tag_${idx + 1}`, t.content_id, t.tag_name);
  });
  insertTag.finalize();

  console.log('✅ 测试数据初始化完成');
}

// Promise包装查询方法
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// 生成UUID
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = { db, query, run, get, uuid };
