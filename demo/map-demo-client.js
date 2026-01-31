// 地图服务前端调用演示 - 模拟 Flutter MapService
const http = require('http');

const API_BASE = 'http://localhost:3001';

// HTTP 请求封装
function httpRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// ============================================================
// 模拟 MapService 类
// ============================================================
class MapService {
  // 获取附近大便分布
  async getNearbyShitPoints(latitude, longitude, radiusKm, userId) {
    const path = `/api/map/shit-points?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}&user_id=${userId}`;
    return await httpRequest('GET', path);
  }

  // 添加新的大便点
  async addShitPoint(userId, latitude, longitude, shitType) {
    return await httpRequest('POST', '/api/map/shit-points', {
      user_id: userId,
      latitude,
      longitude,
      shit_type: shitType
    });
  }

  // 获取全局地图数据
  async getGlobalMapData() {
    return await httpRequest('GET', '/api/map/global');
  }

  // 获取附近屎塔
  async getNearbyTowers(latitude, longitude, radiusKm) {
    const path = `/api/map/towers?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}`;
    return await httpRequest('GET', path);
  }

  // 获取被占领建筑
  async getOccupiedBuildings() {
    return await httpRequest('GET', '/api/map/buildings/occupied');
  }
}

// ============================================================
// 演示流程
// ============================================================
async function runMapServiceDemo() {
  const mapService = new MapService();
  
  // 模拟用户位置（阿里巴巴总部附近）
  const userLocation = { latitude: 30.2741, longitude: 120.0261 };
  const userId = 'user_001';

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          BOSS KILL 地图服务 - 完整流程演示                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // ========== 流程1: 地图数据加载 ==========
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📍 流程1: 地图数据加载');
  console.log('═══════════════════════════════════════════════════════════');
  
  console.log(`\n🌍 用户位置: (${userLocation.latitude}, ${userLocation.longitude})`);
  console.log('   → 阿里巴巴总部附近\n');

  // 步骤1: 获取附近大便分布
  console.log('📤 步骤1: 调用 getNearbyShitPoints()');
  console.log('   → GET /api/map/shit-points');
  const shitPointsResult = await mapService.getNearbyShitPoints(
    userLocation.latitude,
    userLocation.longitude,
    5, // 5公里范围
    userId
  );
  const shitPoints = shitPointsResult.data || [];
  console.log(`   ✅ 获取到 ${shitPoints.length} 个大便点`);
  if (shitPoints.length > 0) {
    console.log('   📊 示例数据:');
    shitPoints.slice(0, 3).forEach(p => {
      console.log(`      - ${p.id}: (${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}) ${p.shit_type} ${p.is_own ? '👤本人' : ''}`);
    });
  }

  await sleep(500);

  // 步骤2: 获取附近屎塔
  console.log('\n📤 步骤2: 调用 getNearbyTowers()');
  console.log('   → GET /api/map/towers');
  const towersResult = await mapService.getNearbyTowers(
    userLocation.latitude,
    userLocation.longitude,
    10
  );
  const towers = towersResult.data || [];
  console.log(`   ✅ 获取到 ${towers.length} 个屎塔`);

  await sleep(500);

  // 步骤3: 获取全局地图数据
  console.log('\n📤 步骤3: 调用 getGlobalMapData()');
  console.log('   → GET /api/map/global');
  const globalData = await mapService.getGlobalMapData();
  const gd = globalData.data || {};
  console.log('   ✅ 全局统计数据:');
  console.log(`      - 总大便点数: ${gd.total_shit_points || 0}`);
  console.log(`      - 总屎塔数: ${gd.total_towers || 0}`);
  console.log(`      - 被占领建筑: ${gd.total_occupied_buildings || 0}`);

  await sleep(1000);

  // ========== 流程2: 扔大便流程 ==========
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💩 流程2: 扔大便流程');
  console.log('═══════════════════════════════════════════════════════════');

  // 步骤1: 用户点击扔大便
  console.log('\n👆 用户点击扔大便按钮...');
  
  // 步骤2: 调用 addShitPoint
  const newShitLocation = {
    latitude: userLocation.latitude + 0.0005,
    longitude: userLocation.longitude + 0.0005
  };
  
  console.log('\n📤 步骤1: 调用 addShitPoint()');
  console.log('   → POST /api/map/shit-points');
  console.log(`   → 位置: (${newShitLocation.latitude.toFixed(4)}, ${newShitLocation.longitude.toFixed(4)})`);
  
  const addResult = await mapService.addShitPoint(
    userId,
    newShitLocation.latitude,
    newShitLocation.longitude,
    'golden'
  );
  
  console.log(`   ✅ 大便点添加成功: ${addResult.data.shitId}`);
  console.log(`   📊 该位置当前大便数量: ${addResult.data.currentCount}`);
  
  // 步骤3: 检查是否生成屎塔
  if (addResult.data.towerFormed) {
    console.log('\n   🎉 达到1000个阈值！自动生成屎塔！');
    console.log(`   🏰 屎塔ID: ${addResult.data.tower.towerId}`);
    console.log(`   📏 高度: ${addResult.data.tower.height}米`);
    console.log(`   🏢 占领建筑: ${addResult.data.tower.occupiedBuilding || '无'}`);
  } else {
    console.log(`\n   📈 距离生成屎塔还需要: ${1000 - addResult.data.currentCount} 个大便`);
  }

  await sleep(1000);

  // ========== 流程3: 查看被占领建筑 ==========
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🏢 流程3: 查看被占领建筑');
  console.log('═══════════════════════════════════════════════════════════');

  console.log('\n📤 调用 getOccupiedBuildings()');
  console.log('   → GET /api/map/buildings/occupied');
  
  const occupiedResult = await mapService.getOccupiedBuildings();
  console.log(`   ✅ 获取到 ${occupiedResult.total} 个被占领建筑`);
  
  if (occupiedResult.data.length > 0) {
    console.log('   🏢 被占领建筑列表:');
    occupiedResult.data.forEach(b => {
      console.log(`      - ${b.name} (${b.building_type})`);
      console.log(`        屎塔高度: ${b.height}米, 大便数: ${b.shit_count}`);
    });
  } else {
    console.log('   📝 暂无被占领的建筑');
  }

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ 地图服务演示完成！');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行演示
runMapServiceDemo().catch(console.error);
