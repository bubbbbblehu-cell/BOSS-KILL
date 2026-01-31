/**
 * 绘图服务 Demo 客户端
 * 模拟前端调用绘图服务API
 * 
 * 运行: node drawing-demo-client.js
 */

const http = require('http');

const API_BASE = 'http://localhost:3006';

// HTTP请求工具
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// 主演示流程
async function runDemo() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎨 绘图服务 (DrawingService) 演示');
  console.log('═══════════════════════════════════════════════════════\n');

  const userId = 'demo_user_001';
  const newUserId = 'demo_user_002';

  // ==========================================
  // 1. 贴纸功能演示
  // ==========================================
  console.log('📌 【1. 贴纸功能演示】\n');
  
  // 1.1 获取贴纸分类
  console.log('1.1 获取贴纸分类...');
  const categoriesRes = await request('GET', '/api/stickers/categories');
  if (categoriesRes.success) {
    console.log('贴纸分类:');
    categoriesRes.categories.forEach(cat => {
      console.log(`  ${cat.icon} ${cat.display_name} (${cat.sticker_count}个贴纸)`);
    });
  }
  console.log('');

  // 1.2 获取老板系列贴纸
  console.log('1.2 获取老板系列贴纸...');
  const bossStickersRes = await request('GET', `/api/stickers?user_id=${userId}&category_id=cat_boss`);
  if (bossStickersRes.success) {
    console.log('老板系列贴纸:');
    bossStickersRes.stickers.forEach(s => {
      const lockStatus = s.is_unlocked ? '🔓 已解锁' : `🔒 ${s.unlock_type === 'points' ? `需${s.unlock_value}积分` : s.unlock_type}`;
      const premium = s.is_premium ? '⭐' : '';
      console.log(`  ${premium}${s.name} - ${lockStatus}`);
    });
  }
  console.log('');

  // 1.3 查看用户积分
  console.log('1.3 查看用户积分...');
  const pointsRes = await request('GET', `/api/users/${userId}/points`);
  console.log(`用户 ${userId} 当前积分: ${pointsRes.available_points}`);
  console.log('');

  // 1.4 解锁付费贴纸
  console.log('1.4 尝试解锁付费贴纸 "眼镜老板" (需50积分)...');
  const unlockRes = await request('POST', '/api/stickers/unlock', {
    user_id: userId,
    sticker_id: 'sticker_004'
  });
  console.log(`结果: ${unlockRes.message}`);
  if (unlockRes.success) {
    console.log(`  消费积分: ${unlockRes.points_spent}`);
    console.log(`  剩余积分: ${unlockRes.remaining_points}`);
  }
  console.log('');

  // 1.5 尝试积分不足的解锁
  console.log('1.5 用户2尝试解锁高级贴纸 "彩虹便便" (需500积分)...');
  const unlockFailRes = await request('POST', '/api/stickers/unlock', {
    user_id: newUserId,
    sticker_id: 'sticker_203'
  });
  console.log(`结果: ${unlockFailRes.message}`);
  console.log('');

  // ==========================================
  // 2. 标签功能演示
  // ==========================================
  console.log('═══════════════════════════════════════════════════════');
  console.log('📌 【2. 标签功能演示】\n');

  // 2.1 获取所有标签
  console.log('2.1 获取所有标签...');
  const allTagsRes = await request('GET', '/api/tags');
  if (allTagsRes.success) {
    const tagsByCategory = {};
    allTagsRes.tags.forEach(t => {
      if (!tagsByCategory[t.category]) tagsByCategory[t.category] = [];
      tagsByCategory[t.category].push(t);
    });
    
    Object.entries(tagsByCategory).forEach(([cat, tags]) => {
      const tagNames = tags.map(t => t.display_name).join(', ');
      console.log(`  ${cat}: ${tagNames}`);
    });
  }
  console.log('');

  // 2.2 获取老板类型标签
  console.log('2.2 获取老板类型标签...');
  const bossTagsRes = await request('GET', '/api/tags?category=boss_type');
  if (bossTagsRes.success) {
    console.log('老板类型标签:');
    bossTagsRes.tags.forEach(t => {
      console.log(`  - ${t.display_name} (使用${t.usage_count}次)`);
    });
  }
  console.log('');

  // ==========================================
  // 3. 绘画作品流程演示
  // ==========================================
  console.log('═══════════════════════════════════════════════════════');
  console.log('📌 【3. 绘画作品流程演示】\n');

  // 3.1 保存新绘画作品
  console.log('3.1 保存新绘画作品...');
  const saveRes = await request('POST', '/api/drawings', {
    user_id: userId,
    title: '我的996老板',
    description: '画了一个每天让我加班的老板',
    image_url: '/uploads/user_drawing_001.png',
    thumbnail_url: '/uploads/user_drawing_001_thumb.png',
    canvas_width: 800,
    canvas_height: 600
  });
  
  if (saveRes.success) {
    console.log(`作品保存成功!`);
    console.log(`  作品ID: ${saveRes.drawing_id}`);
    console.log(`  图像编号: ${saveRes.image_code}`);
    console.log('');

    const newDrawingId = saveRes.drawing_id;

    // 3.2 为作品添加标签
    console.log('3.2 为作品添加标签...');
    const tagRes = await request('POST', `/api/drawings/${newDrawingId}/tags`, {
      tags: ['996_boss', 'tired', 'sarcastic']
    });
    console.log(`结果: ${tagRes.message} (${tagRes.tags_count}个标签)`);
    console.log('');

    // 3.3 提交作品审核
    console.log('3.3 提交作品审核...');
    const submitRes = await request('POST', `/api/drawings/${newDrawingId}/submit`, {
      user_id: userId
    });
    console.log(`审核结果: ${submitRes.review_status}`);
    console.log(`消息: ${submitRes.message}`);
    console.log('');

    // 3.4 获取作品详情
    console.log('3.4 获取作品详情...');
    const detailRes = await request('GET', `/api/drawings/${newDrawingId}?viewer_id=${newUserId}`);
    if (detailRes.success) {
      const d = detailRes.drawing;
      console.log(`作品详情:`);
      console.log(`  标题: ${d.title}`);
      console.log(`  编号: ${d.image_code}`);
      console.log(`  描述: ${d.description}`);
      console.log(`  状态: ${d.review_status}`);
      console.log(`  公开: ${d.is_public ? '是' : '否'}`);
      console.log(`  浏览: ${d.view_count} | 点赞: ${d.like_count}`);
      console.log(`  标签: ${d.tags.join(', ') || '无'}`);
      console.log(`  尺寸: ${d.canvas_width}x${d.canvas_height}`);
    }
    console.log('');
  }

  // ==========================================
  // 4. 用户作品列表演示
  // ==========================================
  console.log('═══════════════════════════════════════════════════════');
  console.log('📌 【4. 用户作品列表演示】\n');

  // 4.1 获取用户所有作品（包含私有）
  console.log('4.1 获取用户所有作品（包含私有）...');
  const myDrawingsRes = await request('GET', `/api/drawings/user/${userId}?include_private=true`);
  if (myDrawingsRes.success) {
    console.log(`共 ${myDrawingsRes.drawings.length} 个作品:\n`);
    myDrawingsRes.drawings.forEach((d, i) => {
      const status = {
        'approved': '✅ 已通过',
        'pending': '⏳ 待审核',
        'rejected': '❌ 已拒绝',
        'flagged': '⚠️ 人工审核中'
      }[d.review_status] || d.review_status;
      
      const publicStatus = d.is_public ? '公开' : '私有';
      console.log(`  ${i + 1}. [${d.image_code}] ${d.title || '无标题'}`);
      console.log(`     状态: ${status} | ${publicStatus} | 👁 ${d.view_count} ❤️ ${d.like_count}`);
      console.log(`     标签: ${d.tags.length > 0 ? d.tags.join(', ') : '无'}`);
      console.log('');
    });
  }

  // 4.2 获取用户公开作品
  console.log('4.2 获取用户公开作品...');
  const publicDrawingsRes = await request('GET', `/api/drawings/user/${userId}?include_private=false`);
  if (publicDrawingsRes.success) {
    console.log(`公开作品数量: ${publicDrawingsRes.drawings.length}`);
  }
  console.log('');

  // ==========================================
  // 5. 完整绘画流程模拟
  // ==========================================
  console.log('═══════════════════════════════════════════════════════');
  console.log('📌 【5. 完整绘画流程模拟】\n');
  
  console.log('模拟用户绘画流程:');
  console.log('');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │  1️⃣  初始化画布 (800x600)           [本地操作]  │');
  console.log('  │      └─ initializeCanvas(Size(800, 600))       │');
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('                         ↓');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │  2️⃣  获取贴纸列表                    [API调用]  │');
  console.log('  │      └─ GET /api/stickers/categories           │');
  console.log('  │      └─ GET /api/stickers?user_id=xxx          │');
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('                         ↓');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │  3️⃣  绘画操作                        [本地操作]  │');
  console.log('  │      └─ addBrushStroke(...) 画笔               │');
  console.log('  │      └─ addSticker(...) 添加贴纸               │');
  console.log('  │      └─ undo() / redo() 撤销/重做              │');
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('                         ↓');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │  4️⃣  保存作品                        [API调用]  │');
  console.log('  │      └─ POST /api/drawings                     │');
  console.log('  │      └─ 返回 drawing_id, image_code            │');
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('                         ↓');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │  5️⃣  添加标签                        [API调用]  │');
  console.log('  │      └─ GET /api/tags?category=boss_type       │');
  console.log('  │      └─ POST /api/drawings/:id/tags            │');
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('                         ↓');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │  6️⃣  提交审核                        [API调用]  │');
  console.log('  │      └─ POST /api/drawings/:id/submit          │');
  console.log('  │      └─ AI自动审核 → approved/flagged          │');
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('                         ↓');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │  7️⃣  作品公开                        [系统自动]  │');
  console.log('  │      └─ 审核通过后自动公开                      │');
  console.log('  │      └─ 可在推荐/滑一滑中展示                   │');
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('');

  // ==========================================
  // 演示完成
  // ==========================================
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ 绘图服务演示完成!');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('📊 数据库表结构:');
  console.log('  - drawings         : 绘画作品');
  console.log('  - drawing_tags     : 作品标签关联');
  console.log('  - drawing_stickers : 作品贴纸使用');
  console.log('  - drawing_reviews  : 审核记录');
  console.log('  - sticker_categories: 贴纸分类');
  console.log('  - stickers         : 贴纸定义');
  console.log('  - user_stickers    : 用户解锁贴纸');
  console.log('  - tag_definitions  : 标签定义');
  console.log('  - user_points      : 用户积分(辅助)');
  console.log('');
  console.log('🔗 相关服务依赖:');
  console.log('  - 推荐服务: 公开作品可在推荐中展示');
  console.log('  - 滑一滑服务: 公开作品可在内容流中展示');
  console.log('  - 积分服务: 解锁贴纸消耗积分');
  console.log('  - 地图服务: 作品可投放到地图上');
  console.log('');
}

// 运行演示
runDemo().catch(console.error);
