-- BOSS KILL 小游戏数据库初始化脚本 - 滑一滑服务
-- 创建内容展示、点赞收藏、推荐系统相关的表结构及API逻辑

-- =========================================================
-- 1. 表结构定义 (Table Definitions)
-- =========================================================

-- 内容表 (contents)
-- 存储用户创作的老板图像内容
CREATE TABLE IF NOT EXISTS contents (
  id VARCHAR(36) PRIMARY KEY,
  author_id VARCHAR(36) NOT NULL,
  
  -- 内容信息
  image_url VARCHAR(500) NOT NULL,
  image_code VARCHAR(50), -- 图像编号
  title VARCHAR(255),
  description TEXT,
  
  -- 统计数据
  like_count INT DEFAULT 0,
  favorite_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  share_count INT DEFAULT 0,
  
  -- 审核状态
  review_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, flagged
  review_reason TEXT,
  reviewed_at TIMESTAMP,
  
  -- 时间信息
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 状态
  is_active BOOLEAN DEFAULT true,
  is_top BOOLEAN DEFAULT false, -- 是否为TOP推荐
  top_rank INT, -- TOP排名 1,2,3
  
  INDEX idx_author_id (author_id),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_like_count (like_count DESC),
  INDEX idx_review_status (review_status),
  INDEX idx_is_top (is_top, top_rank)
);

-- 内容标签表 (content_tags)
-- 存储内容的标签
CREATE TABLE IF NOT EXISTS content_tags (
  id VARCHAR(36) PRIMARY KEY,
  content_id VARCHAR(36) NOT NULL,
  tag_name VARCHAR(50) NOT NULL,
  
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
  UNIQUE KEY uk_content_tag (content_id, tag_name),
  INDEX idx_tag_name (tag_name)
);

-- 用户点赞记录表 (user_likes)
-- 记录用户对内容的点赞
CREATE TABLE IF NOT EXISTS user_likes (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  content_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_content (user_id, content_id),
  INDEX idx_user_id (user_id),
  INDEX idx_content_id (content_id)
);

-- 用户收藏记录表 (user_favorites)
-- 记录用户对内容的收藏
CREATE TABLE IF NOT EXISTS user_favorites (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  content_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_content (user_id, content_id),
  INDEX idx_user_id (user_id),
  INDEX idx_content_id (content_id)
);

-- 用户浏览记录表 (user_views)
-- 记录用户的浏览历史（用于推荐算法）
CREATE TABLE IF NOT EXISTS user_views (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  content_id VARCHAR(36) NOT NULL,
  view_duration INT DEFAULT 0, -- 浏览时长（秒）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_content_id (content_id),
  INDEX idx_created_at (created_at DESC)
);

