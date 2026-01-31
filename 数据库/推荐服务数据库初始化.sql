-- BOSS KILL 小游戏数据库初始化脚本 - 推荐服务
-- 创建社交关系、礼物系统、积分打卡、奖励解锁相关的表结构及API逻辑

-- =========================================================
-- 1. 表结构定义 (Table Definitions)
-- =========================================================

-- ----------------------------------------
-- 社交关系模块
-- ----------------------------------------

-- 用户关注表 (user_follows)
CREATE TABLE IF NOT EXISTS user_follows (
  id VARCHAR(36) PRIMARY KEY,
  follower_id VARCHAR(36) NOT NULL,  -- 关注者（谁关注了别人）
  following_id VARCHAR(36) NOT NULL, -- 被关注者（被谁关注）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_follow (follower_id, following_id),
  INDEX idx_follower (follower_id),
  INDEX idx_following (following_id)
);

-- 用户好友表 (user_friends)
-- 好友是双向关系，需要双方确认
CREATE TABLE IF NOT EXISTS user_friends (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  friend_id VARCHAR(36) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, blocked
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  
  UNIQUE KEY uk_friendship (user_id, friend_id),
  INDEX idx_user_id (user_id),
  INDEX idx_friend_id (friend_id),
  INDEX idx_status (status)
);

-- ----------------------------------------
-- 礼物系统模块
-- ----------------------------------------

-- 积分打卡互动系统表结构

