-- BOSS KILL 小游戏数据库初始化脚本 - 通知服务
-- 创建通知消息、邮箱验证码、安全提醒等相关的表结构及API逻辑

-- =========================================================
-- 1. 表结构定义 (Table Definitions)
-- =========================================================

-- ----------------------------------------
-- 通知消息模块
-- ----------------------------------------

-- APP系统通知表 (notifications)
-- 存储所有APP内通知消息
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  
  -- 通知内容
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSON,                          -- 附加数据（如跳转链接、关联ID等）
  
  -- 通知类型
  notification_type VARCHAR(50) NOT NULL,  -- security, activity, system, social, reward
  priority VARCHAR(20) DEFAULT 'normal',   -- low, normal, high, urgent
  
  -- 状态
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false,
  
  -- 时间
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,               -- 过期时间（可选）
  
  INDEX idx_user_id (user_id),
  INDEX idx_type (notification_type),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at DESC)
);

-- 通知模板表 (notification_templates)
-- 存储可复用的通知模板
CREATE TABLE IF NOT EXISTS notification_templates (
  id VARCHAR(36) PRIMARY KEY,
  template_code VARCHAR(50) UNIQUE NOT NULL,  -- 模板代码
  title_template VARCHAR(255) NOT NULL,        -- 标题模板
  body_template TEXT NOT NULL,                 -- 内容模板
  notification_type VARCHAR(50) NOT NULL,
  variables JSON,                              -- 可替换变量列表
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_template_code (template_code),
  INDEX idx_type (notification_type)
);

-- ----------------------------------------
-- 邮箱验证码模块
-- ----------------------------------------

-- 邮箱验证码表 (email_verification_codes)
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  code_type VARCHAR(50) NOT NULL,     -- login, register, reset_password, verify_email
  
  -- 状态
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  
  -- 时间限制
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  
  -- 安全信息
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  INDEX idx_email (email),
  INDEX idx_code (code),
  INDEX idx_type (code_type),
  INDEX idx_expires (expires_at)
);

-- 邮件发送记录表 (email_send_logs)
CREATE TABLE IF NOT EXISTS email_send_logs (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  email_type VARCHAR(50) NOT NULL,    -- verification_code, security_alert, activity, newsletter
  subject VARCHAR(255),
  
  -- 发送状态
  status VARCHAR(20) DEFAULT 'pending',  -- pending, sent, failed, bounced
  error_message TEXT,
  
  -- 时间
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  
  -- 关联
  reference_id VARCHAR(36),           -- 关联的验证码ID或通知ID
  
  INDEX idx_email (email),
  INDEX idx_type (email_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at DESC)
);

-- ----------------------------------------
-- 安全提醒模块
-- ----------------------------------------

-- 安全事件表 (security_events)
CREATE TABLE IF NOT EXISTS security_events (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  
  -- 事件信息
  event_type VARCHAR(50) NOT NULL,    -- new_device_login, abnormal_location, password_change, suspicious_activity
  event_description TEXT,
  
  -- 设备/环境信息
  device_info JSON,                   -- 设备型号、OS版本等
  ip_address VARCHAR(45),
  location VARCHAR(255),              -- 地理位置
  
  -- 风险评估
  risk_level VARCHAR(20) DEFAULT 'low',  -- low, medium, high, critical
  
  -- 通知状态
  email_notified BOOLEAN DEFAULT false,
  app_notified BOOLEAN DEFAULT false,
  
  -- 时间
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_event_type (event_type),
  INDEX idx_risk_level (risk_level),
  INDEX idx_created_at (created_at DESC)
);

-- ----------------------------------------
-- 用户通知设置模块
-- ----------------------------------------

