/**
 * 推荐服务 SQLite 数据库连接模块
 * 用于演示社交关系、礼物、积分、打卡等功能的API调用流程
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'recommendation.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('✅ 成功连接到推荐服务数据库');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 用户关注表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id TEXT PRIMARY KEY,
        follower_id TEXT NOT NULL,
        following_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      )
    `);

    // 用户好友表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_friends (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        friend_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        accepted_at DATETIME,
        UNIQUE(user_id, friend_id)
      )
    `);

    // 礼物定义表
    db.run(`
      CREATE TABLE IF NOT EXISTS gifts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon_url TEXT,
        description TEXT,
        price_points INTEGER DEFAULT 0,
        effect_type TEXT,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      )
    `);

    // 礼物发送记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS gift_records (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        gift_id TEXT NOT NULL,
        content_id TEXT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 用户积分表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_points (
        user_id TEXT PRIMARY KEY,
        total_points INTEGER DEFAULT 0,
        available_points INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 积分变动记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS point_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        points INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        reference_id TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 积分规则表
    db.run(`
      CREATE TABLE IF NOT EXISTS point_rules (
        id TEXT PRIMARY KEY,
        action_type TEXT UNIQUE NOT NULL,
        points_value INTEGER DEFAULT 0,
        daily_limit INTEGER DEFAULT -1,
        description TEXT,
        is_active INTEGER DEFAULT 1
      )
    `);

    // 打卡记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS check_in_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        check_in_date DATE NOT NULL,
        streak_count INTEGER DEFAULT 1,
        points_earned INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, check_in_date)
      )
    `);

    // 打卡统计表
    db.run(`
      CREATE TABLE IF NOT EXISTS check_in_stats (
        user_id TEXT PRIMARY KEY,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        total_check_ins INTEGER DEFAULT 0,
        last_check_in_date DATE,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 奖励定义表
    db.run(`
      CREATE TABLE IF NOT EXISTS rewards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon_url TEXT,
        reward_type TEXT NOT NULL,
        required_points INTEGER DEFAULT 0,
        required_streak INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      )
    `);

    // 用户已解锁奖励表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_rewards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        reward_id TEXT NOT NULL,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_equipped INTEGER DEFAULT 0,
        UNIQUE(user_id, reward_id)
      )
    `);

    // 用户行为记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_actions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_value INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    insertTestData();
  });
}

function insertTestData() {
  // 积分规则
  const rules = [
    { action_type: 'view', points_value: 1, daily_limit: 50, description: '浏览内容' },
    { action_type: 'like', points_value: 2, daily_limit: 30, description: '点赞内容' },
    { action_type: 'comment', points_value: 5, daily_limit: 20, description: '评论内容' },
    { action_type: 'favorite', points_value: 3, daily_limit: 20, description: '收藏内容' },
    { action_type: 'share', points_value: 10, daily_limit: 10, description: '分享内容' },
    { action_type: 'checkin', points_value: 10, daily_limit: 1, description: '每日打卡' },
  ];

  const insertRule = db.prepare(`INSERT OR REPLACE INTO point_rules (id, action_type, points_value, daily_limit, description) VALUES (?, ?, ?, ?, ?)`);
  rules.forEach((r, i) => insertRule.run(`rule_${i+1}`, r.action_type, r.points_value, r.daily_limit, r.description));
  insertRule.finalize();

  // 礼物
  const gifts = [
    { id: 'gift_001', name: '小红花', price_points: 10, effect_type: 'basic' },
    { id: 'gift_002', name: '便便徽章', price_points: 50, effect_type: 'bronze' },
    { id: 'gift_003', name: '金色便便', price_points: 200, effect_type: 'gold' },
    { id: 'gift_004', name: '便便之王', price_points: 500, effect_type: 'legendary' },
  ];

  const insertGift = db.prepare(`INSERT OR REPLACE INTO gifts (id, name, price_points, effect_type, is_active) VALUES (?, ?, ?, ?, 1)`);
  gifts.forEach(g => insertGift.run(g.id, g.name, g.price_points, g.effect_type));
  insertGift.finalize();

  // 奖励
  const rewards = [
    { id: 'reward_001', name: '新手便便侠', reward_type: 'title', required_points: 0, required_streak: 0 },
    { id: 'reward_002', name: '便便达人', reward_type: 'title', required_points: 100, required_streak: 0 },
    { id: 'reward_003', name: '便便大师', reward_type: 'title', required_points: 500, required_streak: 0 },
    { id: 'reward_101', name: '基础便便贴纸包', reward_type: 'sticker', required_points: 50, required_streak: 0 },
    { id: 'reward_301', name: '青铜便便框', reward_type: 'avatar_frame', required_points: 50, required_streak: 0 },
    { id: 'reward_304', name: '传奇便便框', reward_type: 'avatar_frame', required_points: 0, required_streak: 7 },
  ];

  const insertReward = db.prepare(`INSERT OR REPLACE INTO rewards (id, name, reward_type, required_points, required_streak, is_active) VALUES (?, ?, ?, ?, ?, 1)`);
  rewards.forEach(r => insertReward.run(r.id, r.name, r.reward_type, r.required_points, r.required_streak));
  insertReward.finalize();

  // 测试用户积分
  const users = [
    { user_id: 'demo_user_001', total_points: 350, available_points: 280, level: 3 },
    { user_id: 'user_002', total_points: 520, available_points: 450, level: 4 },
    { user_id: 'user_003', total_points: 180, available_points: 150, level: 2 },
  ];

  const insertUser = db.prepare(`INSERT OR REPLACE INTO user_points (user_id, total_points, available_points, level) VALUES (?, ?, ?, ?)`);
  users.forEach(u => insertUser.run(u.user_id, u.total_points, u.available_points, u.level));
  insertUser.finalize();

  // 测试打卡统计
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  const stats = [
    { user_id: 'demo_user_001', current_streak: 6, longest_streak: 15, total_check_ins: 45, last_check_in_date: yesterday },
    { user_id: 'user_002', current_streak: 12, longest_streak: 12, total_check_ins: 38, last_check_in_date: today },
    { user_id: 'user_003', current_streak: 3, longest_streak: 8, total_check_ins: 22, last_check_in_date: yesterday },
  ];

  const insertStat = db.prepare(`INSERT OR REPLACE INTO check_in_stats (user_id, current_streak, longest_streak, total_check_ins, last_check_in_date) VALUES (?, ?, ?, ?, ?)`);
  stats.forEach(s => insertStat.run(s.user_id, s.current_streak, s.longest_streak, s.total_check_ins, s.last_check_in_date));
  insertStat.finalize();

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
