-- BOSS KILL 小游戏数据库初始化脚本 - 绘图服务
-- 创建绘画作品、贴纸、标签、审核等相关的表结构及API逻辑

-- =========================================================
-- 1. 表结构定义 (Table Definitions)
-- =========================================================

-- ----------------------------------------
-- 绘画作品模块
-- ----------------------------------------

-- 绘画作品表 (drawings)
CREATE TABLE IF NOT EXISTS drawings (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  
  -- 图像信息
  image_code VARCHAR(50) UNIQUE NOT NULL,  -- 图像编号 (如: BOSS20260127001)
  image_url VARCHAR(500),                   -- 图像存储URL
  thumbnail_url VARCHAR(500),               -- 缩略图URL
  
  -- 作品信息
  title VARCHAR(255),
  description TEXT,
  
  -- 画布数据（可选，用于恢复编辑）
  canvas_data JSON,                         -- 画布状态数据
  canvas_width INT,
  canvas_height INT,
  
  -- 审核状态
  review_status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected, flagged
  review_reason TEXT,
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(36),
  
  -- 统计数据
  like_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  share_count INT DEFAULT 0,
  
  -- 状态
  is_public BOOLEAN DEFAULT false,          -- 是否公开
  is_deleted BOOLEAN DEFAULT false,
  
  -- 时间
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at TIMESTAMP,                   -- 公开时间
  
  INDEX idx_user_id (user_id),
  INDEX idx_image_code (image_code),
  INDEX idx_review_status (review_status),
  INDEX idx_is_public (is_public),
  INDEX idx_created_at (created_at DESC)
);

-- 绘画标签表 (drawing_tags)
CREATE TABLE IF NOT EXISTS drawing_tags (
  id VARCHAR(36) PRIMARY KEY,
  drawing_id VARCHAR(36) NOT NULL,
  tag_name VARCHAR(50) NOT NULL,
  tag_category VARCHAR(30),                 -- boss_type, emotion, style, etc.
  
  FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE,
  UNIQUE KEY uk_drawing_tag (drawing_id, tag_name),
  INDEX idx_tag_name (tag_name),
  INDEX idx_tag_category (tag_category)
);

-- 标签定义表 (tag_definitions)
-- 预定义的标签库
CREATE TABLE IF NOT EXISTS tag_definitions (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,            -- boss_type, emotion, style, scene
  color VARCHAR(7),                         -- 标签颜色
  icon VARCHAR(50),
  usage_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  
  INDEX idx_category (category),
  INDEX idx_usage_count (usage_count DESC)
);

-- ----------------------------------------
-- 贴纸模块
-- ----------------------------------------

-- 贴纸分类表 (sticker_categories)
CREATE TABLE IF NOT EXISTS sticker_categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  INDEX idx_sort_order (sort_order)
);

-- 贴纸定义表 (stickers)
CREATE TABLE IF NOT EXISTS stickers (
  id VARCHAR(36) PRIMARY KEY,
  category_id VARCHAR(36) NOT NULL,
  
  -- 贴纸信息
  name VARCHAR(100) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  
  -- 属性
  is_premium BOOLEAN DEFAULT false,         -- 是否为高级贴纸
  unlock_type VARCHAR(30) DEFAULT 'free',   -- free, points, vip, achievement
  unlock_value INT DEFAULT 0,               -- 解锁所需积分等
  
  -- 统计
  usage_count INT DEFAULT 0,
  
  -- 状态
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (category_id) REFERENCES sticker_categories(id),
  INDEX idx_category (category_id),
  INDEX idx_is_premium (is_premium),
  INDEX idx_unlock_type (unlock_type)
);

-- 用户解锁贴纸表 (user_stickers)
CREATE TABLE IF NOT EXISTS user_stickers (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  sticker_id VARCHAR(36) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (sticker_id) REFERENCES stickers(id),
  UNIQUE KEY uk_user_sticker (user_id, sticker_id),
  INDEX idx_user_id (user_id)
);