-- 用户通知偏好设置表 (user_notification_settings)
CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id VARCHAR(36) PRIMARY KEY,
  
  -- 推送通知开关
  push_enabled BOOLEAN DEFAULT true,
  push_security BOOLEAN DEFAULT true,     -- 安全通知
  push_activity BOOLEAN DEFAULT true,     -- 活动通知
  push_social BOOLEAN DEFAULT true,       -- 社交通知
  push_reward BOOLEAN DEFAULT true,       -- 奖励通知
  
  -- 邮箱通知开关
  email_enabled BOOLEAN DEFAULT true,
  email_security BOOLEAN DEFAULT true,    -- 安全邮件
  email_activity BOOLEAN DEFAULT false,   -- 活动邮件
  email_newsletter BOOLEAN DEFAULT false, -- 订阅邮件
  
  -- 勿扰时段
  dnd_enabled BOOLEAN DEFAULT false,
  dnd_start_time TIME,
  dnd_end_time TIME,
  
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- =========================================================
-- 2. API逻辑的存储过程 (Stored Procedures for API Logic)
-- =========================================================

DELIMITER //

-- ----------------------------------------
-- 通知消息API
-- ----------------------------------------

-- API: POST /api/notifications
-- 功能: 创建新通知
CREATE PROCEDURE IF NOT EXISTS api_notification_create(
  IN p_user_id VARCHAR(36),
  IN p_title VARCHAR(255),
  IN p_body TEXT,
  IN p_type VARCHAR(50),
  IN p_priority VARCHAR(20),
  IN p_data JSON,
  OUT p_notification_id VARCHAR(36)
)
BEGIN
  SET p_notification_id = UUID();
  
  INSERT INTO notifications (id, user_id, title, body, notification_type, priority, data)
  VALUES (p_notification_id, p_user_id, p_title, p_body, p_type, IFNULL(p_priority, 'normal'), p_data);
END //


-- API: GET /api/notifications
-- 功能: 获取用户通知列表
CREATE PROCEDURE IF NOT EXISTS api_notification_list(
  IN p_user_id VARCHAR(36),
  IN p_type VARCHAR(50),
  IN p_unread_only BOOLEAN,
  IN p_page INT,
  IN p_page_size INT
)
BEGIN
  DECLARE v_offset INT;
  SET v_offset = (p_page - 1) * p_page_size;
  
  SELECT 
    id, title, body, notification_type, priority,
    data, is_read, read_at, created_at
  FROM notifications
  WHERE user_id = p_user_id
    AND is_deleted = false
    AND (p_type IS NULL OR notification_type = p_type)
    AND (p_unread_only = false OR is_read = false)
  ORDER BY created_at DESC
  LIMIT p_page_size OFFSET v_offset;
END //


-- API: PUT /api/notifications/:id/read
-- 功能: 标记通知为已读
CREATE PROCEDURE IF NOT EXISTS api_notification_mark_read(
  IN p_user_id VARCHAR(36),
  IN p_notification_id VARCHAR(36),
  OUT p_success BOOLEAN
)
BEGIN
  UPDATE notifications 
  SET is_read = true, read_at = CURRENT_TIMESTAMP
  WHERE id = p_notification_id AND user_id = p_user_id;
  
  SET p_success = ROW_COUNT() > 0;
END //


-- API: PUT /api/notifications/read-all
-- 功能: 标记所有通知为已读
CREATE PROCEDURE IF NOT EXISTS api_notification_mark_all_read(
  IN p_user_id VARCHAR(36),
  IN p_type VARCHAR(50)
)
BEGIN
  UPDATE notifications 
  SET is_read = true, read_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id 
    AND is_read = false
    AND (p_type IS NULL OR notification_type = p_type);
END //


-- API: GET /api/notifications/unread-count
-- 功能: 获取未读通知数量
CREATE PROCEDURE IF NOT EXISTS api_notification_unread_count(
  IN p_user_id VARCHAR(36)
)
BEGIN
  SELECT 
    COUNT(*) as total_unread,
    COUNT(CASE WHEN notification_type = 'security' THEN 1 END) as security_unread,
    COUNT(CASE WHEN notification_type = 'activity' THEN 1 END) as activity_unread,
    COUNT(CASE WHEN notification_type = 'social' THEN 1 END) as social_unread,
    COUNT(CASE WHEN notification_type = 'reward' THEN 1 END) as reward_unread
  FROM notifications
  WHERE user_id = p_user_id AND is_read = false AND is_deleted = false;
END //


-- ----------------------------------------
-- 邮箱验证码API
-- ----------------------------------------

