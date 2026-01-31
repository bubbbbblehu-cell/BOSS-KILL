// 地图服务 Node.js API 服务
const express = require('express');
const cors = require('cors');
const mapDb = require('./map-db');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ============================================================
// API: GET /api/map/shit-points
// 功能: 获取附近大便分布
// ============================================================
app.get('/api/map/shit-points', async (req, res) => {
  const { latitude, longitude, radius_km, user_id } = req.query;
  console.log('\n📥 GET /api/map/shit-points');
  console.log(`   位置: (${latitude}, ${longitude}), 半径: ${radius_km}km, 用户: ${user_id}`);
  
  try {
    const points = await mapDb.getNearbyShitPoints(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius_km),
      user_id
    );
    console.log(`   ✅ 返回 ${points.length} 个大便点`);
    res.json({ success: true, data: points, total: points.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// API: POST /api/map/shit-points
// 功能: 添加新的大便点
// ============================================================
app.post('/api/map/shit-points', async (req, res) => {
  const { user_id, latitude, longitude, shit_type } = req.body;
  console.log('\n📥 POST /api/map/shit-points');
  console.log(`   用户: ${user_id}, 位置: (${latitude}, ${longitude}), 类型: ${shit_type}`);
  
  try {
    const result = await mapDb.addShitPoint(user_id, latitude, longitude, shit_type);
    console.log(`   ✅ 新增大便点: ${result.shitId}`);
    console.log(`   📊 该位置当前大便数量: ${result.currentCount}`);
    
    if (result.towerFormed) {
      console.log('   🏰 达到阈值！自动生成屎塔...');
      const tower = await mapDb.createShitTower(latitude, longitude);
      result.tower = tower;
      console.log(`   🎉 屎塔生成成功: ${tower.towerId}, 高度: ${tower.height}米`);
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// API: GET /api/map/global
// 功能: 获取全局地图数据
// ============================================================
app.get('/api/map/global', async (req, res) => {
  console.log('\n📥 GET /api/map/global');
  
  try {
    const data = await mapDb.getGlobalMapData();
    console.log(`   ✅ 全局数据: ${data.total_shit_points} 大便点, ${data.total_towers} 屎塔`);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// API: GET /api/map/towers
// 功能: 获取附近屎塔
// ============================================================
app.get('/api/map/towers', async (req, res) => {
  const { latitude, longitude, radius_km } = req.query;
  console.log('\n📥 GET /api/map/towers');
  
  try {
    const towers = await mapDb.getNearbyTowers(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius_km)
    );
    console.log(`   ✅ 返回 ${towers.length} 个屎塔`);
    res.json({ success: true, data: towers, total: towers.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// API: POST /api/map/towers
// 功能: 手动生成屎塔
// ============================================================
app.post('/api/map/towers', async (req, res) => {
  const { latitude, longitude } = req.body;
  console.log('\n📥 POST /api/map/towers');
  
  try {
    const tower = await mapDb.createShitTower(latitude, longitude);
    console.log(`   ✅ 屎塔生成: ${tower.towerId}, 高度: ${tower.height}米`);
    res.json({ success: true, data: tower });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// API: GET /api/map/buildings/occupied
// 功能: 获取被占领建筑
// ============================================================
app.get('/api/map/buildings/occupied', async (req, res) => {
  console.log('\n📥 GET /api/map/buildings/occupied');
  
  try {
    const buildings = await mapDb.getOccupiedBuildings();
    console.log(`   ✅ 返回 ${buildings.length} 个被占领建筑`);
    res.json({ success: true, data: buildings, total: buildings.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        BOSS KILL 地图服务 API 已启动                       ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 服务地址: http://localhost:${PORT}                       ║`);
  console.log('║                                                           ║');
  console.log('║  📚 可用接口:                                              ║');
  console.log('║    GET  /api/map/shit-points      - 获取附近大便分布        ║');
  console.log('║    POST /api/map/shit-points      - 添加新的大便点          ║');
  console.log('║    GET  /api/map/global           - 获取全局地图数据        ║');
  console.log('║    GET  /api/map/towers           - 获取附近屎塔            ║');
  console.log('║    POST /api/map/towers           - 生成屎塔               ║');
  console.log('║    GET  /api/map/buildings/occupied - 获取被占领建筑        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
});