-- 绘画使用的贴纸记录 (drawing_stickers)
CREATE TABLE IF NOT EXISTS drawing_stickers (
  id VARCHAR(36) PRIMARY KEY,
  drawing_id VARCHAR(36) NOT NULL,
  sticker_id VARCHAR(36) NOT NULL,
  
  -- 贴纸位置和变换
  position_x DECIMAL(10, 2),
  position_y DECIMAL(10, 2),
  scale DECIMAL(5, 2) DEFAULT 1.0,
  rotation DECIMAL(5, 2) DEFAULT 0,
  z_index INT DEFAULT 0,
  
  FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE,
  FOREIGN KEY (sticker_id) REFERENCES stickers(id),
  INDEX idx_drawing_id (drawing_id)
);

-- ----------------------------------------
-- 审核模块
-- ----------------------------------------

-- 审核记录表 (drawing_reviews)
CREATE TABLE IF NOT EXISTS drawing_reviews (
  id VARCHAR(36) PRIMARY KEY,
  drawing_id VARCHAR(36) NOT NULL,
  
  -- 审核信息
  review_type VARCHAR(30) NOT NULL,         -- auto, manual
  review_result VARCHAR(20) NOT NULL,       -- approved, rejected, flagged
  review_reason TEXT,
  
  -- AI审核结果（如有）
  ai_score DECIMAL(5, 2),                   -- AI置信度分数
  ai_categories JSON,                       -- AI检测到的类别
  
  -- 审核人
  reviewer_id VARCHAR(36),                  -- 人工审核员ID
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE,
  INDEX idx_drawing_id (drawing_id),
  INDEX idx_review_type (review_type),
  INDEX idx_review_result (review_result)
);

-- 审核规则表 (review_rules)
CREATE TABLE IF NOT EXISTS review_rules (
  id VARCHAR(36) PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(30) NOT NULL,           -- keyword, image_category, user_behavior
  rule_value TEXT NOT NULL,                 -- 规则内容
  action VARCHAR(20) NOT NULL,              -- reject, flag, approve
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  INDEX idx_rule_type (rule_type)
);


-- =========================================================
-- 2. API逻辑的存储过程 (Stored Procedures for API Logic)
-- =========================================================

DELIMITER //

-- ----------------------------------------
-- 绘画作品API
-- ----------------------------------------

-- API: POST /api/drawings
-- 功能: 保存绘画作品
CREATE PROCEDURE IF NOT EXISTS api_drawing_save(
  IN p_user_id VARCHAR(36),
  IN p_title VARCHAR(255),
  IN p_description TEXT,
  IN p_image_url VARCHAR(500),
  IN p_thumbnail_url VARCHAR(500),
  IN p_canvas_data JSON,
  IN p_canvas_width INT,
  IN p_canvas_height INT,
  OUT p_drawing_id VARCHAR(36),
  OUT p_image_code VARCHAR(50)
)
BEGIN
  DECLARE v_today_count INT;
  DECLARE v_date_str VARCHAR(8);
  
  SET p_drawing_id = UUID();
  SET v_date_str = DATE_FORMAT(NOW(), '%Y%m%d');
  
  -- 获取今日已有的作品数量，生成唯一编号
  SELECT COUNT(*) + 1 INTO v_today_count FROM drawings 
  WHERE DATE(created_at) = CURDATE();
  
  SET p_image_code = CONCAT('BOSS', v_date_str, LPAD(v_today_count, 3, '0'));
  
  INSERT INTO drawings (
    id, user_id, image_code, image_url, thumbnail_url, 
    title, description, canvas_data, canvas_width, canvas_height,
    review_status
  ) VALUES (
    p_drawing_id, p_user_id, p_image_code, p_image_url, p_thumbnail_url,
    p_title, p_description, p_canvas_data, p_canvas_width, p_canvas_height,
    'pending'
  );
END //


