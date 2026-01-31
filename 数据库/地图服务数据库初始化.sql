-- BOSS KILL 小游戏数据库初始化脚本 - 地图服务
-- 创建地图、大便点、屎塔相关的表结构及API逻辑

-- =========================================================
-- 1. 表结构定义 (Table Definitions)
-- =========================================================

-- 大便点表 (shit_points)
-- 存储用户扔出的每一个大便位置
CREATE TABLE IF NOT EXISTS shit_points (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  
  -- 位置信息
  latitude DECIMAL(10, 8) NOT NULL,  -- 纬度
  longitude DECIMAL(11, 8) NOT NULL, -- 经度
  
  -- 大便属性
  shit_type VARCHAR(20) DEFAULT 'normal', -- normal, golden, rainbow, special
  
  -- 时间信息
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 状态
  is_active BOOLEAN DEFAULT true, -- 是否有效（被合并到屎塔后可能标记为false）
  tower_id VARCHAR(36), -- 如果被合并到屎塔，记录屎塔ID
  
  INDEX idx_user_id (user_id),
  INDEX idx_location (latitude, longitude),
  INDEX idx_created_at (created_at),
  INDEX idx_is_active (is_active),
  
  -- 地理位置索引（MySQL 8.0+）
  SPATIAL INDEX idx_geo_point (POINT(longitude, latitude))
);

-- 屎塔表 (shit_towers)
-- 当某个位置大便数量达到阈值，生成屎塔
CREATE TABLE IF NOT EXISTS shit_towers (
  id VARCHAR(36) PRIMARY KEY,
  
  -- 位置信息
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  
  -- 屎塔属性
  shit_count INT NOT NULL DEFAULT 0, -- 组成屎塔的大便数量
  height DECIMAL(10, 2) DEFAULT 0.0, -- 屎塔高度（米）
  level INT DEFAULT 1, -- 屎塔等级
  
  -- 占领建筑
  occupied_building_id VARCHAR(36), -- 占领的建筑ID
  
  -- 时间信息
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active', -- active, destroyed, merged
  
  INDEX idx_location (latitude, longitude),
  INDEX idx_status (status),
  INDEX idx_shit_count (shit_count DESC)
);

-- 屎塔贡献者表 (tower_contributors)
-- 记录每个屎塔的贡献者
CREATE TABLE IF NOT EXISTS tower_contributors (
  id VARCHAR(36) PRIMARY KEY,
  tower_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  contribution_count INT DEFAULT 1, -- 贡献的大便数量
  first_contribution_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_contribution_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tower_id) REFERENCES shit_towers(id) ON DELETE CASCADE,
  UNIQUE KEY uk_tower_user (tower_id, user_id),
  INDEX idx_user_id (user_id)
);

-- 建筑表 (buildings)
-- 存储可被屎塔占领的城市建筑
CREATE TABLE IF NOT EXISTS buildings (
  id VARCHAR(36) PRIMARY KEY,
  
  -- 建筑信息
  name VARCHAR(255) NOT NULL,
  building_type VARCHAR(50), -- office, mall, landmark, government, etc.
  address TEXT,
  
  -- 位置信息
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  
  -- 占领状态
  is_occupied BOOLEAN DEFAULT false,
  occupied_tower_id VARCHAR(36),
  occupied_at TIMESTAMP,
  
  -- 元数据
  importance_level INT DEFAULT 1, -- 建筑重要程度 1-10
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_location (latitude, longitude),
  INDEX idx_is_occupied (is_occupied),
  INDEX idx_building_type (building_type)
);

-- 地图缓存表 (map_cache)
-- 存储整体地图数据的缓存（24小时更新）
CREATE TABLE IF NOT EXISTS map_cache (
  id VARCHAR(36) PRIMARY KEY,
  cache_key VARCHAR(100) UNIQUE NOT NULL, -- 如 'global_map', 'region_xxx'
  cache_data JSON NOT NULL, -- 缓存的地图数据
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  
  INDEX idx_cache_key (cache_key),
  INDEX idx_expires_at (expires_at)
);


-- =========================================================
-- 2. API逻辑的存储过程 (Stored Procedures for API Logic)
-- =========================================================

DELIMITER //

-- API: GET /api/map/shit-points
-- 功能: 获取指定区域内的大便分布 (getNearbyShitPoints)
-- 参数: 中心点坐标、半径、用户ID
CREATE PROCEDURE IF NOT EXISTS api_map_get_nearby_shit_points(
  IN p_latitude DECIMAL(10, 8),
  IN p_longitude DECIMAL(11, 8),
  IN p_radius_km DECIMAL(10, 2),
  IN p_user_id VARCHAR(36)
)
BEGIN
  -- 使用 Haversine 公式计算距离，获取半径范围内的大便点
  SELECT 
    id, user_id, latitude, longitude, shit_type, created_at,
    (user_id = p_user_id) AS is_own,
    (
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(latitude)) *
        cos(radians(longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(latitude))
      )
    ) AS distance_km
  FROM shit_points
  WHERE is_active = true
    AND (
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(latitude)) *
        cos(radians(longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(latitude))
      )
    ) <= p_radius_km
  ORDER BY 
    (user_id = p_user_id) DESC, -- 本人的排前面
    created_at DESC
  LIMIT 1000;