-- API: POST /api/email/send-code
-- 功能: 发送邮箱验证码
CREATE PROCEDURE IF NOT EXISTS api_email_send_code(
  IN p_email VARCHAR(255),
  IN p_code_type VARCHAR(50),
  IN p_ip_address VARCHAR(45),
  IN p_user_agent TEXT,
  OUT p_code VARCHAR(10),
  OUT p_success BOOLEAN,
  OUT p_message VARCHAR(100)
)
BEGIN
  DECLARE v_recent_count INT;
  DECLARE v_code_id VARCHAR(36);
  
  -- 检查发送频率（同一邮箱1分钟内只能发送1次）
  SELECT COUNT(*) INTO v_recent_count FROM email_verification_codes
  WHERE email = p_email AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE);
  
  IF v_recent_count > 0 THEN
    SET p_success = false;
    SET p_message = '发送太频繁，请稍后再试';
    SET p_code = NULL;
  ELSE
    -- 生成6位验证码
    SET p_code = LPAD(FLOOR(RAND() * 1000000), 6, '0');
    SET v_code_id = UUID();
    
    -- 作废之前的验证码
    UPDATE email_verification_codes 
    SET is_used = true 
    WHERE email = p_email AND code_type = p_code_type AND is_used = false;
    
    -- 插入新验证码（有效期15分钟）
    INSERT INTO email_verification_codes (id, email, code, code_type, expires_at, ip_address, user_agent)
    VALUES (v_code_id, p_email, p_code, p_code_type, DATE_ADD(NOW(), INTERVAL 15 MINUTE), p_ip_address, p_user_agent);
    
    -- 记录发送日志
    INSERT INTO email_send_logs (id, email, email_type, subject, status, reference_id)
    VALUES (UUID(), p_email, 'verification_code', CONCAT(p_code_type, ' 验证码'), 'pending', v_code_id);
    
    SET p_success = true;
    SET p_message = '验证码已发送';
  END IF;
END //


-- API: POST /api/email/verify-code
-- 功能: 验证邮箱验证码
CREATE PROCEDURE IF NOT EXISTS api_email_verify_code(
  IN p_email VARCHAR(255),
  IN p_code VARCHAR(10),
  IN p_code_type VARCHAR(50),
  OUT p_success BOOLEAN,
  OUT p_message VARCHAR(100)
)
BEGIN
  DECLARE v_code_id VARCHAR(36);
  DECLARE v_expires_at TIMESTAMP;
  DECLARE v_is_used BOOLEAN;
  
  -- 查找验证码
  SELECT id, expires_at, is_used INTO v_code_id, v_expires_at, v_is_used
  FROM email_verification_codes
  WHERE email = p_email AND code = p_code AND code_type = p_code_type
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_code_id IS NULL THEN
    SET p_success = false;
    SET p_message = '验证码错误';
  ELSEIF v_is_used THEN
    SET p_success = false;
    SET p_message = '验证码已使用';
  ELSEIF v_expires_at < NOW() THEN
    SET p_success = false;
    SET p_message = '验证码已过期';
  ELSE
    -- 标记为已使用
    UPDATE email_verification_codes 
    SET is_used = true, used_at = NOW() 
    WHERE id = v_code_id;
    
    SET p_success = true;
    SET p_message = '验证成功';
  END IF;
END //


-- ----------------------------------------
-- 安全提醒API
-- ----------------------------------------

