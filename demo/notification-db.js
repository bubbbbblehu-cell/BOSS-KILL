/**
 * 通知服务 SQLite 数据库连接模块
 * 用于演示通知、验证码、安全提醒等功能的API调用流程
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'notification.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('✅ 成功连接到通知服务数据库');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 通知表
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data TEXT,
        notification_type TEXT NOT NULL,
        priority TEXT DEFAULT 'normal',
        is_read INTEGER DEFAULT 0,
        read_at DATETIME,
        is_deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 邮箱验证码表
    db.run(`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        code_type TEXT NOT NULL,
        is_used INTEGER DEFAULT 0,
        used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        ip_address TEXT
      )
    `);

    // 邮件发送日志表
    db.run(`
      CREATE TABLE IF NOT EXISTS email_send_logs (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        email_type TEXT NOT NULL,
        subject TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME
      )
    `);

    // 安全事件表
    db.run(`
      CREATE TABLE IF NOT EXISTS security_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_description TEXT,
        device_info TEXT,
        ip_address TEXT,
        location TEXT,
        risk_level TEXT DEFAULT 'low',
        email_notified INTEGER DEFAULT 0,
        app_notified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 用户通知设置表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_notification_settings (
        user_id TEXT PRIMARY KEY,
        push_enabled INTEGER DEFAULT 1,
        push_security INTEGER DEFAULT 1,
        push_activity INTEGER DEFAULT 1,
        push_social INTEGER DEFAULT 1,
        email_enabled INTEGER DEFAULT 1,
        email_security INTEGER DEFAULT 1,
        email_activity INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 通知模板表
    db.run(`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id TEXT PRIMARY KEY,
        template_code TEXT UNIQUE NOT NULL,
        title_template TEXT NOT NULL,
        body_template TEXT NOT NULL,
        notification_type TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
      )
    `);

    insertTestData();
  });
}

function insertTestData() {
  // 通知模板
  const templates = [
    { id: 'tpl_001', template_code: 'security_new_device', title_template: '新设备登录提醒', body_template: '您的账号在新设备（{device_name}）上登录，位置：{location}。', notification_type: 'security' },
    { id: 'tpl_002', template_code: 'security_abnormal_login', title_template: '异地登录提醒', body_template: '检测到您的账号在异常位置（{location}）登录。', notification_type: 'security' },
    { id: 'tpl_003', template_code: 'social_new_follower', title_template: '新粉丝提醒', body_template: '{user_name}关注了你！', notification_type: 'social' },
    { id: 'tpl_004', template_code: 'reward_points_earned', title_template: '积分到账', body_template: '恭喜获得{points}积分！', notification_type: 'reward' },
  ];

  const insertTemplate = db.prepare(`INSERT OR REPLACE INTO notification_templates (id, template_code, title_template, body_template, notification_type) VALUES (?, ?, ?, ?, ?)`);
  templates.forEach(t => insertTemplate.run(t.id, t.template_code, t.title_template, t.body_template, t.notification_type));
  insertTemplate.finalize();

  // 测试通知
  const notifications = [
    { id: 'notif_001', user_id: 'demo_user_001', title: '欢迎来到BOSS KILL', body: '开始你的扔便便之旅吧！', notification_type: 'system', priority: 'normal', is_read: 0 },
    { id: 'notif_002', user_id: 'demo_user_001', title: '新设备登录提醒', body: '您的账号在iPhone 15上登录，位置：杭州。如非本人操作，请立即修改密码。', notification_type: 'security', priority: 'high', is_read: 0 },
    { id: 'notif_003', user_id: 'demo_user_001', title: 'user_002关注了你', body: '快去看看ta的主页吧！', notification_type: 'social', priority: 'normal', is_read: 1 },
    { id: 'notif_004', user_id: 'demo_user_001', title: '恭喜获得100积分', body: '连续打卡7天奖励', notification_type: 'reward', priority: 'normal', is_read: 0 },
    { id: 'notif_005', user_id: 'demo_user_001', title: '新活动上线', body: '便便大作战活动已开启，参与即可获得限定皮肤！', notification_type: 'activity', priority: 'normal', is_read: 0 },
  ];

  const insertNotif = db.prepare(`INSERT OR REPLACE INTO notifications (id, user_id, title, body, notification_type, priority, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  notifications.forEach(n => insertNotif.run(n.id, n.user_id, n.title, n.body, n.notification_type, n.priority, n.is_read));
  insertNotif.finalize();

  // 测试用户设置
  db.run(`INSERT OR REPLACE INTO user_notification_settings (user_id, push_enabled, email_enabled, email_security) VALUES ('demo_user_001', 1, 1, 1)`);

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