END //


-- API: POST /api/map/shit-points
-- 功能: 添加新的大便点 (addShitPoint)
CREATE PROCEDURE IF NOT EXISTS api_map_add_shit_point(
  IN p_user_id VARCHAR(36),
  IN p_latitude DECIMAL(10, 8),
  IN p_longitude DECIMAL(11, 8),
  IN p_shit_type VARCHAR(20),
  OUT p_shit_id VARCHAR(36),
  OUT p_tower_formed BOOLEAN
)
BEGIN
  DECLARE v_location_count INT;
  DECLARE v_tower_threshold INT DEFAULT 1000;
  
  -- 1. 生成ID并插入新的大便点
  SET p_shit_id = UUID();
  INSERT INTO shit_points (id, user_id, latitude, longitude, shit_type)
  VALUES (p_shit_id, p_user_id, p_latitude, p_longitude, p_shit_type);
  
  -- 2. 检查该位置是否达到屎塔生成阈值
  -- 使用一定精度范围（约100米）来聚合同一位置
  SELECT COUNT(*) INTO v_location_count
  FROM shit_points
  WHERE is_active = true
    AND ABS(latitude - p_latitude) < 0.001
    AND ABS(longitude - p_longitude) < 0.001;
  
  -- 3. 判断是否需要生成屎塔
  SET p_tower_formed = (v_location_count >= v_tower_threshold);
END //


-- API: POST /api/map/towers
-- 功能: 生成屎塔 (createShitTower)
CREATE PROCEDURE IF NOT EXISTS api_map_create_shit_tower(
  IN p_latitude DECIMAL(10, 8),
  IN p_longitude DECIMAL(11, 8),
  OUT p_tower_id VARCHAR(36)
)
BEGIN
  DECLARE v_shit_count INT;
  DECLARE v_height DECIMAL(10, 2);
  DECLARE v_building_id VARCHAR(36);
  
  -- 1. 统计该位置的大便数量
  SELECT COUNT(*) INTO v_shit_count
  FROM shit_points
  WHERE is_active = true
    AND ABS(latitude - p_latitude) < 0.001
    AND ABS(longitude - p_longitude) < 0.001;
  
  -- 2. 计算屎塔高度（每100个大便增加1米）
  SET v_height = v_shit_count / 100.0;
  
  -- 3. 查找最近的可占领建筑
  SELECT id INTO v_building_id
  FROM buildings
  WHERE is_occupied = false
    AND (
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(latitude)) *
        cos(radians(longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(latitude))
      )
    ) <= 0.5 -- 500米范围内
  ORDER BY importance_level DESC
  LIMIT 1;
  
  -- 4. 创建屎塔
  SET p_tower_id = UUID();
  INSERT INTO shit_towers (id, latitude, longitude, shit_count, height, occupied_building_id)
  VALUES (p_tower_id, p_latitude, p_longitude, v_shit_count, v_height, v_building_id);
  
  -- 5. 标记相关大便点已被合并
  UPDATE shit_points
  SET is_active = false, tower_id = p_tower_id
  WHERE is_active = true
    AND ABS(latitude - p_latitude) < 0.001
    AND ABS(longitude - p_longitude) < 0.001;
  
  -- 6. 记录贡献者
  INSERT INTO tower_contributors (id, tower_id, user_id, contribution_count)
  SELECT UUID(), p_tower_id, user_id, COUNT(*)
  FROM shit_points
  WHERE tower_id = p_tower_id
  GROUP BY user_id;
  
  -- 7. 更新建筑占领状态
  IF v_building_id IS NOT NULL THEN
    UPDATE buildings
    SET is_occupied = true, occupied_tower_id = p_tower_id, occupied_at = CURRENT_TIMESTAMP
    WHERE id = v_building_id;
  END IF;
END //


-- API: GET /api/map/towers
-- 功能: 获取指定区域内的屎塔
CREATE PROCEDURE IF NOT EXISTS api_map_get_nearby_towers(
  IN p_latitude DECIMAL(10, 8),
  IN p_longitude DECIMAL(11, 8),
  IN p_radius_km DECIMAL(10, 2)
)
BEGIN
  SELECT 
    t.id, t.latitude, t.longitude, t.shit_count, t.height, t.level, t.status,
    b.id AS building_id, b.name AS building_name, b.building_type,
    (
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(t.latitude)) *
        cos(radians(t.longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(t.latitude))
      )
    ) AS distance_km
  FROM shit_towers t
  LEFT JOIN buildings b ON t.occupied_building_id = b.id
  WHERE t.status = 'active'
    AND (
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(t.latitude)) *
        cos(radians(t.longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(t.latitude))
      )
    ) <= p_radius_km
  ORDER BY t.shit_count DESC;