-- 用户积分主表：存储每个用户的总积分等
CREATE TABLE IF NOT EXISTS user_points (
  user_id VARCHAR(36) PRIMARY KEY,            -- 用户唯一ID
  total_points INT DEFAULT 0,                 -- 总积分
  available_points INT DEFAULT 0,             -- 当前可用积分
  level INT DEFAULT 1,                        -- 等级（如有分级体系）
  exp INT DEFAULT 0,                          -- 经验值（用于升级等扩展）
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 积分变动记录表：详细追踪所有积分来源和消耗
CREATE TABLE IF NOT EXISTS point_transactions (
  id VARCHAR(36) PRIMARY KEY,                 -- 记录唯一ID
  user_id VARCHAR(36) NOT NULL,               -- 关联用户
  points INT NOT NULL,                        -- 变动积分（正+增，负-扣）
  transaction_type VARCHAR(50) NOT NULL,      -- earn_action, earn_checkin, spend_reward等
  reference_id VARCHAR(36),                   -- 关联内容、奖励、打卡等ID
  description TEXT,                           -- 变动说明
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (transaction_type),
  INDEX idx_created_at (created_at DESC)
);

-- 打卡记录表：每天一次，辅助积分系统
CREATE TABLE IF NOT EXISTS check_in_records (
  id VARCHAR(36) PRIMARY KEY,                 -- 记录ID
  user_id VARCHAR(36) NOT NULL,               -- 用户ID
  check_in_date DATE NOT NULL,                -- 打卡日期
  streak INT DEFAULT 1,                       -- 累计连续打卡天数
  points_earned INT DEFAULT 0,                -- 本次获得积分
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_date (user_id, check_in_date),
  INDEX idx_user_id (user_id),
  INDEX idx_date (check_in_date)
);

-- 打卡统计表：用户累计、当前连击等
CREATE TABLE IF NOT EXISTS check_in_stats (
  user_id VARCHAR(36) PRIMARY KEY,
  total_check_ins INT DEFAULT 0,              -- 总打卡次数
  current_streak INT DEFAULT 0,               -- 当前连续打卡天数
  max_streak INT DEFAULT 0,                   -- 历史最高连续天数
  last_check_in_date DATE,                    -- 最近打卡日期
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 用户已解锁奖励表
CREATE TABLE IF NOT EXISTS user_rewards (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  reward_id VARCHAR(36) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_reward (user_id, reward_id),
  INDEX idx_user_id (user_id)
);

-- 奖励定义表：积分兑换、打卡奖励、特殊称号等
CREATE TABLE IF NOT EXISTS rewards (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon_url VARCHAR(500),
  reward_type VARCHAR(50),         -- title, sticker, emoji, skin, avatar等
  required_points INT DEFAULT 0,   -- 解锁所需积分
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户行为表（推荐算法绑定、也用于部分积分行为记录）
-- 行为类型包括但不限于：view（浏览）、like（点赞）、comment（评论）、favorite（收藏）、share（分享）
CREATE TABLE IF NOT EXISTS user_actions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  content_id VARCHAR(36) NOT NULL,
  action_type VARCHAR(20) NOT NULL, -- 分类如下: view, like, comment, favorite, share
  action_value INT DEFAULT 1,       -- 行为值（例如浏览时长、点赞数等，默认1）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_content_id (content_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_user_action (user_id, action_type)
);

-- 用户行为分类说明及举例:
--   view      ：浏览（如浏览某内容、卡片）
--   like      ：点赞内容
--   comment   ：评论内容
--   favorite  ：收藏内容
--   share     ：分享内容到外部
-- 可根据业务拓展更多类型（如打赏、标签打分、举报等）

  check_in_date DATE NOT NULL,                -- 打卡日期
  streak INT DEFAULT 1,                       -- 连续打卡天数
  points_earned INT DEFAULT 0,                -- 本次获得积分
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_date (user_id, check_in_date),
  INDEX idx_user_id (user_id),
  INDEX idx_date (check_in_date)
);

-- 打卡统计表：累计和当前的连击状态、排名等
CREATE TABLE IF NOT EXISTS check_in_stats (
  user_id VARCHAR(36) PRIMARY KEY,
  total_check_ins INT DEFAULT 0,              -- 总打卡天数
  current_streak INT DEFAULT 0,               -- 当前连续打卡天数
  max_streak INT DEFAULT 0,                   -- 最高连续打卡天数
  last_check_in_date DATE,                    -- 最近打卡日期
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 用户奖励解锁表：关联用户与各类奖励、称号、皮肤等道具的解锁状态
CREATE TABLE IF NOT EXISTS user_rewards (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  reward_id VARCHAR(36) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_reward (user_id, reward_id),
  INDEX idx_user_id (user_id)
);

-- 奖励定义表：可以解锁的称号/皮肤等
CREATE TABLE IF NOT EXISTS rewards (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon_url VARCHAR(500),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------
-- 用户行为记录模块（用于推荐算法）
-- ----------------------------------------

-- 用户行为表 (user_actions)
CREATE TABLE IF NOT EXISTS user_actions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  content_id VARCHAR(36) NOT NULL,
  action_type VARCHAR(20) NOT NULL, -- view, like, comment, favorite, share
  action_value INT DEFAULT 1,       -- 行为值（如浏览时长秒数）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_content_id (content_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_user_action (user_id, action_type)
);

-- ----------------------------------------
-- 积分系统模块
-- ----------------------------------------

-- 用户积分表 (user_points)
CREATE TABLE IF NOT EXISTS user_points (
  user_id VARCHAR(36) PRIMARY KEY,
  total_points INT DEFAULT 0,         -- 总积分
  available_points INT DEFAULT 0,     -- 可用积分
  level INT DEFAULT 1,                -- 用户等级
  exp INT DEFAULT 0,                  -- 经验值
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 积分变动记录表 (point_transactions)
CREATE TABLE IF NOT EXISTS point_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  points INT NOT NULL,                -- 正数增加，负数减少
  transaction_type VARCHAR(50) NOT NULL, -- earn_action, earn_checkin, spend_gift, spend_reward
  reference_id VARCHAR(36),           -- 关联ID（如礼物ID、奖励ID等）
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_type (transaction_type),
  INDEX idx_created_at (created_at DESC)
);

-- 积分规则配置表 (point_rules)
CREATE TABLE IF NOT EXISTS point_rules (
  id VARCHAR(36) PRIMARY KEY,
  action_type VARCHAR(50) UNIQUE NOT NULL, -- view, like, comment, favorite, share, checkin, consecutive_checkin
  points_value INT DEFAULT 0,
  daily_limit INT DEFAULT -1,  -- 每日上限，-1表示无限制
  description TEXT,
  is_active BOOLEAN DEFAULT true
);

-- ----------------------------------------
-- 打卡系统模块
-- ----------------------------------------

-- 打卡记录表 (check_in_records)
CREATE TABLE IF NOT EXISTS check_in_records (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  check_in_date DATE NOT NULL,
  streak_count INT DEFAULT 1,         -- 连续打卡天数
  points_earned INT DEFAULT 0,        -- 本次打卡获得积分
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_user_date (user_id, check_in_date),
  INDEX idx_user_id (user_id),
  INDEX idx_date (check_in_date DESC)
);

-- 打卡统计表 (check_in_stats)
CREATE TABLE IF NOT EXISTS check_in_stats (
  user_id VARCHAR(36) PRIMARY KEY,
  current_streak INT DEFAULT 0,       -- 当前连续天数
  longest_streak INT DEFAULT 0,       -- 最长连续天数
  total_check_ins INT DEFAULT 0,      -- 总打卡次数
  last_check_in_date DATE,            -- 最后打卡日期
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ----------------------------------------
-- 奖励系统模块
-- ----------------------------------------

-- 奖励定义表 (rewards)
CREATE TABLE IF NOT EXISTS rewards (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url VARCHAR(500),
  reward_type VARCHAR(50) NOT NULL,  -- title, sticker, emoji, skin, avatar_frame
  required_points INT DEFAULT 0,      -- 所需积分
  required_streak INT DEFAULT 0,      -- 所需连续打卡天数
  required_level INT DEFAULT 0,       -- 所需等级
  unlock_condition VARCHAR(100),      -- 解锁条件描述
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户已解锁奖励表 (user_rewards)
CREATE TABLE IF NOT EXISTS user_rewards (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  reward_id VARCHAR(36) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_equipped BOOLEAN DEFAULT false,  -- 是否装备中
  
  FOREIGN KEY (reward_id) REFERENCES rewards(id),
  UNIQUE KEY uk_user_reward (user_id, reward_id),
  INDEX idx_user_id (user_id),
  INDEX idx_reward_type (reward_id)
);


-- =========================================================
-- 2. API逻辑的存储过程 (Stored Procedures for API Logic)
-- =========================================================

DELIMITER //

-- ----------------------------------------
-- 社交关系API
-- ----------------------------------------

-- API: POST /api/social/follow
-- 功能: 关注用户
CREATE PROCEDURE IF NOT EXISTS api_social_follow_user(
  IN p_follower_id VARCHAR(36),
  IN p_following_id VARCHAR(36),
  OUT p_success BOOLEAN
)
BEGIN
  DECLARE v_exists INT;
  
  -- 不能关注自己
  IF p_follower_id = p_following_id THEN
    SET p_success = false;
  ELSE
    SELECT COUNT(*) INTO v_exists FROM user_follows 
    WHERE follower_id = p_follower_id AND following_id = p_following_id;
    
    IF v_exists = 0 THEN
      INSERT INTO user_follows (id, follower_id, following_id)
      VALUES (UUID(), p_follower_id, p_following_id);
      SET p_success = true;
    ELSE
      SET p_success = false;
    END IF;
  END IF;
END //


-- API: DELETE /api/social/follow
-- 功能: 取消关注
CREATE PROCEDURE IF NOT EXISTS api_social_unfollow_user(
  IN p_follower_id VARCHAR(36),
  IN p_following_id VARCHAR(36),
  OUT p_success BOOLEAN
)
BEGIN
  DELETE FROM user_follows 
  WHERE follower_id = p_follower_id AND following_id = p_following_id;
  
  SET p_success = ROW_COUNT() > 0;
END //


-- API: POST /api/social/friend/request
-- 功能: 发送好友请求
CREATE PROCEDURE IF NOT EXISTS api_social_add_friend(
  IN p_user_id VARCHAR(36),
  IN p_friend_id VARCHAR(36),
  OUT p_success BOOLEAN,
  OUT p_message VARCHAR(100)
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_status VARCHAR(20);
  
  IF p_user_id = p_friend_id THEN
    SET p_success = false;
    SET p_message = '不能添加自己为好友';
  ELSE
    -- 检查是否已有好友关系
    SELECT status INTO v_status FROM user_friends 
    WHERE (user_id = p_user_id AND friend_id = p_friend_id)
       OR (user_id = p_friend_id AND friend_id = p_user_id)
    LIMIT 1;
    
    IF v_status = 'accepted' THEN
      SET p_success = false;
      SET p_message = '已经是好友了';
    ELSEIF v_status = 'pending' THEN
      SET p_success = false;
      SET p_message = '已发送过好友请求';
    ELSE
      INSERT INTO user_friends (id, user_id, friend_id, status)
      VALUES (UUID(), p_user_id, p_friend_id, 'pending');
      SET p_success = true;
      SET p_message = '好友请求已发送';
    END IF;
  END IF;
END //


-- API: PUT /api/social/friend/accept
-- 功能: 接受好友请求
CREATE PROCEDURE IF NOT EXISTS api_social_accept_friend(
  IN p_user_id VARCHAR(36),
  IN p_friend_id VARCHAR(36),
  OUT p_success BOOLEAN
)
BEGIN
  UPDATE user_friends 
  SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
  WHERE user_id = p_friend_id AND friend_id = p_user_id AND status = 'pending';
  
  SET p_success = ROW_COUNT() > 0;
END //


-- ----------------------------------------
-- 礼物系统API
-- ----------------------------------------

-- API: POST /api/gift/send
-- 功能: 发送礼物
CREATE PROCEDURE IF NOT EXISTS api_gift_send(
  IN p_sender_id VARCHAR(36),
  IN p_receiver_id VARCHAR(36),
  IN p_gift_id VARCHAR(36),
  IN p_content_id VARCHAR(36),
  IN p_message TEXT,
  OUT p_success BOOLEAN,
  OUT p_error_message VARCHAR(100)
)
BEGIN
  DECLARE v_gift_price INT;
  DECLARE v_user_points INT;
  
  -- 获取礼物价格
  SELECT price_points INTO v_gift_price FROM gifts WHERE id = p_gift_id AND is_active = true;
  
  IF v_gift_price IS NULL THEN
    SET p_success = false;
    SET p_error_message = '礼物不存在';
  ELSE
    -- 获取用户可用积分
    SELECT available_points INTO v_user_points FROM user_points WHERE user_id = p_sender_id;
    
    IF v_user_points IS NULL OR v_user_points < v_gift_price THEN
      SET p_success = false;
      SET p_error_message = '积分不足';
    ELSE
      -- 扣除积分
      UPDATE user_points SET available_points = available_points - v_gift_price WHERE user_id = p_sender_id;
      
      -- 记录积分变动
      INSERT INTO point_transactions (id, user_id, points, transaction_type, reference_id, description)
      VALUES (UUID(), p_sender_id, -v_gift_price, 'spend_gift', p_gift_id, '发送礼物');
      
      -- 记录礼物发送
      INSERT INTO gift_records (id, sender_id, receiver_id, gift_id, content_id, message)
      VALUES (UUID(), p_sender_id, p_receiver_id, p_gift_id, p_content_id, p_message);
      
      SET p_success = true;
      SET p_error_message = NULL;
    END IF;
  END IF;
END //


-- ----------------------------------------
-- 用户行为记录API
-- ----------------------------------------

-- API: POST /api/action/record
-- 功能: 记录用户行为并奖励积分
CREATE PROCEDURE IF NOT EXISTS api_action_record(
  IN p_user_id VARCHAR(36),
  IN p_content_id VARCHAR(36),
  IN p_action_type VARCHAR(20),
  IN p_action_value INT,
  OUT p_points_earned INT
)
BEGIN
  DECLARE v_points INT DEFAULT 0;
  DECLARE v_daily_limit INT;
  DECLARE v_today_count INT;
  
  -- 记录行为
  INSERT INTO user_actions (id, user_id, content_id, action_type, action_value)
  VALUES (UUID(), p_user_id, p_content_id, p_action_type, IFNULL(p_action_value, 1));
  
  -- 获取积分规则
  SELECT points_value, daily_limit INTO v_points, v_daily_limit 
  FROM point_rules WHERE action_type = p_action_type AND is_active = true;
  
  IF v_points > 0 THEN
    -- 检查每日上限
    IF v_daily_limit > 0 THEN
      SELECT COUNT(*) INTO v_today_count FROM user_actions 
      WHERE user_id = p_user_id AND action_type = p_action_type 
        AND DATE(created_at) = CURDATE();
      
      IF v_today_count > v_daily_limit THEN
        SET v_points = 0;
      END IF;
    END IF;
    
    -- 增加积分
    IF v_points > 0 THEN
      INSERT INTO user_points (user_id, total_points, available_points)
      VALUES (p_user_id, v_points, v_points)
      ON DUPLICATE KEY UPDATE 
        total_points = total_points + v_points,
        available_points = available_points + v_points;
      
      -- 记录积分变动
      INSERT INTO point_transactions (id, user_id, points, transaction_type, reference_id, description)
      VALUES (UUID(), p_user_id, v_points, 'earn_action', p_content_id, CONCAT('行为奖励:', p_action_type));
    END IF;
  END IF;
  
  SET p_points_earned = v_points;
END //


-- ----------------------------------------
-- 积分系统API
-- ----------------------------------------

-- API: GET /api/points
-- 功能: 获取用户积分
CREATE PROCEDURE IF NOT EXISTS api_points_get(
  IN p_user_id VARCHAR(36)
)
BEGIN
  SELECT 
    IFNULL(up.total_points, 0) AS total_points,
    IFNULL(up.available_points, 0) AS available_points,
    IFNULL(up.level, 1) AS level,
    IFNULL(up.exp, 0) AS exp
  FROM user_points up
  WHERE up.user_id = p_user_id;
END //


-- ----------------------------------------
-- 打卡系统API
-- ----------------------------------------

-- API: POST /api/checkin
-- 功能: 用户打卡
CREATE PROCEDURE IF NOT EXISTS api_checkin(
  IN p_user_id VARCHAR(36),
  OUT p_success BOOLEAN,
  OUT p_streak INT,
  OUT p_points_earned INT,
  OUT p_message VARCHAR(100)
)
BEGIN
  DECLARE v_last_date DATE;
  DECLARE v_current_streak INT DEFAULT 0;
  DECLARE v_already_checked INT;
  DECLARE v_base_points INT DEFAULT 10;
  DECLARE v_bonus_points INT DEFAULT 0;
  
  -- 检查今天是否已打卡
  SELECT COUNT(*) INTO v_already_checked FROM check_in_records 
  WHERE user_id = p_user_id AND check_in_date = CURDATE();
  
  IF v_already_checked > 0 THEN
    SET p_success = false;
    SET p_message = '今天已经打卡过了';
    SET p_streak = 0;
    SET p_points_earned = 0;
  ELSE
    -- 获取打卡统计
    SELECT current_streak, last_check_in_date INTO v_current_streak, v_last_date 
    FROM check_in_stats WHERE user_id = p_user_id;
    
    -- 计算连续天数
    IF v_last_date IS NULL OR DATEDIFF(CURDATE(), v_last_date) > 1 THEN
      SET v_current_streak = 1;  -- 断签，重新开始
    ELSE
      SET v_current_streak = v_current_streak + 1;
    END IF;
    
    -- 计算积分（连续打卡有额外奖励）
    SET v_bonus_points = LEAST(v_current_streak - 1, 10) * 2;  -- 最多额外20分
    SET p_points_earned = v_base_points + v_bonus_points;
    
    -- 插入打卡记录
    INSERT INTO check_in_records (id, user_id, check_in_date, streak_count, points_earned)
    VALUES (UUID(), p_user_id, CURDATE(), v_current_streak, p_points_earned);
    
    -- 更新打卡统计
    INSERT INTO check_in_stats (user_id, current_streak, longest_streak, total_check_ins, last_check_in_date)
    VALUES (p_user_id, v_current_streak, v_current_streak, 1, CURDATE())
    ON DUPLICATE KEY UPDATE
      current_streak = v_current_streak,
      longest_streak = GREATEST(longest_streak, v_current_streak),
      total_check_ins = total_check_ins + 1,
      last_check_in_date = CURDATE();
    
    -- 增加积分
    INSERT INTO user_points (user_id, total_points, available_points)
    VALUES (p_user_id, p_points_earned, p_points_earned)
    ON DUPLICATE KEY UPDATE 
      total_points = total_points + p_points_earned,
      available_points = available_points + p_points_earned;
    
    -- 记录积分变动
    INSERT INTO point_transactions (id, user_id, points, transaction_type, description)
    VALUES (UUID(), p_user_id, p_points_earned, 'earn_checkin', CONCAT('打卡奖励(连续', v_current_streak, '天)'));
    
    SET p_success = true;
    SET p_streak = v_current_streak;
    SET p_message = CONCAT('打卡成功！连续', v_current_streak, '天');
  END IF;
END //


-- API: GET /api/checkin/progress
-- 功能: 获取打卡进度
CREATE PROCEDURE IF NOT EXISTS api_checkin_get_progress(
  IN p_user_id VARCHAR(36)
)
BEGIN
  SELECT 
    IFNULL(cs.current_streak, 0) AS current_streak,
    IFNULL(cs.longest_streak, 0) AS longest_streak,
    IFNULL(cs.total_check_ins, 0) AS total_check_ins,
    cs.last_check_in_date,
    (cs.last_check_in_date = CURDATE()) AS checked_today
  FROM check_in_stats cs
  WHERE cs.user_id = p_user_id;
  
  -- 获取最近7天打卡记录
  SELECT check_in_date, streak_count, points_earned 
  FROM check_in_records 
  WHERE user_id = p_user_id 
  ORDER BY check_in_date DESC 
  LIMIT 7;
END //


-- API: GET /api/checkin/leaderboard
-- 功能: 获取打卡排行榜
CREATE PROCEDURE IF NOT EXISTS api_checkin_leaderboard(
  IN p_limit INT
)
BEGIN
  SELECT 
    cs.user_id,
    cs.current_streak,
    cs.longest_streak,
    cs.total_check_ins,
    RANK() OVER (ORDER BY cs.current_streak DESC, cs.total_check_ins DESC) AS rank_position
  FROM check_in_stats cs
  WHERE cs.last_check_in_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)  -- 只显示活跃用户
  ORDER BY cs.current_streak DESC, cs.total_check_ins DESC
  LIMIT p_limit;
END //


-- ----------------------------------------
-- 奖励系统API
-- ----------------------------------------

-- API: GET /api/rewards
-- 功能: 获取所有可用奖励
CREATE PROCEDURE IF NOT EXISTS api_rewards_list(
  IN p_user_id VARCHAR(36)
)
BEGIN
  SELECT 
    r.id, r.name, r.description, r.icon_url, r.reward_type,
    r.required_points, r.required_streak, r.required_level, r.unlock_condition,
    (ur.id IS NOT NULL) AS is_unlocked,
    ur.unlocked_at,
    ur.is_equipped
  FROM rewards r
  LEFT JOIN user_rewards ur ON r.id = ur.reward_id AND ur.user_id = p_user_id
  WHERE r.is_active = true
  ORDER BY r.sort_order, r.required_points;
END //


-- API: POST /api/rewards/unlock
-- 功能: 解锁奖励
CREATE PROCEDURE IF NOT EXISTS api_rewards_unlock(
  IN p_user_id VARCHAR(36),
  IN p_reward_id VARCHAR(36),
  OUT p_success BOOLEAN,
  OUT p_message VARCHAR(100)
)
BEGIN
  DECLARE v_required_points INT;
  DECLARE v_required_streak INT;
  DECLARE v_user_points INT;
  DECLARE v_user_streak INT;
  DECLARE v_already_unlocked INT;
  
  -- 检查是否已解锁
  SELECT COUNT(*) INTO v_already_unlocked FROM user_rewards 
  WHERE user_id = p_user_id AND reward_id = p_reward_id;
  
  IF v_already_unlocked > 0 THEN
    SET p_success = false;
    SET p_message = '已经解锁过了';
  ELSE
    -- 获取奖励要求
    SELECT required_points, required_streak INTO v_required_points, v_required_streak 
    FROM rewards WHERE id = p_reward_id AND is_active = true;
    
    IF v_required_points IS NULL THEN
      SET p_success = false;
      SET p_message = '奖励不存在';
    ELSE
      -- 获取用户数据
      SELECT available_points INTO v_user_points FROM user_points WHERE user_id = p_user_id;
      SELECT current_streak INTO v_user_streak FROM check_in_stats WHERE user_id = p_user_id;
      
      SET v_user_points = IFNULL(v_user_points, 0);
      SET v_user_streak = IFNULL(v_user_streak, 0);
      
      -- 检查条件
      IF v_required_points > 0 AND v_user_points < v_required_points THEN
        SET p_success = false;
        SET p_message = CONCAT('积分不足，需要', v_required_points, '分');
      ELSEIF v_required_streak > 0 AND v_user_streak < v_required_streak THEN
        SET p_success = false;
        SET p_message = CONCAT('连续打卡天数不足，需要', v_required_streak, '天');
      ELSE
        -- 扣除积分（如果需要）
        IF v_required_points > 0 THEN
          UPDATE user_points SET available_points = available_points - v_required_points 
          WHERE user_id = p_user_id;
          
          INSERT INTO point_transactions (id, user_id, points, transaction_type, reference_id, description)
          VALUES (UUID(), p_user_id, -v_required_points, 'spend_reward', p_reward_id, '解锁奖励');
        END IF;
        
        -- 解锁奖励
        INSERT INTO user_rewards (id, user_id, reward_id)
        VALUES (UUID(), p_user_id, p_reward_id);
        
        SET p_success = true;
        SET p_message = '解锁成功';
      END IF;
    END IF;
  END IF;
END //


-- API: GET /api/rewards/unlocked
-- 功能: 获取用户已解锁的奖励
CREATE PROCEDURE IF NOT EXISTS api_rewards_get_unlocked(
  IN p_user_id VARCHAR(36),
  IN p_reward_type VARCHAR(50)  -- 可选筛选类型
)
BEGIN
  SELECT 
    r.id, r.name, r.description, r.icon_url, r.reward_type,
    ur.unlocked_at, ur.is_equipped
  FROM user_rewards ur
  INNER JOIN rewards r ON ur.reward_id = r.id
  WHERE ur.user_id = p_user_id
    AND (p_reward_type IS NULL OR r.reward_type = p_reward_type)
  ORDER BY ur.unlocked_at DESC;
END //

DELIMITER ;


-- =========================================================
-- 3. 索引优化 (Index Optimization)
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_actions_user_date ON user_actions (user_id, DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_gift_records_date ON gift_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_ranking ON check_in_stats (current_streak DESC, total_check_ins DESC);


-- =========================================================
-- 4. 初始化配置数据
-- =========================================================

-- 积分规则配置
INSERT INTO point_rules (id, action_type, points_value, daily_limit, description) VALUES
(UUID(), 'view', 1, 50, '浏览内容，每日上限10次'),
(UUID(), 'like', 2, 30, '点赞内容，每日上限10次'),
(UUID(), 'comment', 5, 20, '评论内容，每日上限20次'),
(UUID(), 'favorite', 3, 20, '收藏内容，每日上限50次'),
(UUID(), 'share', 10, 10, '分享内容，每日上限20次'),
(UUID(), 'checkin', 10, 1, '每日打卡基础积分')
ON DUPLICATE KEY UPDATE points_value = VALUES(points_value);


-- 礼物定义
INSERT INTO gifts (id, name, icon_url, description, price_points, effect_type, sort_order) VALUES
('gift_001', '小红花', '/assets/gifts/flower.png', '送一朵小红花表示赞赏', 10, 'basic', 1),
('gift_002', '便便徽章', '/assets/gifts/poop_badge.png', '认可你的扔便便精神', 50, 'bronze', 2),
('gift_003', '金色便便', '/assets/gifts/golden_poop.png', '珍贵的金色便便', 200, 'gold', 3),
('gift_004', '便便之王', '/assets/gifts/poop_king.png', '至高无上的荣耀', 500, 'legendary', 4),
('gift_005', '彩虹便便', '/assets/gifts/rainbow_poop.png', '传说中的彩虹便便', 1000, 'rainbow', 5)
ON DUPLICATE KEY UPDATE name = VALUES(name);


-- 奖励定义
INSERT INTO rewards (id, name, description, icon_url, reward_type, required_points, required_streak, sort_order) VALUES
-- 称号
('reward_001', '新手便便侠', '完成首次扔便便', '/assets/rewards/title_newbie.png', 'title', 0, 0, 1),
('reward_002', '便便达人', '累积100积分解锁', '/assets/rewards/title_expert.png', 'title', 100, 0, 2),
('reward_003', '便便大师', '累积500积分解锁', '/assets/rewards/title_master.png', 'title', 500, 0, 3),
('reward_004', '便便传奇', '连续打卡30天解锁', '/assets/rewards/title_legend.png', 'title', 0, 30, 4),

-- 贴纸
('reward_101', '基础便便贴纸包', '包含5款基础贴纸', '/assets/rewards/sticker_basic.png', 'sticker', 50, 0, 10),
('reward_102', '高级便便贴纸包', '包含10款高级贴纸', '/assets/rewards/sticker_premium.png', 'sticker', 200, 0, 11),

-- 表情
('reward_201', '便便表情包', '解锁便便专属表情', '/assets/rewards/emoji_poop.png', 'emoji', 100, 0, 20),

-- 头像框
('reward_301', '青铜便便框', '基础头像框', '/assets/rewards/frame_bronze.png', 'avatar_frame', 50, 0, 30),
('reward_302', '白银便便框', '进阶头像框', '/assets/rewards/frame_silver.png', 'avatar_frame', 150, 0, 31),
('reward_303', '黄金便便框', '高级头像框', '/assets/rewards/frame_gold.png', 'avatar_frame', 300, 0, 32),
('reward_304', '传奇便便框', '连续打卡7天解锁', '/assets/rewards/frame_legend.png', 'avatar_frame', 0, 7, 33)
ON DUPLICATE KEY UPDATE name = VALUES(name);


-- =========================================================
-- 5. 示例测试数据
-- =========================================================

-- 测试用户积分
INSERT INTO user_points (user_id, total_points, available_points, level, exp) VALUES
('user_001', 350, 280, 3, 350),
('user_002', 520, 450, 4, 520),
('user_003', 180, 150, 2, 180)
ON DUPLICATE KEY UPDATE total_points = VALUES(total_points);

-- 测试打卡统计
INSERT INTO check_in_stats (user_id, current_streak, longest_streak, total_check_ins, last_check_in_date) VALUES
('user_001', 7, 15, 45, CURDATE()),
('user_002', 12, 12, 38, CURDATE()),
('user_003', 3, 8, 22, DATE_SUB(CURDATE(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE current_streak = VALUES(current_streak);

-- 测试关注关系
INSERT INTO user_follows (id, follower_id, following_id) VALUES
(UUID(), 'user_001', 'user_002'),
(UUID(), 'user_001', 'user_003'),
(UUID(), 'user_002', 'user_001'),
(UUID(), 'user_003', 'user_001')
ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP;
