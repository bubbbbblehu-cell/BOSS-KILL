-- BOSS KILL 小游戏数据库初始化脚本 - 用户认证服务
-- 创建用户认证相关的表结构及API调用逻辑的存储过程

-- =========================================================
-- 1. 表结构定义 (Table Definitions)
-- =========================================================

-- 用户基础信息表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE, -- 匿名用户email可为空
  password_hash VARCHAR(255), -- 匿名用户密码可为空
  user_type VARCHAR(20) DEFAULT 'email', -- email, anonymous
  
  -- 状态信息
  status VARCHAR(20) DEFAULT 'active', -- active, banned, suspended
  is_verified BOOLEAN DEFAULT false, -- 邮箱是否验证
  
  -- 基础元数据
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(45),
  
  INDEX idx_email (email),
  INDEX idx_status (status)
);

-- 用户登录日志表
CREATE TABLE IF NOT EXISTS user_login_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  
  -- 登录时间与网络信息
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  login_ip VARCHAR(45),
  location_info JSON, -- 登录地理位置 {country, city, coordinates}
  
  -- 设备与环境信息
  device_model VARCHAR(100), -- 设备型号
  os_version VARCHAR(50), -- 操作系统版本
  app_version VARCHAR(50), -- App版本
  channel VARCHAR(50), -- 登录渠道: iOS, Android, Web
  
  -- 登录状态与安全信息
  login_method VARCHAR(20), -- email, anonymous
  status VARCHAR(20), -- success, failed, suspicious
  risk_level VARCHAR(20) DEFAULT 'normal', -- normal, low, medium, high
  failure_reason VARCHAR(255), -- 如果失败，记录原因
  
  -- 附加安全标记
  is_first_login BOOLEAN DEFAULT false,
  mfa_verified BOOLEAN DEFAULT false,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_login_at (login_at),
  INDEX idx_device (device_model)
);

-- 匿名用户映射表 (用于匿名转正式用户)
CREATE TABLE IF NOT EXISTS anonymous_user_mapping (
  anonymous_id VARCHAR(36) PRIMARY KEY,
  linked_user_id VARCHAR(36), -- 关联后的正式账号ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  converted_at TIMESTAMP,
  
  FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_linked_user (linked_user_id)
);

-- 密码重置记录表
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_expires (user_id, expires_at)
);


-- =========================================================
-- 2. API逻辑的存储过程 (Stored Procedures for API Logic)
-- =========================================================

DELIMITER //

-- API: /auth/register
-- 功能: 用户注册 (signUpWithEmailPassword)
-- 步骤: 
-- 1. 检查邮箱是否已存在
-- 2. 如果不存在，插入新用户数据
-- 3. 返回新用户ID
CREATE PROCEDURE IF NOT EXISTS api_auth_register(
  IN p_email VARCHAR(255),
  IN p_password_hash VARCHAR(255),
  OUT p_user_id VARCHAR(36),
  OUT p_error_message VARCHAR(255)
)
BEGIN
  DECLARE email_count INT;
  
  -- 1. 检查邮箱唯一性
  SELECT COUNT(*) INTO email_count FROM users WHERE email = p_email;
  
  IF email_count > 0 THEN
    SET p_error_message = 'Email already exists';
    SET p_user_id = NULL;
  ELSE
    -- 2. 生成UUID并插入新用户
    SET p_user_id = UUID();
    INSERT INTO users (id, email, password_hash, user_type, status, is_verified)
    VALUES (p_user_id, p_email, p_password_hash, 'email', 'active', FALSE);
    
    SET p_error_message = NULL;
  END IF;
END //


-- API: /auth/login (Part 1: 验证)
-- 功能: 用户登录验证 (signInWithEmailPassword)
-- 步骤:
-- 1. 根据邮箱查找用户
-- 2. 返回用户ID、密码哈希、状态等信息供后端代码校验
-- 注意: 密码校验通常在应用层(Node.js)进行bcrypt比较，数据库只返回hash
CREATE PROCEDURE IF NOT EXISTS api_auth_get_user_by_email(
  IN p_email VARCHAR(255)
)
BEGIN
  SELECT id, password_hash, status, user_type 
  FROM users 
  WHERE email = p_email;