-- API: POST /api/drawings/:id/submit
-- 功能: 提交作品审核
CREATE PROCEDURE IF NOT EXISTS api_drawing_submit_review(
  IN p_drawing_id VARCHAR(36),
  IN p_user_id VARCHAR(36),
  OUT p_success BOOLEAN,
  OUT p_review_status VARCHAR(20)
)
BEGIN
  DECLARE v_owner_id VARCHAR(36);
  DECLARE v_current_status VARCHAR(20);
  
  -- 检查所有权和当前状态
  SELECT user_id, review_status INTO v_owner_id, v_current_status
  FROM drawings WHERE id = p_drawing_id;
  
  IF v_owner_id != p_user_id THEN
    SET p_success = false;
    SET p_review_status = 'error';
  ELSEIF v_current_status != 'pending' THEN
    SET p_success = false;
    SET p_review_status = v_current_status;
  ELSE
    -- 模拟自动审核（实际应调用AI审核服务）
    -- 这里简化为直接通过
    UPDATE drawings 
    SET review_status = 'approved', 
        reviewed_at = NOW(),
        is_public = true,
        published_at = NOW()
    WHERE id = p_drawing_id;
    
    -- 记录审核
    INSERT INTO drawing_reviews (id, drawing_id, review_type, review_result)
    VALUES (UUID(), p_drawing_id, 'auto', 'approved');
    
    SET p_success = true;
    SET p_review_status = 'approved';
  END IF;
END //


-- API: GET /api/drawings/user/:userId
-- 功能: 获取用户的绘画作品
CREATE PROCEDURE IF NOT EXISTS api_drawing_get_by_user(
  IN p_user_id VARCHAR(36),
  IN p_include_private BOOLEAN,
  IN p_page INT,
  IN p_page_size INT
)
BEGIN
  DECLARE v_offset INT;
  SET v_offset = (p_page - 1) * p_page_size;
  
  SELECT 
    d.id, d.image_code, d.image_url, d.thumbnail_url,
    d.title, d.description, d.review_status,
    d.like_count, d.view_count, d.is_public,
    d.created_at, d.published_at,
    GROUP_CONCAT(dt.tag_name) as tags
  FROM drawings d
  LEFT JOIN drawing_tags dt ON d.id = dt.drawing_id
  WHERE d.user_id = p_user_id
    AND d.is_deleted = false
    AND (p_include_private = true OR d.is_public = true)
  GROUP BY d.id
  ORDER BY d.created_at DESC
  LIMIT p_page_size OFFSET v_offset;
END //


-- API: GET /api/drawings/:id
-- 功能: 获取单个绘画作品详情
CREATE PROCEDURE IF NOT EXISTS api_drawing_get_detail(
  IN p_drawing_id VARCHAR(36),
  IN p_viewer_id VARCHAR(36)
)
BEGIN
  -- 增加浏览量
  UPDATE drawings SET view_count = view_count + 1 WHERE id = p_drawing_id;
  
  SELECT 
    d.id, d.user_id, d.image_code, d.image_url, d.thumbnail_url,
    d.title, d.description, d.review_status,
    d.like_count, d.view_count, d.share_count,
    d.is_public, d.created_at, d.published_at,
    d.canvas_width, d.canvas_height,
    GROUP_CONCAT(DISTINCT dt.tag_name) as tags
  FROM drawings d
  LEFT JOIN drawing_tags dt ON d.id = dt.drawing_id
  WHERE d.id = p_drawing_id AND d.is_deleted = false
  GROUP BY d.id;
  
  -- 获取使用的贴纸
  SELECT 
    ds.*, s.name as sticker_name, s.image_url as sticker_image
  FROM drawing_stickers ds
  INNER JOIN stickers s ON ds.sticker_id = s.id
  WHERE ds.drawing_id = p_drawing_id;
END //


-- ----------------------------------------
-- 贴纸API
-- ----------------------------------------

-- API: GET /api/stickers/categories
-- 功能: 获取贴纸分类列表
CREATE PROCEDURE IF NOT EXISTS api_sticker_get_categories()
BEGIN
  SELECT 
    sc.id, sc.name, sc.display_name, sc.description, sc.icon, sc.color,
    COUNT(s.id) as sticker_count
  FROM sticker_categories sc
  LEFT JOIN stickers s ON sc.id = s.category_id AND s.is_active = true
  WHERE sc.is_active = true
  GROUP BY sc.id
  ORDER BY sc.sort_order;
END //


