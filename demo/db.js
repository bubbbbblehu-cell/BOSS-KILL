// 数据库模块 - 模拟激励文字数据库
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'quotes.db');
const db = new sqlite3.Database(dbPath);

// 初始化数据库
db.serialize(() => {
  // 创建激励文字表
  db.run(`
    CREATE TABLE IF NOT EXISTS motivational_quotes (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      category TEXT,
      author TEXT,
      usage_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 插入初始数据
  const quotes = [
    ['quote_001', '在最好的青春里，在格子间里激励自己开出最美的花！', 'motivation', '系统'],
    ['quote_002', '工作虽苦，但扔大便的快乐谁懂？', 'humor', '系统'],
    ['quote_003', '996的你，值得一个大大的便便！', 'sarcastic', '系统'],
    ['quote_004', '在格子间里，做一个会扔便便的自由灵魂', 'inspirational', '系统'],
    ['quote_005', '青春不只是奋斗，还有扔大便的快感', 'motivation', '系统'],
    ['quote_006', '工作压力大？扔个便便释放一下', 'humor', '系统'],
    ['quote_007', '便便虽小，快乐无穷', 'humor', '系统'],
    ['quote_008', '扔出你的不满，迎接更好的明天', 'motivation', '系统'],
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO motivational_quotes (id, text, category, author) VALUES (?, ?, ?, ?)');
  quotes.forEach(q => stmt.run(q));
  stmt.finalize();
});

// 获取随机激励文字（模拟存储过程 get_random_motivational_quote）
function getRandomQuote() {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, text, category, author FROM motivational_quotes ORDER BY RANDOM() LIMIT 1',
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

// 获取所有激励文字
function getAllQuotes() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM motivational_quotes', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { db, getRandomQuote, getAllQuotes };
