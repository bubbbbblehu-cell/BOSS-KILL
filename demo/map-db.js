// 地图服务数据库模块 - 模拟 MySQL 数据库
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'map.db');
const db = new sqlite3.Database(dbPath);

// 初始化数据库
db.serialize(() => {
  // 大便点表
  db.run(`
    CREATE TABLE IF NOT EXISTS shit_points (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      shit_type TEXT DEFAULT 'normal',
      created_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1,
      tower_id TEXT
    )
  `);

  // 屎塔表
  db.run(`
    CREATE TABLE IF NOT EXISTS shit_towers (
      id TEXT PRIMARY KEY,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      shit_count INTEGER DEFAULT 0,
      height REAL DEFAULT 0.0,
      level INTEGER DEFAULT 1,
      occupied_building_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'active'
    )
  `);

  // 建筑表
  db.run(`
    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      building_type TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      is_occupied INTEGER DEFAULT 0,
      occupied_tower_id TEXT,
      importance_level INTEGER DEFAULT 1
    )
  `);

  // 插入示例建筑
  const buildings = [
    ['bld_001', '阿里巴巴总部', 'office', 30.2741, 120.0261, 10],
    ['bld_002', '腾讯大厦', 'office', 22.5431, 114.0579, 10],
    ['bld_003', '字节跳动大厦', 'office', 40.0020, 116.4877, 9],
    ['bld_004', '百度大厦', 'office', 40.0566, 116.3072, 9],
    ['bld_005', '华为研发中心', 'office', 22.6505, 114.0579, 8],
  ];
  const stmtB = db.prepare('INSERT OR IGNORE INTO buildings (id, name, building_type, latitude, longitude, importance_level) VALUES (?, ?, ?, ?, ?, ?)');
  buildings.forEach(b => stmtB.run(b));
  stmtB.finalize();

  // 插入示例大便点（模拟接近1000个的情况）
  const shitPoints = [];
  for (let i = 1; i <= 50; i++) {
    shitPoints.push([
      `sp_${String(i).padStart(3, '0')}`,
      `user_${(i % 5) + 1}`,
      30.2741 + (Math.random() - 0.5) * 0.002,
      120.0261 + (Math.random() - 0.5) * 0.002,
      ['normal', 'golden', 'rainbow'][i % 3]
    ]);
  }
  const stmtS = db.prepare('INSERT OR IGNORE INTO shit_points (id, user_id, latitude, longitude, shit_type) VALUES (?, ?, ?, ?, ?)');
  shitPoints.forEach(s => stmtS.run(s));
  stmtS.finalize();
});

// Haversine 公式计算距离
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// API: 获取附近大便点
function getNearbyShitPoints(latitude, longitude, radiusKm, userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, user_id, latitude, longitude, shit_type, created_at,
              (user_id = ?) as is_own
       FROM shit_points WHERE is_active = 1`,
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        const filtered = rows.filter(row => {
          const dist = haversineDistance(latitude, longitude, row.latitude, row.longitude);
          row.distance_km = dist;
          return dist <= radiusKm;
        }).sort((a, b) => {
          if (a.is_own !== b.is_own) return b.is_own - a.is_own;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        resolve(filtered);
      }
    );
  });
}

// API: 添加新的大便点
function addShitPoint(userId, latitude, longitude, shitType) {
  return new Promise((resolve, reject) => {
    const shitId = `sp_${Date.now()}`;
    db.run(
      'INSERT INTO shit_points (id, user_id, latitude, longitude, shit_type) VALUES (?, ?, ?, ?, ?)',
      [shitId, userId, latitude, longitude, shitType],
      function(err) {
        if (err) return reject(err);
        // 检查是否达到屎塔阈值
        db.get(
          `SELECT COUNT(*) as count FROM shit_points 
           WHERE is_active = 1 
           AND ABS(latitude - ?) < 0.001 
           AND ABS(longitude - ?) < 0.001`,
          [latitude, longitude],
          (err, row) => {
            if (err) return reject(err);
            resolve({
              shitId,
              currentCount: row.count,
              towerFormed: row.count >= 1000
            });
          }
        );
      }
    );
  });
}

// API: 获取附近屎塔
function getNearbyTowers(latitude, longitude, radiusKm) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT t.*, b.name as building_name, b.building_type
       FROM shit_towers t
       LEFT JOIN buildings b ON t.occupied_building_id = b.id
       WHERE t.status = 'active'`,
      (err, rows) => {
        if (err) return reject(err);
        const filtered = rows.filter(row => {
          const dist = haversineDistance(latitude, longitude, row.latitude, row.longitude);
          row.distance_km = dist;
          return dist <= radiusKm;
        });
        resolve(filtered);
      }
    );
  });
}