END //


-- API: GET /api/map/global
-- 功能: 获取全局地图数据（24小时缓存）
CREATE PROCEDURE IF NOT EXISTS api_map_get_global_data()
BEGIN
  DECLARE v_cache_exists INT;
  
  -- 检查缓存是否存在且未过期
  SELECT COUNT(*) INTO v_cache_exists
  FROM map_cache
  WHERE cache_key = 'global_map'
    AND expires_at > CURRENT_TIMESTAMP;
  
  IF v_cache_exists > 0 THEN
    -- 返回缓存数据
    SELECT cache_data FROM map_cache WHERE cache_key = 'global_map';
  ELSE
    -- 返回实时统计数据
    SELECT JSON_OBJECT(
      'total_shit_points', (SELECT COUNT(*) FROM shit_points WHERE is_active = true),
      'total_towers', (SELECT COUNT(*) FROM shit_towers WHERE status = 'active'),
      'total_occupied_buildings', (SELECT COUNT(*) FROM buildings WHERE is_occupied = true),
      'top_towers', (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', id,
          'latitude', latitude,
          'longitude', longitude,
          'shit_count', shit_count,
          'height', height
        ))
        FROM (SELECT * FROM shit_towers WHERE status = 'active' ORDER BY shit_count DESC LIMIT 10) t
      ),
      'updated_at', CURRENT_TIMESTAMP
    ) AS cache_data;
  END IF;
END //


-- API: GET /api/map/buildings/occupied
-- 功能: 获取被屎塔占领的建筑列表
CREATE PROCEDURE IF NOT EXISTS api_map_get_occupied_buildings()
BEGIN
  SELECT 
    b.id, b.name, b.building_type, b.address,
    b.latitude, b.longitude, b.importance_level,
    b.occupied_at,
    t.id AS tower_id, t.shit_count, t.height, t.level
  FROM buildings b
  INNER JOIN shit_towers t ON b.occupied_tower_id = t.id
  WHERE b.is_occupied = true
    AND t.status = 'active'
  ORDER BY b.importance_level DESC, t.shit_count DESC;
END //


-- 功能: 检查是否可以生成屎塔 (shouldFormShitTower)
-- 规则：同一位置大便数量 >= 1000
CREATE PROCEDURE IF NOT EXISTS api_map_check_tower_formation(
  IN p_latitude DECIMAL(10, 8),
  IN p_longitude DECIMAL(11, 8),
  OUT p_can_form BOOLEAN,
  OUT p_current_count INT
)
BEGIN
  SELECT COUNT(*) INTO p_current_count
  FROM shit_points
  WHERE is_active = true
    AND ABS(latitude - p_latitude) < 0.001
    AND ABS(longitude - p_longitude) < 0.001;
  
  SET p_can_form = (p_current_count >= 1000);
END //

DELIMITER ;


-- =========================================================
-- 3. 索引优化 (Index Optimization)
-- =========================================================

-- 优化地理位置查询
CREATE INDEX IF NOT EXISTS idx_shit_points_geo 
ON shit_points (latitude, longitude, is_active);

-- 优化屎塔地理位置查询
CREATE INDEX IF NOT EXISTS idx_towers_geo 
ON shit_towers (latitude, longitude, status);

-- 优化用户大便查询（用于实时同步本人数据）
CREATE INDEX IF NOT EXISTS idx_shit_points_user_active 
ON shit_points (user_id, is_active, created_at DESC);


-- =========================================================
-- 4. 初始测试数据 (Sample Data)
-- =========================================================

-- 插入一些示例建筑
INSERT INTO buildings (id, name, building_type, latitude, longitude, importance_level) VALUES
('bld_001', '阿里巴巴总部', 'office', 30.2741, 120.0261, 10),
('bld_002', '腾讯大厦', 'office', 22.5431, 114.0579, 10),
('bld_003', '字节跳动大厦', 'office', 40.0020, 116.4877, 9),
('bld_004', '百度大厦', 'office', 40.0566, 116.3072, 9),
('bld_005', '华为研发中心', 'office', 22.6505, 114.0579, 8)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 插入一些示例大便点
INSERT INTO shit_points (id, user_id, latitude, longitude, shit_type) VALUES
('sp_001', 'user_001', 30.2742, 120.0262, 'normal'),
('sp_002', 'user_002', 30.2743, 120.0263, 'golden'),
('sp_003', 'user_001', 22.5432, 114.0580, 'normal'),
('sp_004', 'user_003', 40.0021, 116.4878, 'rainbow')
ON DUPLICATE KEY UPDATE shit_type = VALUES(shit_type);
