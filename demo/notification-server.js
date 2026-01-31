/**
 * 通知服务 API 服务器
 * 演示通知、邮箱验证码、安全提醒等功能的完整调用链路
 */

const express = require('express');
const { query, run, get, uuid } = require('./notification-db');

const app = express();
app.use(express.json());

const PORT = 3005;

// ============================================
// 通知消息API
// ============================================

// API: GET /api/notifications - 获取通知列表
app.get('/api/notifications', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const type = req.query.type;
    const unreadOnly = req.query.unread_only === 'true';
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 20;
    const offset = (page - 1) * pageSize;

    console.log(`\n📡 [API] GET /api/notifications - 用户: ${userId}, 类型: ${type || '全部'}`);

    let sql = `
      SELECT id, title, body, data, notification_type, priority, is_read, read_at, created_at
      FROM notifications
      WHERE user_id = ? AND is_deleted = 0
    `;
    const params = [userId];

    if (type) {
      sql += ' AND notification_type = ?';
      params.push(type);
    }
    if (unreadOnly) {
      sql += ' AND is_read = 0';
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const notifications = await query(sql, params);

    // 获取未读数量
    const unreadCount = await get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0 AND is_deleted = 0', [userId]);

    console.log(`   → 返回 ${notifications.length} 条通知，未读 ${unreadCount.count} 条`);
    res.json({ success: true, data: notifications, unread_count: unreadCount.count });
  } catch (error) {
    console.error('获取通知失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: POST /api/notifications - 创建新通知
app.post('/api/notifications', async (req, res) => {
  try {
    const { user_id, title, body, notification_type, priority, data } = req.body;
    console.log(`\n📡 [API] POST /api/notifications - 创建通知: ${title}`);

    const id = uuid();
    await run(`
      INSERT INTO notifications (id, user_id, title, body, notification_type, priority, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, user_id, title, body, notification_type, priority || 'normal', JSON.stringify(data || {})]);

    console.log(`   → ✅ 通知已创建: ${id}`);
    res.json({ success: true, notification_id: id });
  } catch (error) {
    console.error('创建通知失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: PUT /api/notifications/:id/read - 标记通知已读
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.user_id || req.query.user_id;
    console.log(`\n📡 [API] PUT /api/notifications/${id}/read - 标记已读`);

    const result = await run('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.changes > 0) {
      console.log('   → ✅ 已标记为已读');
      res.json({ success: true });
    } else {
      res.json({ success: false, message: '通知不存在' });
    }
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: PUT /api/notifications/read-all - 标记所有通知已读
app.put('/api/notifications/read-all', async (req, res) => {
  try {
    const userId = req.body.user_id;
    const type = req.body.type;
    console.log(`\n📡 [API] PUT /api/notifications/read-all - 用户: ${userId}`);

    let sql = 'UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0';
    const params = [userId];

    if (type) {
      sql += ' AND notification_type = ?';
      params.push(type);
    }

    const result = await run(sql, params);
    console.log(`   → ✅ 已标记 ${result.changes} 条通知为已读`);
    res.json({ success: true, marked_count: result.changes });
  } catch (error) {
    console.error('标记全部已读失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: GET /api/notifications/unread-count - 获取未读数量
app.get('/api/notifications/unread-count', async (req, res) => {
  try {
    const userId = req.query.user_id;
    console.log(`\n📡 [API] GET /api/notifications/unread-count - 用户: ${userId}`);

    const counts = await get(`
      SELECT 
        COUNT(*) as total_unread,
        COUNT(CASE WHEN notification_type = 'security' THEN 1 END) as security_unread,
        COUNT(CASE WHEN notification_type = 'activity' THEN 1 END) as activity_unread,
        COUNT(CASE WHEN notification_type = 'social' THEN 1 END) as social_unread,
        COUNT(CASE WHEN notification_type = 'reward' THEN 1 END) as reward_unread,
        COUNT(CASE WHEN notification_type = 'system' THEN 1 END) as system_unread
      FROM notifications
      WHERE user_id = ? AND is_read = 0 AND is_deleted = 0
    `, [userId]);

    console.log(`   → 未读总数: ${counts.total_unread}`);
    res.json({ success: true, data: counts });
  } catch (error) {
    console.error('获取未读数量失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 邮箱验证码API
// ============================================

// API: POST /api/email/send-code - 发送验证码
app.post('/api/email/send-code', async (req, res) => {
  try {
    const { email, code_type } = req.body;
    const ipAddress = req.ip || '127.0.0.1';
    console.log(`\n📡 [API] POST /api/email/send-code - 邮箱: ${email}, 类型: ${code_type}`);

    // 检查发送频率（1分钟内只能发送1次）
    const recentCode = await get(`
      SELECT COUNT(*) as count FROM email_verification_codes
      WHERE email = ? AND datetime(created_at) > datetime('now', '-1 minute')
    `, [email]);

    if (recentCode.count > 0) {
      console.log('   → ⚠️ 发送太频繁');
      return res.json({ success: false, message: '发送太频繁，请稍后再试' });
    }

    // 生成6位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeId = uuid();

    // 作废之前的验证码
    await run('UPDATE email_verification_codes SET is_used = 1 WHERE email = ? AND code_type = ? AND is_used = 0', [email, code_type]);

    // 插入新验证码（15分钟有效）
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await run(`
      INSERT INTO email_verification_codes (id, email, code, code_type, expires_at, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [codeId, email, code, code_type, expiresAt, ipAddress]);

    // 记录发送日志
    await run(`
      INSERT INTO email_send_logs (id, email, email_type, subject, status)
      VALUES (?, ?, ?, ?, ?)
    `, [uuid(), email, 'verification_code', `${code_type} 验证码`, 'sent']);

    console.log(`   → ✅ 验证码已生成: ${code} (有效期15分钟)`);
    console.log(`   → 📧 邮件已发送（模拟）`);

    res.json({
      success: true,
      message: '验证码已发送',
      expires_in: 900,  // 15分钟 = 900秒
      // 仅演示用，实际不返回验证码
      _demo_code: code
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: POST /api/email/verify-code - 验证验证码
app.post('/api/email/verify-code', async (req, res) => {
  try {
    const { email, code, code_type } = req.body;
    console.log(`\n📡 [API] POST /api/email/verify-code - 邮箱: ${email}, 验证码: ${code}`);

    const codeRecord = await get(`
      SELECT id, expires_at, is_used FROM email_verification_codes
      WHERE email = ? AND code = ? AND code_type = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [email, code, code_type]);

    if (!codeRecord) {
      console.log('   → ❌ 验证码错误');
      return res.json({ success: false, message: '验证码错误' });
    }

    if (codeRecord.is_used) {
      console.log('   → ❌ 验证码已使用');
      return res.json({ success: false, message: '验证码已使用' });
    }

    if (new Date(codeRecord.expires_at) < new Date()) {
      console.log('   → ❌ 验证码已过期');
      return res.json({ success: false, message: '验证码已过期' });
    }

    // 标记为已使用
    await run('UPDATE email_verification_codes SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?', [codeRecord.id]);

    console.log('   → ✅ 验证成功');
    res.json({ success: true, message: '验证成功' });
  } catch (error) {
    console.error('验证验证码失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 安全事件API
// ============================================

// API: POST /api/security/event - 创建安全事件
app.post('/api/security/event', async (req, res) => {
  try {
    const { user_id, event_type, description, device_info, ip_address, location, risk_level } = req.body;
    console.log(`\n📡 [API] POST /api/security/event - 用户: ${user_id}, 事件: ${event_type}`);

    const eventId = uuid();

    // 插入安全事件
    await run(`
      INSERT INTO security_events (id, user_id, event_type, event_description, device_info, ip_address, location, risk_level, app_notified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [eventId, user_id, event_type, description, JSON.stringify(device_info || {}), ip_address, location, risk_level || 'medium']);

    // 生成通知内容
    let title, body;
    switch (event_type) {
      case 'new_device_login':
        title = '新设备登录提醒';
        body = `您的账号在新设备上登录，位置：${location || '未知'}。如非本人操作，请立即修改密码。`;
        break;
      case 'abnormal_location':
        title = '异地登录提醒';
        body = `检测到您的账号在异常位置登录：${location || '未知'}。如非本人操作，请立即处理。`;
        break;
      case 'password_change':
        title = '密码修改通知';
        body = '您的账号密码已修改。如非本人操作，请立即联系客服。';
        break;
      default:
        title = '安全提醒';
        body = description || '检测到账号安全事件，请及时查看。';
    }

    // 创建APP内通知
    const notificationId = uuid();
    const priority = ['high', 'critical'].includes(risk_level) ? 'urgent' : 'high';
    await run(`
      INSERT INTO notifications (id, user_id, title, body, notification_type, priority, data)
      VALUES (?, ?, ?, ?, 'security', ?, ?)
    `, [notificationId, user_id, title, body, priority, JSON.stringify({ event_id: eventId, event_type })]);

    console.log(`   → ✅ 安全事件已记录: ${eventId}`);
    console.log(`   → 📱 APP通知已创建: ${title}`);
    console.log(`   → 📧 邮件通知已发送（模拟）`);

    res.json({
      success: true,
      event_id: eventId,
      notification_id: notificationId,
      channels: ['app', 'email']  // 双通道通知
    });
  } catch (error) {
    console.error('创建安全事件失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: GET /api/security/events - 获取安全事件历史
app.get('/api/security/events', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 10;
    const offset = (page - 1) * pageSize;

    console.log(`\n📡 [API] GET /api/security/events - 用户: ${userId}`);

    const events = await query(`
      SELECT id, event_type, event_description, device_info, ip_address, location, risk_level, created_at
      FROM security_events
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, pageSize, offset]);

    console.log(`   → 返回 ${events.length} 条安全事件`);
    res.json({ success: true, data: events });
  } catch (error) {
    console.error('获取安全事件失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 通知设置API
// ============================================

// API: GET /api/notifications/settings - 获取通知设置
app.get('/api/notifications/settings', async (req, res) => {
  try {
    const userId = req.query.user_id;
    console.log(`\n📡 [API] GET /api/notifications/settings - 用户: ${userId}`);

    // 如果不存在则创建默认设置
    await run('INSERT OR IGNORE INTO user_notification_settings (user_id) VALUES (?)', [userId]);

    const settings = await get('SELECT * FROM user_notification_settings WHERE user_id = ?', [userId]);
    console.log('   → 返回用户通知设置');
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('获取通知设置失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: PUT /api/notifications/settings - 更新通知设置
app.put('/api/notifications/settings', async (req, res) => {
  try {
    const { user_id, settings } = req.body;
    console.log(`\n📡 [API] PUT /api/notifications/settings - 用户: ${user_id}`);

    // 构建更新SQL
    const updates = [];
    const params = [];

    for (const [key, value] of Object.entries(settings)) {
      if (['push_enabled', 'push_security', 'push_activity', 'push_social', 'email_enabled', 'email_security', 'email_activity'].includes(key)) {
        updates.push(`${key} = ?`);
        params.push(value ? 1 : 0);
      }
    }

    if (updates.length > 0) {
      params.push(user_id);
      await run(`UPDATE user_notification_settings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, params);
    }

    console.log('   → ✅ 通知设置已更新');
    res.json({ success: true, message: '设置已更新' });
  } catch (error) {
    console.error('更新通知设置失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 通知服务 API 服务器运行在 http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 API接口列表:');
  console.log('   GET  /api/notifications            获取通知列表');
  console.log('   POST /api/notifications            创建新通知');
  console.log('   PUT  /api/notifications/:id/read   标记单条已读');
  console.log('   PUT  /api/notifications/read-all   标记全部已读');
  console.log('   GET  /api/notifications/unread-count 未读数量');
  console.log('   GET  /api/notifications/settings   获取通知设置');
  console.log('   PUT  /api/notifications/settings   更新通知设置');
  console.log('   POST /api/email/send-code          发送验证码');
  console.log('   POST /api/email/verify-code        验证验证码');
  console.log('   POST /api/security/event           创建安全事件');
  console.log('   GET  /api/security/events          获取安全事件');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
