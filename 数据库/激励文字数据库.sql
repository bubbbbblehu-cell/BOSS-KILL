-- BOSS KILL 小游戏数据库初始化脚本
-- 创建激励文字词库相关表结构

-- 激励文字表
CREATE TABLE IF NOT EXISTS motivational_quotes (
  id VARCHAR(36) PRIMARY KEY,
  text TEXT NOT NULL,
  category VARCHAR(20) NOT NULL,
  author VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  usage_count INT DEFAULT 0,
  effectiveness_score DECIMAL(3,2) DEFAULT 0.0,
  is_active BOOLEAN DEFAULT true,
  tags JSON,
  INDEX idx_category (category),
  INDEX idx_is_active (is_active),
  INDEX idx_usage_count (usage_count),
  FULLTEXT INDEX idx_text (text)
);

-- 用户文字使用记录表
CREATE TABLE IF NOT EXISTS user_quote_usage (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  quote_id VARCHAR(36) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_rating INT CHECK (user_rating >= 1 AND user_rating <= 5),
  user_feedback TEXT,
  FOREIGN KEY (quote_id) REFERENCES motivational_quotes(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_quote_id (quote_id),
  INDEX idx_used_at (used_at)
);

-- 文字分类统计表
CREATE TABLE IF NOT EXISTS quote_categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color code
  icon VARCHAR(50),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active),
  INDEX idx_sort_order (sort_order)
);

-- 插入默认分类
INSERT INTO quote_categories (id, name, display_name, description, color, icon, sort_order) VALUES
('cat_motivation', 'motivation', '激励类', '激发斗志的正面激励文字', '#4CAF50', 'trending_up', 1),
('cat_humor', 'humor', '幽默类', '轻松幽默的搞笑文字', '#FF9800', 'sentiment_satisfied', 2),
('cat_inspirational', 'inspirational', '鼓舞类', '富有哲理的鼓舞人心文字', '#2196F3', 'lightbulb', 3),
('cat_sarcastic', 'sarcastic', '讽刺类', '带有讽刺意味的文字', '#F44336', 'mood_bad', 4)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  color = VALUES(color),
  icon = VALUES(icon);

-- 插入初始激励文字数据
INSERT INTO motivational_quotes (id, text, category, author, tags) VALUES
('quote_001', '在最好的青春里，在格子间里激励自己开出最美的花！', 'motivation', '系统', '["青春", "奋斗", "激励"]'),
('quote_002', '工作虽苦，但扔大便的快乐谁懂？', 'humor', '系统', '["幽默", "工作", "快乐"]'),
('quote_003', '996的你，值得一个大大的便便！', 'sarcastic', '系统', '["讽刺", "加班", "释放"]'),
('quote_004', '在格子间里，做一个会扔便便的自由灵魂', 'inspirational', '系统', '["自由", "灵魂", "格子间"]'),
('quote_005', '青春不只是奋斗，还有扔大便的快感', 'motivation', '系统', '["青春", "奋斗", "快感"]'),
('quote_006', '工作压力大？扔个便便释放一下', 'humor', '系统', '["压力", "释放", "幽默"]'),
('quote_007', '在办公室的角落，藏着你的小确幸', 'inspirational', '系统', '["办公室", "确幸", "角落"]'),
('quote_008', '不是加班辛苦，是没扔便便的遗憾', 'sarcastic', '系统', '["加班", "遗憾", "讽刺"]'),
('quote_009', '扔出你的不满，迎接更好的明天', 'motivation', '系统', '["不满", "明天", "迎接"]'),
('quote_010', '便便虽小，快乐无穷', 'humor', '系统', '["快乐", "无穷", "幽默"]'),
('quote_011', '在格子间里，找到属于你的释放方式', 'inspirational', '系统', '["格子间", "释放", "方式"]'),
('quote_012', '工作再累，也要记得扔便便的乐趣', 'motivation', '系统', '["工作", "累", "乐趣"]'),
('quote_013', '青春奋斗路，便便相伴', 'inspirational', '系统', '["青春", "奋斗", "相伴"]'),
('quote_014', '释放压力，从扔便便开始', 'motivation', '系统', '["释放", "压力", "开始"]'),
('quote_015', '在办公室里，做一个快乐的扔便便者', 'humor', '系统', '["办公室", "快乐", "扔便便者"]')
ON DUPLICATE KEY UPDATE
  text = VALUES(text),
  category = VALUES(category),
  tags = VALUES(tags);

-- 创建存储过程：获取随机激励文字
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS get_random_motivational_quote()
BEGIN
  SELECT
    id,
    text,
    category,
    author,
    usage_count,
    effectiveness_score,
    tags
  FROM motivational_quotes
  WHERE is_active = true
  ORDER BY RAND()
  LIMIT 1;
END //
DELIMITER ;

-- 创建存储过程：记录文字使用情况
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS record_quote_usage(
  IN p_user_id VARCHAR(36),
  IN p_quote_id VARCHAR(36),
  IN p_rating INT
)
BEGIN
  -- 插入使用记录
  INSERT INTO user_quote_usage (user_id, quote_id, user_rating)
  VALUES (p_user_id, p_quote_id, p_rating);

  -- 更新文字使用统计
  UPDATE motivational_quotes
  SET usage_count = usage_count + 1
  WHERE id = p_quote_id;
END //
DELIMITER ;

-- 创建存储过程：获取今日推荐文字（避免重复）
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS get_today_recommendation(
  IN p_user_id VARCHAR(36)
)
BEGIN
  SELECT
    mq.id,
    mq.text,
    mq.category,
    mq.author,
    mq.effectiveness_score,
    mq.tags
  FROM motivational_quotes mq
  LEFT JOIN user_quote_usage uqu ON mq.id = uqu.quote_id
    AND uqu.user_id = p_user_id
    AND DATE(uqu.used_at) = CURDATE()
  WHERE mq.is_active = true
    AND uqu.id IS NULL  -- 今日未使用过的文字
  ORDER BY mq.effectiveness_score DESC, mq.usage_count ASC
  LIMIT 1;
END //
DELIMITER ;

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_user_quote_usage_user_date
ON user_quote_usage (user_id, DATE(used_at));

CREATE INDEX IF NOT EXISTS idx_motivational_quotes_effectiveness
ON motivational_quotes (effectiveness_score DESC, usage_count ASC);

-- 初始化数据验证
SELECT
  COUNT(*) as total_quotes,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_quotes,
  COUNT(DISTINCT category) as categories_count
FROM motivational_quotes;