-- API: GET /api/stickers
-- 功能: 获取贴纸列表
CREATE PROCEDURE IF NOT EXISTS api_sticker_get_list(
  IN p_user_id VARCHAR(36),
  IN p_category_id VARCHAR(36)
)
BEGIN
  SELECT 
    s.id, s.name, s.image_url, s.thumbnail_url,
    s.is_premium, s.unlock_type, s.unlock_value,
    sc.name as category_name, sc.display_name as category_display,
    (us.id IS NOT NULL OR s.unlock_type = 'free') as is_unlocked
  FROM stickers s
  INNER JOIN sticker_categories sc ON s.category_id = sc.id
  LEFT JOIN user_stickers us ON s.id = us.sticker_id AND us.user_id = p_user_id
  WHERE s.is_active = true
    AND (p_category_id IS NULL OR s.category_id = p_category_id)
  ORDER BY sc.sort_order, s.sort_order;
END //


-- API: POST /api/stickers/unlock
-- 功能: 解锁贴纸
CREATE PROCEDURE IF NOT EXISTS api_sticker_unlock(
  IN p_user_id VARCHAR(36),
  IN p_sticker_id VARCHAR(36),
  OUT p_success BOOLEAN,
  OUT p_message VARCHAR(100)
)
BEGIN
  DECLARE v_unlock_type VARCHAR(30);
  DECLARE v_unlock_value INT;
  DECLARE v_user_points INT;
  DECLARE v_already_unlocked INT;
  
  -- 检查是否已解锁
  SELECT COUNT(*) INTO v_already_unlocked FROM user_stickers 
  WHERE user_id = p_user_id AND sticker_id = p_sticker_id;
  
  IF v_already_unlocked > 0 THEN
    SET p_success = false;
    SET p_message = '已经解锁过了';
  ELSE
    -- 获取贴纸解锁条件
    SELECT unlock_type, unlock_value INTO v_unlock_type, v_unlock_value
    FROM stickers WHERE id = p_sticker_id AND is_active = true;
    
    IF v_unlock_type IS NULL THEN
      SET p_success = false;
      SET p_message = '贴纸不存在';
    ELSEIF v_unlock_type = 'free' THEN
      INSERT INTO user_stickers (id, user_id, sticker_id) VALUES (UUID(), p_user_id, p_sticker_id);
      SET p_success = true;
      SET p_message = '解锁成功';
    ELSEIF v_unlock_type = 'points' THEN
      -- 检查积分（需要关联积分表）
      SELECT available_points INTO v_user_points FROM user_points WHERE user_id = p_user_id;
      
      IF IFNULL(v_user_points, 0) < v_unlock_value THEN
        SET p_success = false;
        SET p_message = CONCAT('积分不足，需要', v_unlock_value, '分');
      ELSE
        -- 扣除积分
        UPDATE user_points SET available_points = available_points - v_unlock_value WHERE user_id = p_user_id;
        -- 解锁贴纸
        INSERT INTO user_stickers (id, user_id, sticker_id) VALUES (UUID(), p_user_id, p_sticker_id);
        -- 更新贴纸使用统计
        UPDATE stickers SET usage_count = usage_count + 1 WHERE id = p_sticker_id;
        
        SET p_success = true;
        SET p_message = '解锁成功';
      END IF;
    ELSE
      SET p_success = false;
      SET p_message = '不支持的解锁方式';
    END IF;
  END IF;
END //


-- ----------------------------------------
-- 标签API
-- ----------------------------------------

-- API: GET /api/tags
-- 功能: 获取标签列表
CREATE PROCEDURE IF NOT EXISTS api_tag_get_list(
  IN p_category VARCHAR(30)
)
BEGIN
  SELECT id, name, display_name, category, color, icon, usage_count
  FROM tag_definitions
  WHERE is_active = true
    AND (p_category IS NULL OR category = p_category)
  ORDER BY usage_count DESC, sort_order;
END //


-- API: POST /api/drawings/:id/tags
-- 功能: 为绘画添加标签
CREATE PROCEDURE IF NOT EXISTS api_drawing_add_tags(
  IN p_drawing_id VARCHAR(36),
  IN p_tags JSON
)
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE v_tag VARCHAR(50);
  DECLARE v_tag_count INT;
  
  -- 获取标签数量
  SET v_tag_count = JSON_LENGTH(p_tags);
  
  -- 清除现有标签
  DELETE FROM drawing_tags WHERE drawing_id = p_drawing_id;
  
  -- 添加新标签
  WHILE i < v_tag_count DO
    SET v_tag = JSON_UNQUOTE(JSON_EXTRACT(p_tags, CONCAT('$[', i, ']')));
    
    INSERT INTO drawing_tags (id, drawing_id, tag_name)
    VALUES (UUID(), p_drawing_id, v_tag);
    
    -- 更新标签使用统计
    UPDATE tag_definitions SET usage_count = usage_count + 1 WHERE name = v_tag;
    
    SET i = i + 1;
  END WHILE;
