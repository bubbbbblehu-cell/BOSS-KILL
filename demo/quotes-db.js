/**
 * 激励文字服务 SQLite 数据库连接模块
 * 用于演示激励文字的API调用流程
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'quotes.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('✅ 成功连接到激励文字数据库');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 激励文字表
    db.run(`
      CREATE TABLE IF NOT EXISTS motivational_quotes (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        category TEXT NOT NULL,
        author TEXT DEFAULT '系统',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        usage_count INTEGER DEFAULT 0,
        effectiveness_score REAL DEFAULT 0.0,
        is_active INTEGER DEFAULT 1,
        tags TEXT
      )
    `);

    // 用户文字使用记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_quote_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quote_id TEXT NOT NULL,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_rating INTEGER
      )
    `);

    // 文字分类表
    db.run(`
      CREATE TABLE IF NOT EXISTS quote_categories (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      )
    `);

    insertTestData();
  });
}

function insertTestData() {
  // 插入分类
  const categories = [
    { id: 'cat_motivation', name: 'motivation', display_name: '激励类', description: '激发斗志的正面激励文字', color: '#4CAF50', icon: 'trending_up', sort_order: 1 },
    { id: 'cat_humor', name: 'humor', display_name: '幽默类', description: '轻松幽默的搞笑文字', color: '#FF9800', icon: 'sentiment_satisfied', sort_order: 2 },
    { id: 'cat_inspirational', name: 'inspirational', display_name: '鼓舞类', description: '富有哲理的鼓舞人心文字', color: '#2196F3', icon: 'lightbulb', sort_order: 3 },
    { id: 'cat_sarcastic', name: 'sarcastic', display_name: '讽刺类', description: '带有讽刺意味的文字', color: '#F44336', icon: 'mood_bad', sort_order: 4 },
  ];

  const insertCat = db.prepare(`INSERT OR REPLACE INTO quote_categories (id, name, display_name, description, color, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  categories.forEach(c => insertCat.run(c.id, c.name, c.display_name, c.description, c.color, c.icon, c.sort_order));
  insertCat.finalize();

  // 插入激励文字
  const quotes = [
    { id: 'quote_001', text: '在最好的青春里，在格子间里激励自己开出最美的花！', category: 'motivation', effectiveness_score: 0.92, tags: '["青春", "奋斗", "激励"]' },
    { id: 'quote_002', text: '工作虽苦，但扔大便的快乐谁懂？', category: 'humor', effectiveness_score: 0.88, tags: '["幽默", "工作", "快乐"]' },
    { id: 'quote_003', text: '996的你，值得一个大大的便便！', category: 'sarcastic', effectiveness_score: 0.85, tags: '["讽刺", "加班", "释放"]' },
    { id: 'quote_004', text: '在格子间里，做一个会扔便便的自由灵魂', category: 'inspirational', effectiveness_score: 0.90, tags: '["自由", "灵魂", "格子间"]' },
    { id: 'quote_005', text: '青春不只是奋斗，还有扔大便的快感', category: 'motivation', effectiveness_score: 0.86, tags: '["青春", "奋斗", "快感"]' },
    { id: 'quote_006', text: '工作压力大？扔个便便释放一下', category: 'humor', effectiveness_score: 0.87, tags: '["压力", "释放", "幽默"]' },
    { id: 'quote_007', text: '在办公室的角落，藏着你的小确幸', category: 'inspirational', effectiveness_score: 0.89, tags: '["办公室", "确幸", "角落"]' },
    { id: 'quote_008', text: '不是加班辛苦，是没扔便便的遗憾', category: 'sarcastic', effectiveness_score: 0.82, tags: '["加班", "遗憾", "讽刺"]' },
    { id: 'quote_009', text: '扔出你的不满，迎接更好的明天', category: 'motivation', effectiveness_score: 0.91, tags: '["不满", "明天", "迎接"]' },
    { id: 'quote_010', text: '便便虽小，快乐无穷', category: 'humor', effectiveness_score: 0.84, tags: '["快乐", "无穷", "幽默"]' },
    { id: 'quote_011', text: '在格子间里，找到属于你的释放方式', category: 'inspirational', effectiveness_score: 0.88, tags: '["格子间", "释放", "方式"]' },
    { id: 'quote_012', text: '工作再累，也要记得扔便便的乐趣', category: 'motivation', effectiveness_score: 0.85, tags: '["工作", "累", "乐趣"]' },
    { id: 'quote_013', text: '青春奋斗路，便便相伴', category: 'inspirational', effectiveness_score: 0.83, tags: '["青春", "奋斗", "相伴"]' },
    { id: 'quote_014', text: '释放压力，从扔便便开始', category: 'motivation', effectiveness_score: 0.90, tags: '["释放", "压力", "开始"]' },
    { id: 'quote_015', text: '在办公室里，做一个快乐的扔便便者', category: 'humor', effectiveness_score: 0.86, tags: '["办公室", "快乐", "扔便便者"]' },
  ];

  const insertQuote = db.prepare(`INSERT OR REPLACE INTO motivational_quotes (id, text, category, effectiveness_score, tags) VALUES (?, ?, ?, ?, ?)`);
  quotes.forEach(q => insertQuote.run(q.id, q.text, q.category, q.effectiveness_score, q.tags));
  insertQuote.finalize();

  console.log('✅ 测试数据初始化完成');
}

// Promise包装
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

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = { db, query, run, get, uuid };