END //


-- API: /auth/login (Part 2: 记录日志)
-- 功能: 记录登录结果 (用于 _recordLoginLog)
-- 步骤:
-- 1. 如果登录成功，更新users表的last_login信息
-- 2. 插入user_login_logs详细日志
CREATE PROCEDURE IF NOT EXISTS api_auth_record_login(
  IN p_user_id VARCHAR(36),
  IN p_ip VARCHAR(45),
  IN p_device_info JSON,
  IN p_login_status VARCHAR(20), -- success, failed
  IN p_login_method VARCHAR(20), -- email, anonymous
  IN p_risk_level VARCHAR(20),
  IN p_failure_reason VARCHAR(255)
)
BEGIN
  -- 1. 更新用户最后登录时间 (仅成功时)
  IF p_login_status = 'success' THEN
    UPDATE users 
    SET last_login_at = CURRENT_TIMESTAMP,
        last_login_ip = p_ip
    WHERE id = p_user_id;
  END IF;

  -- 2. 插入详细日志
  INSERT INTO user_login_logs (
    id, user_id, login_ip, 
    device_model, os_version, app_version, channel,
    status, login_method, risk_level, failure_reason,
    location_info
  )
  VALUES (
    UUID(), p_user_id, p_ip,
    JSON_UNQUOTE(JSON_EXTRACT(p_device_info, '$.model')),
    JSON_UNQUOTE(JSON_EXTRACT(p_device_info, '$.os_version')),
    JSON_UNQUOTE(JSON_EXTRACT(p_device_info, '$.app_version')),
    JSON_UNQUOTE(JSON_EXTRACT(p_device_info, '$.channel')),
    p_login_status, p_login_method, p_risk_level, p_failure_reason,
    JSON_EXTRACT(p_device_info, '$.location')
  );
END //


-- API: /auth/anonymous
-- 功能: 匿名登录 (signInAnonymously)
-- 步骤:
-- 1. 创建匿名用户记录
-- 2. 记录匿名映射关系
-- 3. 返回新用户ID
CREATE PROCEDURE IF NOT EXISTS api_auth_anonymous_login(
  IN p_ip VARCHAR(45),
  OUT p_user_id VARCHAR(36)
)
BEGIN
  SET p_user_id = UUID();
  
  -- 1. 插入匿名用户 (email/password为空)
  INSERT INTO users (id, user_type, status, last_login_ip, last_login_at)
  VALUES (p_user_id, 'anonymous', 'active', p_ip, CURRENT_TIMESTAMP);
  
  -- 2. 记录到匿名映射表
  INSERT INTO anonymous_user_mapping (anonymous_id)
  VALUES (p_user_id);
END //


-- API: /auth/reset-password (Part 1: 请求重置)
-- 功能: 创建密码重置令牌 (resetPassword)
-- 步骤:
-- 1. 验证邮箱是否存在
-- 2. 如果存在，生成token并存入password_reset_tokens
CREATE PROCEDURE IF NOT EXISTS api_auth_create_reset_token(
  IN p_email VARCHAR(255),
  IN p_token VARCHAR(255),
  IN p_expires_at TIMESTAMP,
  OUT p_user_id VARCHAR(36)
)
BEGIN
  -- 1. 查找用户ID
  SELECT id INTO p_user_id FROM users WHERE email = p_email AND user_type = 'email';
  
  IF p_user_id IS NOT NULL THEN
    -- 2. 使旧的未使用的token失效(可选逻辑，这里简单插入新的)
    -- 3. 插入新Token
    INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
    VALUES (UUID(), p_user_id, p_token, p_expires_at);
  END IF;
END //

DELIMITER ;

-- =========================================================
-- 3. 索引优化 (Index Optimization)
-- =========================================================

-- 优化最近登录查询 (用于活跃度分析)
CREATE INDEX IF NOT EXISTS idx_users_last_login 
ON users (last_login_at DESC);

-- 优化风控查询：查找特定IP的失败登录 (用于防止暴力破解)
CREATE INDEX IF NOT EXISTS idx_login_risk_analysis 
ON user_login_logs (login_ip, status, login_at DESC);