// API: 获取全局地图数据
function getGlobalMapData() {
  return new Promise((resolve, reject) => {
    const data = {};
    db.get('SELECT COUNT(*) as count FROM shit_points WHERE is_active = 1', (err, row) => {
      if (err) return reject(err);
      data.total_shit_points = row.count;
      
      db.get('SELECT COUNT(*) as count FROM shit_towers WHERE status = "active"', (err, row) => {
        if (err) return reject(err);
        data.total_towers = row.count;
        
        db.get('SELECT COUNT(*) as count FROM buildings WHERE is_occupied = 1', (err, row) => {
          if (err) return reject(err);
          data.total_occupied_buildings = row.count;
          
          db.all('SELECT * FROM shit_towers WHERE status = "active" ORDER BY shit_count DESC LIMIT 10', (err, rows) => {
            if (err) return reject(err);
            data.top_towers = rows;
            data.updated_at = new Date().toISOString();
            resolve(data);
          });
        });
      });
    });
  });
}

// API: 获取被占领建筑
function getOccupiedBuildings() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT b.*, t.shit_count, t.height, t.level
       FROM buildings b
       INNER JOIN shit_towers t ON b.occupied_tower_id = t.id
       WHERE b.is_occupied = 1 AND t.status = 'active'
       ORDER BY b.importance_level DESC`,
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

// API: 创建屎塔
function createShitTower(latitude, longitude) {
  return new Promise((resolve, reject) => {
    const towerId = `tower_${Date.now()}`;
    
    // 统计大便数量
    db.get(
      `SELECT COUNT(*) as count FROM shit_points 
       WHERE is_active = 1 
       AND ABS(latitude - ?) < 0.001 
       AND ABS(longitude - ?) < 0.001`,
      [latitude, longitude],
      (err, row) => {
        if (err) return reject(err);
        const shitCount = row.count;
        const height = shitCount / 100.0;
        
        // 查找最近的可占领建筑
        db.get(
          `SELECT id, name FROM buildings WHERE is_occupied = 0 ORDER BY importance_level DESC LIMIT 1`,
          (err, building) => {
            if (err) return reject(err);
            
            const buildingId = building ? building.id : null;
            
            // 创建屎塔
            db.run(
              'INSERT INTO shit_towers (id, latitude, longitude, shit_count, height, occupied_building_id) VALUES (?, ?, ?, ?, ?, ?)',
              [towerId, latitude, longitude, shitCount, height, buildingId],
              function(err) {
                if (err) return reject(err);
                
                // 标记大便点已合并
                db.run(
                  `UPDATE shit_points SET is_active = 0, tower_id = ? 
                   WHERE is_active = 1 
                   AND ABS(latitude - ?) < 0.001 
                   AND ABS(longitude - ?) < 0.001`,
                  [towerId, latitude, longitude]
                );
                
                // 更新建筑占领状态
                if (buildingId) {
                  db.run(
                    'UPDATE buildings SET is_occupied = 1, occupied_tower_id = ? WHERE id = ?',
                    [towerId, buildingId]
                  );
                }
                
                resolve({
                  towerId,
                  shitCount,
                  height,
                  occupiedBuilding: building ? building.name : null
                });
              }
            );
          }
        );
      }
    );
  });
}

module.exports = {
  db,
  getNearbyShitPoints,
  addShitPoint,
  getNearbyTowers,
  getGlobalMapData,
  getOccupiedBuildings,
  createShitTower
};