-- API: POST /api/security/event
-- 功能: 记录安全事件并发送通知
CREATE PROCEDURE IF NOT EXISTS api_security_create_event(
  IN p_user_id VARCHAR(36),
  IN p_event_type VARCHAR(50),
  IN p_description TEXT,
  IN p_device_info JSON,
  IN p_ip_address VARCHAR(45),
  IN p_location VARCHAR(255),
  IN p_risk_level VARCHAR(20),
  OUT p_event_id VARCHAR(36)
)
BEGIN
  DECLARE v_notification_id VARCHAR(36);
  DECLARE v_title VARCHAR(255);
  DECLARE v_body TEXT;
  
  SET p_event_id = UUID();
  
  -- 插入安全事件
  INSERT INTO security_events (id, user_id, event_type, event_description, device_info, ip_address, location, risk_level)
  VALUES (p_event_id, p_user_id, p_event_type, p_description, p_device_info, p_ip_address, p_location, IFNULL(p_risk_level, 'low'));
  
  -- 生成通知标题和内容
  CASE p_event_type
    WHEN 'new_device_login' THEN
      SET v_title = '新设备登录提醒';
      SET v_body = CONCAT('您的账号在新设备上登录，位置：', IFNULL(p_location, '未知'), '。如非本人操作，请立即修改密码。');
    WHEN 'abnormal_location' THEN
      SET v_title = '异地登录提醒';
      SET v_body = CONCAT('检测到您的账号在异常位置登录：', IFNULL(p_location, '未知'), '。如非本人操作，请立即处理。');
    WHEN 'password_change' THEN
      SET v_title = '密码修改通知';
      SET v_body = '您的账号密码已修改。如非本人操作，请立即联系客服。';
    ELSE
      SET v_title = '安全提醒';
      SET v_body = IFNULL(p_description, '检测到账号安全事件，请及时查看。');
  END CASE;
  
  -- 创建APP内通知
  SET v_notification_id = UUID();
  INSERT INTO notifications (id, user_id, title, body, notification_type, priority, data)
  VALUES (v_notification_id, p_user_id, v_title, v_body, 'security', 
          CASE WHEN p_risk_level IN ('high', 'critical') THEN 'urgent' ELSE 'high' END,
          JSON_OBJECT('event_id', p_event_id, 'event_type', p_event_type));
  
  -- 标记APP通知已发送
  UPDATE security_events SET app_notified = true WHERE id = p_event_id;
END //


-- API: GET /api/security/events
-- 功能: 获取用户安全事件历史
CREATE PROCEDURE IF NOT EXISTS api_security_get_events(
  IN p_user_id VARCHAR(36),
  IN p_page INT,
  IN p_page_size INT
)
BEGIN
  DECLARE v_offset INT;
  SET v_offset = (p_page - 1) * p_page_size;
  
  SELECT 
    id, event_type, event_description, device_info,
    ip_address, location, risk_level,
    email_notified, app_notified, created_at
  FROM security_events
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT p_page_size OFFSET v_offset;
END //


-- ----------------------------------------
-- 用户通知设置API
-- ----------------------------------------

-- API: GET /api/notifications/settings
-- 功能: 获取用户通知设置
CREATE PROCEDURE IF NOT EXISTS api_notification_get_settings(
  IN p_user_id VARCHAR(36)
)
BEGIN
  -- 如果不存在则创建默认设置
  INSERT IGNORE INTO user_notification_settings (user_id) VALUES (p_user_id);
  
  SELECT * FROM user_notification_settings WHERE user_id = p_user_id;
END //


-- API: PUT /api/notifications/settings
-- 功能: 更新用户通知设置
CREATE PROCEDURE IF NOT EXISTS api_notification_update_settings(
  IN p_user_id VARCHAR(36),
  IN p_settings JSON
)
BEGIN
  INSERT INTO user_notification_settings (user_id) VALUES (p_user_id)
  ON DUPLICATE KEY UPDATE
    push_enabled = IFNULL(JSON_EXTRACT(p_settings, '$.push_enabled'), push_enabled),
    push_security = IFNULL(JSON_EXTRACT(p_settings, '$.push_security'), push_security),
    push_activity = IFNULL(JSON_EXTRACT(p_settings, '$.push_activity'), push_activity),
    push_social = IFNULL(JSON_EXTRACT(p_settings, '$.push_social'), push_social),
    push_reward = IFNULL(JSON_EXTRACT(p_settings, '$.push_reward'), push_reward),
    email_enabled = IFNULL(JSON_EXTRACT(p_settings, '$.email_enabled'), email_enabled),
    email_security = IFNULL(JSON_EXTRACT(p_settings, '$.email_security'), email_security),
    email_activity = IFNULL(JSON_EXTRACT(p_settings, '$.email_activity'), email_activity),
    email_newsletter = IFNULL(JSON_EXTRACT(p_settings, '$.email_newsletter'), email_newsletter),
    dnd_enabled = IFNULL(JSON_EXTRACT(p_settings, '$.dnd_enabled'), dnd_enabled),
    dnd_start_time = IFNULL(JSON_EXTRACT(p_settings, '$.dnd_start_time'), dnd_start_time),
    dnd_end_time = IFNULL(JSON_EXTRACT(p_settings, '$.dnd_end_time'), dnd_end_time);