-- 推荐权重表 (recommendation_weights)
-- 存储推荐算法的权重配置
CREATE TABLE IF NOT EXISTS recommendation_weights (
  id VARCHAR(36) PRIMARY KEY,
  weight_name VARCHAR(50) UNIQUE NOT NULL, -- like_weight, view_weight, recency_weight
  weight_value DECIMAL(5, 2) DEFAULT 1.0,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- =========================================================
-- 2. API逻辑的存储过程 (Stored Procedures for API Logic)
-- =========================================================

DELIMITER //

-- API: GET /api/swipe/top3
-- 功能: 获取Top3推荐内容 (getTop3Content)
CREATE PROCEDURE IF NOT EXISTS api_swipe_get_top3(
  IN p_user_id VARCHAR(36)
)
BEGIN
  SELECT 
    c.id, c.image_url, c.title, c.description,
    c.like_count, c.favorite_count, c.view_count,
    c.created_at, c.author_id, c.top_rank,
    EXISTS(SELECT 1 FROM user_likes WHERE user_id = p_user_id AND content_id = c.id) AS is_liked,
    EXISTS(SELECT 1 FROM user_favorites WHERE user_id = p_user_id AND content_id = c.id) AS is_favorited,
    GROUP_CONCAT(ct.tag_name) AS tags
  FROM contents c
  LEFT JOIN content_tags ct ON c.id = ct.content_id
  WHERE c.is_active = true 
    AND c.review_status = 'approved'
    AND c.is_top = true
  GROUP BY c.id
  ORDER BY c.top_rank ASC
  LIMIT 3;
END //


-- API: GET /api/swipe/feed
-- 功能: 获取推荐内容流 (getContentStream)
-- 包含智能推荐算法：基于点赞数、收藏数、浏览数、时间衰减
CREATE PROCEDURE IF NOT EXISTS api_swipe_get_feed(
  IN p_user_id VARCHAR(36),
  IN p_page INT,
  IN p_page_size INT
)
BEGIN
  DECLARE v_offset INT;
  SET v_offset = (p_page - 1) * p_page_size;
  
  SELECT 
    c.id, c.image_url, c.title, c.description,
    c.like_count, c.favorite_count, c.view_count,
    c.created_at, c.author_id,
    EXISTS(SELECT 1 FROM user_likes WHERE user_id = p_user_id AND content_id = c.id) AS is_liked,
    EXISTS(SELECT 1 FROM user_favorites WHERE user_id = p_user_id AND content_id = c.id) AS is_favorited,
    GROUP_CONCAT(ct.tag_name) AS tags,
    -- 推荐分数计算：点赞权重 + 收藏权重 + 时间衰减
    (c.like_count * 1.0 + c.favorite_count * 2.0 + c.view_count * 0.1) * 
    EXP(-DATEDIFF(CURRENT_DATE, DATE(c.created_at)) / 30.0) AS recommendation_score
  FROM contents c
  LEFT JOIN content_tags ct ON c.id = ct.content_id
  WHERE c.is_active = true 
    AND c.review_status = 'approved'
    -- 排除用户已浏览过的内容（可选）
    -- AND NOT EXISTS(SELECT 1 FROM user_views WHERE user_id = p_user_id AND content_id = c.id)
  GROUP BY c.id
  ORDER BY recommendation_score DESC, c.created_at DESC
  LIMIT p_page_size OFFSET v_offset;
END //


-- API: POST /api/swipe/like
-- 功能: 点赞内容 (likeContent)
CREATE PROCEDURE IF NOT EXISTS api_swipe_like_content(
  IN p_user_id VARCHAR(36),
  IN p_content_id VARCHAR(36),
  OUT p_success BOOLEAN,
  OUT p_new_like_count INT
)
BEGIN
  DECLARE v_exists INT;
  
  -- 检查是否已点赞
  SELECT COUNT(*) INTO v_exists FROM user_likes 
  WHERE user_id = p_user_id AND content_id = p_content_id;
  
  IF v_exists = 0 THEN
    -- 插入点赞记录
    INSERT INTO user_likes (id, user_id, content_id) 
    VALUES (UUID(), p_user_id, p_content_id);
    
    -- 更新内容点赞数
    UPDATE contents SET like_count = like_count + 1 WHERE id = p_content_id;
    
    SET p_success = true;
  ELSE
    SET p_success = false;
  END IF;
  
  -- 返回最新点赞数
  SELECT like_count INTO p_new_like_count FROM contents WHERE id = p_content_id;
END //


-- API: DELETE /api/swipe/like
-- 功能: 取消点赞 (unlikeContent)
CREATE PROCEDURE IF NOT EXISTS api_swipe_unlike_content(
  IN p_user_id VARCHAR(36),
  IN p_content_id VARCHAR(36),
  OUT p_success BOOLEAN,
  OUT p_new_like_count INT
)
BEGIN
  DECLARE v_exists INT;
  
  -- 检查是否已点赞
  SELECT COUNT(*) INTO v_exists FROM user_likes 
  WHERE user_id = p_user_id AND content_id = p_content_id;
  
  IF v_exists > 0 THEN
    -- 删除点赞记录
    DELETE FROM user_likes WHERE user_id = p_user_id AND content_id = p_content_id;
    
    -- 更新内容点赞数
    UPDATE contents SET like_count = GREATEST(like_count - 1, 0) WHERE id = p_content_id;
    
    SET p_success = true;
  ELSE
    SET p_success = false;
  END IF;
  
  -- 返回最新点赞数
  SELECT like_count INTO p_new_like_count FROM contents WHERE id = p_content_id;
END //


-- API: POST /api/swipe/favorite
-- 功能: 收藏内容 (favoriteContent)
CREATE PROCEDURE IF NOT EXISTS api_swipe_favorite_content(
  IN p_user_id VARCHAR(36),
  IN p_content_id VARCHAR(36),
  OUT p_success BOOLEAN,
  OUT p_new_favorite_count INT
)
BEGIN
  DECLARE v_exists INT;
  
  -- 检查是否已收藏
  SELECT COUNT(*) INTO v_exists FROM user_favorites 
  WHERE user_id = p_user_id AND content_id = p_content_id;
  
  IF v_exists = 0 THEN
    -- 插入收藏记录
    INSERT INTO user_favorites (id, user_id, content_id) 
    VALUES (UUID(), p_user_id, p_content_id);
    
    -- 更新内容收藏数
    UPDATE contents SET favorite_count = favorite_count + 1 WHERE id = p_content_id;
    
    SET p_success = true;
  ELSE
    SET p_success = false;
  END IF;
  
  -- 返回最新收藏数
  SELECT favorite_count INTO p_new_favorite_count FROM contents WHERE id = p_content_id;
END //


-- API: DELETE /api/swipe/favorite
-- 功能: 取消收藏 (unfavoriteContent)
CREATE PROCEDURE IF NOT EXISTS api_swipe_unfavorite_content(
  IN p_user_id VARCHAR(36),
  IN p_content_id VARCHAR(36),
  OUT p_success BOOLEAN,
  OUT p_new_favorite_count INT
)
BEGIN
  DECLARE v_exists INT;
  
  -- 检查是否已收藏
  SELECT COUNT(*) INTO v_exists FROM user_favorites 
  WHERE user_id = p_user_id AND content_id = p_content_id;
  
  IF v_exists > 0 THEN
    -- 删除收藏记录
    DELETE FROM user_favorites WHERE user_id = p_user_id AND content_id = p_content_id;
    
    -- 更新内容收藏数
    UPDATE contents SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE id = p_content_id;
    
    SET p_success = true;
  ELSE
    SET p_success = false;
  END IF;
  
  -- 返回最新收藏数
  SELECT favorite_count INTO p_new_favorite_count FROM contents WHERE id = p_content_id;
END //


-- API: POST /api/swipe/view
-- 功能: 记录浏览（用于推荐算法）
CREATE PROCEDURE IF NOT EXISTS api_swipe_record_view(
  IN p_user_id VARCHAR(36),
  IN p_content_id VARCHAR(36),
  IN p_view_duration INT
)
BEGIN
  -- 插入浏览记录
  INSERT INTO user_views (id, user_id, content_id, view_duration)
  VALUES (UUID(), p_user_id, p_content_id, p_view_duration);
  
  -- 更新内容浏览数
  UPDATE contents SET view_count = view_count + 1 WHERE id = p_content_id;
END //


-- 功能: 获取用户点赞列表
CREATE PROCEDURE IF NOT EXISTS api_swipe_get_user_likes(
  IN p_user_id VARCHAR(36),
  IN p_page INT,
  IN p_page_size INT
)
BEGIN
  DECLARE v_offset INT;
  SET v_offset = (p_page - 1) * p_page_size;
  
  SELECT 
    c.id, c.image_url, c.title, c.description,
    c.like_count, c.favorite_count, c.created_at, c.author_id,
    ul.created_at AS liked_at
  FROM user_likes ul
  INNER JOIN contents c ON ul.content_id = c.id
  WHERE ul.user_id = p_user_id AND c.is_active = true
  ORDER BY ul.created_at DESC
  LIMIT p_page_size OFFSET v_offset;
END //


-- 功能: 获取用户收藏列表
CREATE PROCEDURE IF NOT EXISTS api_swipe_get_user_favorites(
  IN p_user_id VARCHAR(36),
  IN p_page INT,
  IN p_page_size INT
)
BEGIN
  DECLARE v_offset INT;
  SET v_offset = (p_page - 1) * p_page_size;
  
  SELECT 
    c.id, c.image_url, c.title, c.description,
    c.like_count, c.favorite_count, c.created_at, c.author_id,
    uf.created_at AS favorited_at
  FROM user_favorites uf
  INNER JOIN contents c ON uf.content_id = c.id
  WHERE uf.user_id = p_user_id AND c.is_active = true
  ORDER BY uf.created_at DESC
  LIMIT p_page_size OFFSET v_offset;
END //


-- 功能: 更新Top3内容（管理员使用）
CREATE PROCEDURE IF NOT EXISTS api_swipe_set_top3(
  IN p_content_id VARCHAR(36),
  IN p_rank INT
)
BEGIN
  -- 先清除该排名的原有内容
  UPDATE contents SET is_top = false, top_rank = NULL WHERE top_rank = p_rank;
  
  -- 设置新的Top内容
  UPDATE contents SET is_top = true, top_rank = p_rank WHERE id = p_content_id;
END //

DELIMITER ;


-- =========================================================
-- 3. 索引优化 (Index Optimization)
-- =========================================================

-- 优化推荐查询
CREATE INDEX IF NOT EXISTS idx_contents_recommendation 
ON contents (is_active, review_status, like_count DESC, created_at DESC);

-- 优化用户点赞查询
CREATE INDEX IF NOT EXISTS idx_user_likes_user_time 
ON user_likes (user_id, created_at DESC);

-- 优化用户收藏查询
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_time 
ON user_favorites (user_id, created_at DESC);


-- =========================================================
-- 4. 初始化推荐权重配置
-- =========================================================
-- 推荐权重设计建议：
-- 推荐系统的效果依赖权重参数合理分配。建议如下（可根据实际业务场景动态调整）：
--
-- 1. 权重应兼顾用户活跃数据（如点赞、收藏、浏览）及内容新鲜度（recency_decay），保证热门和新上线内容都有曝光机会。
-- 2. 收藏权重通常要高于点赞，因其代表更强偏好。
-- 3. 浏览权重宜低，仅作为辅助。
-- 4. 协同过滤（cf_weight）用于个性化推荐，可通过分析相似用户行为得分，建议初期可设为1.0~2.0，后续结合A/B测试与运营反馈动态调整。
-- 5. 为防止内容垄断，recency_decay要有合理衰减周期，一般7-30天为宜。
-- 6. 其他可扩展权重（如评论、转发等）可后续加入。
--
-- 具体参数建议：

-- like_weight: 点赞权重。1次点赞加1.0分
-- favorite_weight: 收藏权重。1次收藏加2.0分
-- view_weight: 浏览权重。1次浏览加0.1分
-- recency_decay: 内容新鲜度衰减周期30天
-- cf_weight: 协同过滤权重。相似用户行为加成1.5分

INSERT INTO recommendation_weights (id, weight_name, weight_value, description) VALUES
(UUID(), 'like_weight', 1.0, '点赞权重（1次点赞=1分）'),
(UUID(), 'favorite_weight', 2.0, '收藏权重（1次收藏=2分，更高）'),
(UUID(), 'view_weight', 0.1, '浏览权重（1次浏览=0.1分，辅助指标）'),
(UUID(), 'recency_decay', 30.0, '时间衰减因子，单位为天，分数会随内容变旧而下降'),
(UUID(), 'cf_weight', 1.5, '协同过滤权重（基于相似用户行为加分，初始建议1.5，可动态优化）')
ON DUPLICATE KEY UPDATE 
  weight_value = VALUES(weight_value),
  description = VALUES(description);

-- 权重调整方法：
-- 1. 直接更新，比如将点赞权重增大为1.5分：
--    UPDATE recommendation_weights SET weight_value = 1.5 WHERE weight_name = 'like_weight';
-- 2. 如果要恢复默认，可以重新执行本段插入脚本。


-- =========================================================
-- 5. 初始测试数据 (Sample Data)
-- =========================================================

-- 插入示例内容
INSERT INTO contents (id, author_id, image_url, image_code, title, description, like_count, favorite_count, view_count, review_status, is_top, top_rank) VALUES
('content_001', 'user_001', 'https://example.com/images/boss1.png', 'BOSS001', '我的老板是秃头', '画了一个秃头老板', 1520, 320, 5600, 'approved', true, 1),
('content_002', 'user_002', 'https://example.com/images/boss2.png', 'BOSS002', '996福报老板', '加班到深夜的老板', 1280, 280, 4200, 'approved', true, 2),
('content_003', 'user_003', 'https://example.com/images/boss3.png', 'BOSS003', '画饼老板', '总是画大饼的老板', 980, 210, 3100, 'approved', true, 3),
('content_004', 'user_001', 'https://example.com/images/boss4.png', 'BOSS004', '爱开会老板', '天天开会的老板', 650, 150, 2800, 'approved', false, NULL),
('content_005', 'user_004', 'https://example.com/images/boss5.png', 'BOSS005', '甩锅老板', '有问题就甩锅的老板', 520, 120, 2100, 'approved', false, NULL),
('content_006', 'user_002', 'https://example.com/images/boss6.png', 'BOSS006', '微管理老板', '事无巨细都要管的老板', 380, 90, 1500, 'approved', false, NULL)
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 插入内容标签
INSERT INTO content_tags (id, content_id, tag_name) VALUES
(UUID(), 'content_001', '秃头'),
(UUID(), 'content_001', '搞笑'),
(UUID(), 'content_002', '996'),
(UUID(), 'content_002', '加班'),
(UUID(), 'content_003', '画饼'),
(UUID(), 'content_003', '忽悠'),
(UUID(), 'content_004', '开会'),
(UUID(), 'content_005', '甩锅'),
(UUID(), 'content_006', '微管理')
ON DUPLICATE KEY UPDATE tag_name = VALUES(tag_name);

-- 插入示例点赞记录
INSERT INTO user_likes (id, user_id, content_id) VALUES
(UUID(), 'user_001', 'content_002'),
(UUID(), 'user_001', 'content_003'),
(UUID(), 'user_002', 'content_001'),
(UUID(), 'user_003', 'content_001')
ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP;

-- 插入示例收藏记录
INSERT INTO user_favorites (id, user_id, content_id) VALUES
(UUID(), 'user_001', 'content_001'),
(UUID(), 'user_002', 'content_003')
ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP;