END //

DELIMITER ;


-- =========================================================
-- 3. 索引优化 (Index Optimization)
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_drawings_public_time 
ON drawings (is_public, review_status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_stickers_category_active 
ON stickers (category_id, is_active, sort_order);


-- =========================================================
-- 4. 初始化配置数据
-- =========================================================

-- 贴纸分类
INSERT INTO sticker_categories (id, name, display_name, description, icon, color, sort_order) VALUES
('cat_boss', 'boss', '老板系列', '各种老板形象贴纸', 'person', '#FF5722', 1),
('cat_emotion', 'emotion', '表情系列', '表达情绪的贴纸', 'sentiment_satisfied', '#FFC107', 2),
('cat_poop', 'poop', '便便系列', '各种便便造型', 'emoji_symbols', '#795548', 3),
('cat_effect', 'effect', '特效系列', '动态特效贴纸', 'auto_awesome', '#9C27B0', 4),
('cat_text', 'text', '文字系列', '吐槽文字贴纸', 'text_fields', '#2196F3', 5),
('cat_premium', 'premium', '限定系列', 'VIP限定贴纸', 'star', '#FFD700', 6)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

-- 贴纸
INSERT INTO stickers (id, category_id, name, image_url, is_premium, unlock_type, unlock_value, sort_order) VALUES
-- 老板系列
('sticker_001', 'cat_boss', '秃头老板', '/assets/stickers/boss/bald.png', false, 'free', 0, 1),
('sticker_002', 'cat_boss', '胖老板', '/assets/stickers/boss/fat.png', false, 'free', 0, 2),
('sticker_003', 'cat_boss', '瘦老板', '/assets/stickers/boss/thin.png', false, 'free', 0, 3),
('sticker_004', 'cat_boss', '眼镜老板', '/assets/stickers/boss/glasses.png', false, 'points', 50, 4),
('sticker_005', 'cat_boss', '西装老板', '/assets/stickers/boss/suit.png', false, 'points', 100, 5),

-- 表情系列
('sticker_101', 'cat_emotion', '愤怒', '/assets/stickers/emotion/angry.png', false, 'free', 0, 1),
('sticker_102', 'cat_emotion', '无语', '/assets/stickers/emotion/speechless.png', false, 'free', 0, 2),
('sticker_103', 'cat_emotion', '大哭', '/assets/stickers/emotion/cry.png', false, 'free', 0, 3),
('sticker_104', 'cat_emotion', '得意', '/assets/stickers/emotion/proud.png', false, 'points', 30, 4),

-- 便便系列
('sticker_201', 'cat_poop', '普通便便', '/assets/stickers/poop/normal.png', false, 'free', 0, 1),
('sticker_202', 'cat_poop', '金色便便', '/assets/stickers/poop/golden.png', false, 'points', 100, 2),
('sticker_203', 'cat_poop', '彩虹便便', '/assets/stickers/poop/rainbow.png', true, 'points', 500, 3),
('sticker_204', 'cat_poop', '爱心便便', '/assets/stickers/poop/heart.png', false, 'points', 50, 4),

-- 特效系列
('sticker_301', 'cat_effect', '火焰', '/assets/stickers/effect/fire.png', false, 'points', 80, 1),
('sticker_302', 'cat_effect', '闪电', '/assets/stickers/effect/lightning.png', false, 'points', 80, 2),
('sticker_303', 'cat_effect', '爆炸', '/assets/stickers/effect/explosion.png', true, 'points', 200, 3),

-- 文字系列
('sticker_401', 'cat_text', '996', '/assets/stickers/text/996.png', false, 'free', 0, 1),
('sticker_402', 'cat_text', '加油', '/assets/stickers/text/jiayou.png', false, 'free', 0, 2),
('sticker_403', 'cat_text', '打工人', '/assets/stickers/text/worker.png', false, 'free', 0, 3),
('sticker_404', 'cat_text', 'OMG', '/assets/stickers/text/omg.png', false, 'points', 30, 4)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 标签定义
INSERT INTO tag_definitions (id, name, display_name, category, color, sort_order) VALUES
-- 老板类型
('tag_001', 'bald_boss', '秃头老板', 'boss_type', '#FF5722', 1),
('tag_002', '996_boss', '996老板', 'boss_type', '#F44336', 2),
('tag_003', 'pua_boss', 'PUA老板', 'boss_type', '#9C27B0', 3),
('tag_004', 'meeting_boss', '开会老板', 'boss_type', '#3F51B5', 4),
('tag_005', 'blame_boss', '甩锅老板', 'boss_type', '#009688', 5),

-- 情绪
('tag_101', 'angry', '愤怒', 'emotion', '#F44336', 1),
('tag_102', 'sad', '悲伤', 'emotion', '#2196F3', 2),
('tag_103', 'happy', '开心', 'emotion', '#4CAF50', 3),
('tag_104', 'tired', '疲惫', 'emotion', '#9E9E9E', 4),

-- 风格
('tag_201', 'cute', '可爱', 'style', '#E91E63', 1),
('tag_202', 'funny', '搞笑', 'style', '#FF9800', 2),
('tag_203', 'sarcastic', '讽刺', 'style', '#795548', 3),
('tag_204', 'realistic', '写实', 'style', '#607D8B', 4)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);