END //

DELIMITER ;


-- =========================================================
-- 3. 索引优化 (Index Optimization)
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_time 
ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_codes_email_type_used 
ON email_verification_codes (email, code_type, is_used, expires_at);

CREATE INDEX IF NOT EXISTS idx_security_events_user_time 
ON security_events (user_id, created_at DESC);


-- =========================================================
-- 4. 初始化通知模板
-- =========================================================

INSERT INTO notification_templates (id, template_code, title_template, body_template, notification_type, variables) VALUES
-- 安全类模板
('tpl_001', 'security_new_device', '新设备登录提醒', '您的账号在新设备（{device_name}）上登录，位置：{location}。如非本人操作，请立即修改密码。', 'security', '["device_name", "location"]'),
('tpl_002', 'security_abnormal_login', '异地登录提醒', '检测到您的账号在异常位置（{location}）登录，IP：{ip_address}。如非本人操作，请立即处理。', 'security', '["location", "ip_address"]'),
('tpl_003', 'security_password_changed', '密码修改通知', '您的账号密码已于{time}修改成功。如非本人操作，请立即联系客服。', 'security', '["time"]'),

-- 活动类模板
('tpl_101', 'activity_new_event', '新活动上线', '{event_name}活动已上线！参与即可获得{reward}，快来参加吧！', 'activity', '["event_name", "reward"]'),
('tpl_102', 'activity_reward_expire', '奖励即将过期', '您有{count}个奖励即将在{expire_time}过期，请及时领取！', 'activity', '["count", "expire_time"]'),

-- 社交类模板
('tpl_201', 'social_new_follower', '新粉丝提醒', '{user_name}关注了你，快去看看ta的主页吧！', 'social', '["user_name"]'),
('tpl_202', 'social_friend_request', '好友申请', '{user_name}请求添加您为好友。', 'social', '["user_name"]'),
('tpl_203', 'social_gift_received', '收到礼物', '{user_name}送给您一个{gift_name}！', 'social', '["user_name", "gift_name"]'),

-- 奖励类模板
('tpl_301', 'reward_points_earned', '积分到账', '恭喜获得{points}积分！{reason}', 'reward', '["points", "reason"]'),
('tpl_302', 'reward_achievement_unlocked', '成就解锁', '恭喜解锁成就【{achievement_name}】！', 'reward', '["achievement_name"]'),
('tpl_303', 'reward_level_up', '等级提升', '恭喜升级到Lv.{level}！新等级解锁了更多特权。', 'reward', '["level"]')
ON DUPLICATE KEY UPDATE title_template = VALUES(title_template);


-- =========================================================
-- 5. 示例测试数据
-- =========================================================

-- 测试通知
INSERT INTO notifications (id, user_id, title, body, notification_type, priority, is_read) VALUES
('notif_001', 'demo_user_001', '欢迎来到BOSS KILL', '开始你的扔便便之旅吧！每日打卡可获得额外积分哦~', 'system', 'normal', false),
('notif_002', 'demo_user_001', '新设备登录提醒', '您的账号在iPhone 15上登录，位置：杭州。如非本人操作，请立即修改密码。', 'security', 'high', false),
('notif_003', 'demo_user_001', 'user_002关注了你', '快去看看ta的主页吧！', 'social', 'normal', true),
('notif_004', 'demo_user_001', '恭喜获得100积分', '连续打卡7天奖励', 'reward', 'normal', true)
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 测试用户通知设置
INSERT INTO user_notification_settings (user_id, push_enabled, email_enabled, email_security, email_activity) VALUES
('demo_user_001', true, true, true, false)
ON DUPLICATE KEY UPDATE push_enabled = VALUES(push_enabled);
