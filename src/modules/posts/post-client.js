/**
 * 通知服务 前端模拟客户端
 * 演示通知、验证码、安全提醒的完整调用流程
 */

const http = require('http');

const API_BASE = 'http://localhost:3005';
const TEST_USER_ID = 'demo_user_001';
const TEST_EMAIL = 'demo@example.com';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve(body); }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// API方法封装
const NotificationService = {
  getNotifications: (userId, type, unreadOnly) =>
    request('GET', `/api/notifications?user_id=${userId}${type ? `&type=${type}` : ''}${unreadOnly ? '&unread_only=true' : ''}`),
  createNotification: (userId, title, body, type, priority) =>
    request('POST', '/api/notifications', { user_id: userId, title, body, notification_type: type, priority }),
  markRead: (notificationId, userId) =>
    request('PUT', `/api/notifications/${notificationId}/read?user_id=${userId}`),
  markAllRead: (userId, type) =>
    request('PUT', '/api/notifications/read-all', { user_id: userId, type }),
  getUnreadCount: (userId) =>
    request('GET', `/api/notifications/unread-count?user_id=${userId}`),
  getSettings: (userId) =>
    request('GET', `/api/notifications/settings?user_id=${userId}`),
  updateSettings: (userId, settings) =>
    request('PUT', '/api/notifications/settings', { user_id: userId, settings }),
  sendEmailCode: (email, codeType) =>
    request('POST', '/api/email/send-code', { email, code_type: codeType }),
  verifyEmailCode: (email, code, codeType) =>
    request('POST', '/api/email/verify-code', { email, code, code_type: codeType }),
  createSecurityEvent: (userId, eventType, location, deviceInfo) =>
    request('POST', '/api/security/event', { user_id: userId, event_type: eventType, location, device_info: deviceInfo, risk_level: 'medium' }),
  getSecurityEvents: (userId) =>
    request('GET', `/api/security/events?user_id=${userId}`),
};