-- =========================================================
-- 5. 审核规则（示例）
-- =========================================================

INSERT INTO review_rules (id, rule_name, rule_type, rule_value, action, priority) VALUES
('rule_001', '敏感词过滤', 'keyword', '政治,暴力,色情', 'reject', 100),
('rule_002', '人物审核', 'image_category', 'person_face', 'flag', 50),
('rule_003', '正常内容', 'default', '*', 'approve', 0)
ON DUPLICATE KEY UPDATE rule_value = VALUES(rule_value);


-- =========================================================
-- 6. 示例测试数据
-- =========================================================

-- 测试绘画作品
INSERT INTO drawings (id, user_id, image_code, image_url, thumbnail_url, title, description, review_status, is_public, like_count, view_count) VALUES
('drawing_001', 'demo_user_001', 'BOSS20260127001', '/uploads/drawings/demo1.png', '/uploads/drawings/demo1_thumb.png', '我的秃头老板', '画了一个天天开会的秃头老板', 'approved', true, 128, 560),
('drawing_002', 'demo_user_001', 'BOSS20260127002', '/uploads/drawings/demo2.png', '/uploads/drawings/demo2_thumb.png', '996福报', '加班到深夜的日常', 'approved', true, 89, 320),
('drawing_003', 'demo_user_001', 'BOSS20260127003', '/uploads/drawings/demo3.png', '/uploads/drawings/demo3_thumb.png', '未完成的作品', '还在画...', 'pending', false, 0, 0)
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 测试标签
INSERT INTO drawing_tags (id, drawing_id, tag_name, tag_category) VALUES
(UUID(), 'drawing_001', 'bald_boss', 'boss_type'),
(UUID(), 'drawing_001', 'meeting_boss', 'boss_type'),
(UUID(), 'drawing_001', 'funny', 'style'),
(UUID(), 'drawing_002', '996_boss', 'boss_type'),
(UUID(), 'drawing_002', 'tired', 'emotion')
ON DUPLICATE KEY UPDATE tag_category = VALUES(tag_category);

-- 测试用户已解锁贴纸
INSERT INTO user_stickers (id, user_id, sticker_id) VALUES
(UUID(), 'demo_user_001', 'sticker_001'),
(UUID(), 'demo_user_001', 'sticker_002'),
(UUID(), 'demo_user_001', 'sticker_101'),
(UUID(), 'demo_user_001', 'sticker_201'),
(UUID(), 'demo_user_001', 'sticker_401')
ON DUPLICATE KEY UPDATE unlocked_at = CURRENT_TIMESTAMP;