function printSeparator(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printNotification(notif, index) {
  const typeIcons = {
    'security': '🔒',
    'activity': '🎉',
    'social': '👥',
    'reward': '🎁',
    'system': '📢'
  };
  const priorityMarks = {
    'urgent': '🔴',
    'high': '🟠',
    'normal': '⚪',
    'low': '⚫'
  };

  const icon = typeIcons[notif.notification_type] || '📌';
  const priority = priorityMarks[notif.priority] || '⚪';
  const readStatus = notif.is_read ? '✓已读' : '●未读';

  console.log(`\n  ${index}. ${icon} ${notif.title} ${priority}`);
  console.log(`     ${notif.body}`);
  console.log(`     [${notif.notification_type}] ${readStatus} · ${notif.created_at?.substring(0, 16) || ''}`);
}

async function runDemo() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              BOSS KILL 通知服务 演示                        ║');
  console.log('║      通知消息 · 邮箱验证码 · 安全提醒 · 双通道通知             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n👤 演示用户: ${TEST_USER_ID}`);
  console.log(`📧 演示邮箱: ${TEST_EMAIL}`);

  try {
    // ====== 流程1: 获取未读数量 ======
    printSeparator('流程1: 获取未读通知数量');
    console.log('\n📱 [前端] 首页加载时获取未读数量（用于角标显示）');
    console.log('   → 发起请求: GET /api/notifications/unread-count');

    const unreadResult = await NotificationService.getUnreadCount(TEST_USER_ID);

    if (unreadResult.success) {
      const data = unreadResult.data;
      console.log('\n  📊 未读统计');
      console.log(`  ├─ 总未读: ${data.total_unread}`);
      console.log(`  ├─ 🔒 安全: ${data.security_unread}`);
      console.log(`  ├─ 🎉 活动: ${data.activity_unread}`);
      console.log(`  ├─ 👥 社交: ${data.social_unread}`);
      console.log(`  ├─ 🎁 奖励: ${data.reward_unread}`);
      console.log(`  └─ 📢 系统: ${data.system_unread}`);
    }

    // ====== 流程2: 获取通知列表 ======
    printSeparator('流程2: 获取通知列表');
    console.log('\n📱 [前端] 用户打开通知中心');
    console.log('   → 发起请求: GET /api/notifications');

    const notifResult = await NotificationService.getNotifications(TEST_USER_ID);

    if (notifResult.success && notifResult.data.length > 0) {
      console.log(`\n  📋 通知列表 (共${notifResult.data.length}条，未读${notifResult.unread_count}条)`);
      notifResult.data.slice(0, 4).forEach((n, i) => printNotification(n, i + 1));
      if (notifResult.data.length > 4) {
        console.log(`\n  ... 还有 ${notifResult.data.length - 4} 条`);
      }
    }

    // ====== 流程3: 标记单条已读 ======
    printSeparator('流程3: 标记单条通知已读');
    console.log('\n📱 [前端] 用户点击某条通知查看详情');

    const unreadNotif = notifResult.data?.find(n => !n.is_read);
    if (unreadNotif) {
      console.log(`   → 标记通知: "${unreadNotif.title}"`);
      console.log('   → 发起请求: PUT /api/notifications/:id/read');

      const markResult = await NotificationService.markRead(unreadNotif.id, TEST_USER_ID);
      console.log(`   → ${markResult.success ? '✅ 已标记为已读' : '❌ 标记失败'}`);
    }

    // ====== 流程4: 发送邮箱验证码 ======
    printSeparator('流程4: 发送邮箱验证码');
    console.log('\n📱 [前端] 用户请求登录验证码');
    console.log(`   → 邮箱: ${TEST_EMAIL}`);
    console.log('   → 发起请求: POST /api/email/send-code');

    const sendCodeResult = await NotificationService.sendEmailCode(TEST_EMAIL, 'login');

    if (sendCodeResult.success) {
      console.log('\n   ✅ 验证码已发送');
      console.log(`   → 有效期: ${sendCodeResult.expires_in}秒 (15分钟)`);
      console.log(`   → 📧 演示验证码: ${sendCodeResult._demo_code}`);

      // ====== 流程5: 验证邮箱验证码 ======
      printSeparator('流程5: 验证邮箱验证码');
      console.log('\n📱 [前端] 用户输入收到的验证码');
      console.log(`   → 验证码: ${sendCodeResult._demo_code}`);
      console.log('   → 发起请求: POST /api/email/verify-code');

      const verifyResult = await NotificationService.verifyEmailCode(TEST_EMAIL, sendCodeResult._demo_code, 'login');
      console.log(`   → ${verifyResult.success ? '✅ 验证成功' : `❌ ${verifyResult.message}`}`);
    } else {
      console.log(`\n   ⚠️ ${sendCodeResult.message}`);
    }

    // ====== 流程6: 测试发送频率限制 ======
    printSeparator('流程6: 测试发送频率限制（1分钟内）');
    console.log('\n📱 [前端] 用户立即再次请求验证码');
    console.log('   → 发起请求: POST /api/email/send-code');

    const sendCodeResult2 = await NotificationService.sendEmailCode(TEST_EMAIL, 'login');
    console.log(`   → ${sendCodeResult2.success ? '✅ 发送成功' : `⚠️ ${sendCodeResult2.message}`}`);
    console.log('   → 说明: 同一邮箱1分钟内只能发送1次');

    // ====== 流程7: 创建安全事件（新设备登录） ======
    printSeparator('流程7: 安全事件 - 新设备登录提醒（双通道）');
    console.log('\n📱 [系统] 检测到用户在新设备登录');
    console.log('   → 发起请求: POST /api/security/event');
    console.log('   → 事件类型: new_device_login');
    console.log('   → 设备: iPhone 15 Pro, iOS 17.0');
    console.log('   → 位置: 上海市');

    const securityResult = await NotificationService.createSecurityEvent(
      TEST_USER_ID,
      'new_device_login',
      '上海市',
      { device_name: 'iPhone 15 Pro', os: 'iOS 17.0', app_version: '1.0.0' }
    );

    if (securityResult.success) {
      console.log('\n   ✅ 安全事件已创建');
      console.log(`   → 事件ID: ${securityResult.event_id}`);
      console.log(`   → 通知渠道: ${securityResult.channels.join(' + ')}`);
      console.log('   → 📱 APP内通知: 已推送');
      console.log('   → 📧 邮件通知: 已发送');
    }

    // ====== 流程8: 获取安全事件历史 ======
    printSeparator('流程8: 获取安全事件历史');
    console.log('\n📱 [前端] 用户查看账号安全记录');
    console.log('   → 发起请求: GET /api/security/events');

    const eventsResult = await NotificationService.getSecurityEvents(TEST_USER_ID);

    if (eventsResult.success && eventsResult.data.length > 0) {
      console.log(`\n  🔒 安全事件记录 (共${eventsResult.data.length}条)`);
      eventsResult.data.forEach((e, i) => {
        const riskColors = { 'low': '🟢', 'medium': '🟡', 'high': '🟠', 'critical': '🔴' };
        console.log(`\n  ${i + 1}. ${e.event_type} ${riskColors[e.risk_level] || '⚪'}`);
        console.log(`     位置: ${e.location || '未知'} | IP: ${e.ip_address || '未知'}`);
        console.log(`     时间: ${e.created_at?.substring(0, 16) || ''}`);
      });
    }

    // ====== 流程9: 获取/更新通知设置 ======
    printSeparator('流程9: 通知设置管理');
    console.log('\n📱 [前端] 用户进入通知设置页面');

    const settingsResult = await NotificationService.getSettings(TEST_USER_ID);

    if (settingsResult.success) {
      const s = settingsResult.data;
      console.log('\n  ⚙️ 当前通知设置');
      console.log(`  ├─ 推送通知: ${s.push_enabled ? '✅开启' : '❌关闭'}`);
      console.log(`  │  ├─ 安全通知: ${s.push_security ? '✅' : '❌'}`);
      console.log(`  │  ├─ 活动通知: ${s.push_activity ? '✅' : '❌'}`);
      console.log(`  │  └─ 社交通知: ${s.push_social ? '✅' : '❌'}`);
      console.log(`  └─ 邮件通知: ${s.email_enabled ? '✅开启' : '❌关闭'}`);
      console.log(`     ├─ 安全邮件: ${s.email_security ? '✅' : '❌'}`);
      console.log(`     └─ 活动邮件: ${s.email_activity ? '✅' : '❌'}`);
    }

    // 更新设置
    console.log('\n📱 [前端] 用户关闭活动通知');
    const updateResult = await NotificationService.updateSettings(TEST_USER_ID, {
      push_activity: false,
      email_activity: false
    });
    console.log(`   → ${updateResult.success ? '✅ 设置已更新' : '❌ 更新失败'}`);

    // ====== 流程10: 标记全部已读 ======
    printSeparator('流程10: 标记全部通知已读');
    console.log('\n📱 [前端] 用户点击"全部已读"');
    console.log('   → 发起请求: PUT /api/notifications/read-all');

    const markAllResult = await NotificationService.markAllRead(TEST_USER_ID);
    console.log(`   → ✅ 已标记 ${markAllResult.marked_count} 条通知为已读`);

    // ====== 演示完成 ======
    printSeparator('演示完成');
    console.log('\n✅ 通知服务演示完成！');
    console.log('\n📝 功能总结:');
    console.log('   📋 通知管理: 列表、已读、未读统计');
    console.log('   📧 邮箱验证码: 发送、验证、频率限制');
    console.log('   🔒 安全提醒: 新设备登录、异地登录');
    console.log('   📡 双通道通知: APP推送 + 邮件通知');
    console.log('   ⚙️  通知设置: 个性化开关控制');
    console.log('\n🗄️ 数据库表:');
    console.log('   - notifications: 通知消息');
    console.log('   - email_verification_codes: 邮箱验证码');
    console.log('   - email_send_logs: 邮件发送日志');
    console.log('   - security_events: 安全事件');
    console.log('   - user_notification_settings: 通知设置');
    console.log('\n📬 通知渠道策略:');
    console.log('   - 验证码: 仅邮箱');
    console.log('   - 安全提醒: 双通道(APP+邮箱)');
    console.log('   - 活动/社交: 优先APP推送');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ 演示出错:', error.message);
    console.log('\n请确保 notification-server.js 正在运行 (端口 3005)');
  }
}

runDemo();
