/**
 * 滑一滑服务 前端模拟客户端
 * 演示完整的 前端 → API → 数据库 调用流程
 */

const http = require('http');

const API_BASE = 'http://localhost:3002';
const TEST_USER_ID = 'demo_user_001';

// HTTP请求封装
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
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
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// API调用方法
const SwipeService = {
  // 获取Top3推荐内容
  async getTop3Content(userId) {
    return request('GET', `/api/swipe/top3?user_id=${userId}`);
  },
  
  // 获取推荐内容流
  async getContentFeed(userId, page = 1, pageSize = 10) {
    return request('GET', `/api/swipe/feed?user_id=${userId}&page=${page}&page_size=${pageSize}`);
  },
  
  // 点赞内容
  async likeContent(userId, contentId) {
    return request('POST', '/api/swipe/like', { user_id: userId, content_id: contentId });
  },
  
  // 取消点赞
  async unlikeContent(userId, contentId) {
    return request('DELETE', '/api/swipe/like', { user_id: userId, content_id: contentId });
  },
  
  // 收藏内容
  async favoriteContent(userId, contentId) {
    return request('POST', '/api/swipe/favorite', { user_id: userId, content_id: contentId });
  },
  
  // 取消收藏
  async unfavoriteContent(userId, contentId) {
    return request('DELETE', '/api/swipe/favorite', { user_id: userId, content_id: contentId });
  },
  
  // 记录浏览
  async recordView(userId, contentId, duration) {
    return request('POST', '/api/swipe/view', { user_id: userId, content_id: contentId, view_duration: duration });
  },
  
  // 获取用户点赞列表
  async getUserLikes(userId, page = 1, pageSize = 10) {
    return request('GET', `/api/swipe/user/likes?user_id=${userId}&page=${page}&page_size=${pageSize}`);
  },
  
  // 获取用户收藏列表
  async getUserFavorites(userId, page = 1, pageSize = 10) {
    return request('GET', `/api/swipe/user/favorites?user_id=${userId}&page=${page}&page_size=${pageSize}`);
  }
};

// 辅助函数 - 打印分隔线
function printSeparator(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// 辅助函数 - 打印内容卡片
function printContentCard(content, index) {
  console.log(`\n  ┌────────────────────────────────────────────────────┐`);
  console.log(`  │ ${index ? `#${index} ` : ''}${content.title.padEnd(45)}│`);
  console.log(`  ├────────────────────────────────────────────────────┤`);
  console.log(`  │ 📝 ${content.description.padEnd(45)}│`);
  console.log(`  │ ❤️  点赞: ${String(content.like_count).padEnd(8)} ⭐ 收藏: ${String(content.favorite_count).padEnd(8)}│`);
  console.log(`  │ 👁️  浏览: ${String(content.view_count || '-').padEnd(8)} 🏷️  标签: ${(content.tags?.join(', ') || '-').padEnd(8)}│`);
  if (content.is_liked !== undefined) {
    console.log(`  │ ${content.is_liked ? '✅ 已点赞' : '⬜ 未点赞'}    ${content.is_favorited ? '✅ 已收藏' : '⬜ 未收藏'}                        │`);
  }
  console.log(`  └────────────────────────────────────────────────────┘`);
}

// 演示流程
async function runDemo() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              BOSS KILL 滑一滑服务 演示                      ║');
  console.log('║          前端 → API → 数据库 完整调用流程                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n👤 演示用户ID: ${TEST_USER_ID}`);

  try {
    // ====== 流程1: 首页加载 - 获取Top3 ======
    printSeparator('流程1: 首页加载 - 获取Top3推荐');
    console.log('\n📱 [前端] 用户打开首页，调用 getTop3Content()');
    console.log('   → 发起请求: GET /api/swipe/top3');
    
    const top3Result = await SwipeService.getTop3Content(TEST_USER_ID);
    
    if (top3Result.success && top3Result.data) {
      console.log('\n🏆 Top3 Banner 内容:');
      top3Result.data.forEach((content, idx) => {
        printContentCard(content, `TOP${idx + 1}`);
      });
    }

    // ====== 流程2: 获取推荐内容流 ======
    printSeparator('流程2: 滑动卡片 - 获取推荐内容流');
    console.log('\n📱 [前端] 用户滑动浏览，调用 getContentFeed()');
    console.log('   → 发起请求: GET /api/swipe/feed?page=1&page_size=5');
    console.log('   → 推荐算法: score = (点赞*1.0 + 收藏*2.0 + 浏览*0.1) * 时间衰减');
    
    const feedResult = await SwipeService.getContentFeed(TEST_USER_ID, 1, 5);
    
    if (feedResult.success && feedResult.data) {
      console.log(`\n📋 推荐内容 (共${feedResult.data.length}条):`);
      feedResult.data.slice(0, 3).forEach((content, idx) => {
        printContentCard(content, idx + 1);
      });
      if (feedResult.data.length > 3) {
        console.log(`\n  ... 还有 ${feedResult.data.length - 3} 条内容`);
      }
    }

    // ====== 流程3: 点赞交互 ======
    printSeparator('流程3: 用户交互 - 点赞内容');
    const targetContent = feedResult.data?.[0];
    if (targetContent) {
      console.log(`\n📱 [前端] 用户点击点赞按钮，内容: "${targetContent.title}"`);
      console.log('   → 发起请求: POST /api/swipe/like');
      
      const likeResult = await SwipeService.likeContent(TEST_USER_ID, targetContent.id);
      
      if (likeResult.success) {
        console.log(`\n   ✅ 点赞成功！`);
        console.log(`   → 点赞数: ${targetContent.like_count} → ${likeResult.new_like_count}`);
      } else {
        console.log(`\n   ⚠️ ${likeResult.message}`);
        console.log(`   → 当前点赞数: ${likeResult.new_like_count}`);
      }
    }

    // ====== 流程4: 收藏交互 ======
    printSeparator('流程4: 用户交互 - 收藏内容');
    const favoriteTarget = feedResult.data?.[1];
    if (favoriteTarget) {
      console.log(`\n📱 [前端] 用户点击收藏按钮，内容: "${favoriteTarget.title}"`);
      console.log('   → 发起请求: POST /api/swipe/favorite');
      
      const favoriteResult = await SwipeService.favoriteContent(TEST_USER_ID, favoriteTarget.id);
      
      if (favoriteResult.success) {
        console.log(`\n   ✅ 收藏成功！`);
        console.log(`   → 收藏数: ${favoriteTarget.favorite_count} → ${favoriteResult.new_favorite_count}`);
      } else {
        console.log(`\n   ⚠️ ${favoriteResult.message}`);
        console.log(`   → 当前收藏数: ${favoriteResult.new_favorite_count}`);
      }
    }

    // ====== 流程5: 记录浏览 ======
    printSeparator('流程5: 记录浏览 (用于推荐算法)');
    const viewTarget = feedResult.data?.[2];
    if (viewTarget) {
      console.log(`\n📱 [前端] 用户浏览内容: "${viewTarget.title}"`);
      console.log('   → 模拟浏览时长: 15秒');
      console.log('   → 发起请求: POST /api/swipe/view');
      
      const viewResult = await SwipeService.recordView(TEST_USER_ID, viewTarget.id, 15);
      
      if (viewResult.success) {
        console.log(`\n   ✅ 浏览记录已保存！`);
        console.log(`   → 该内容总浏览数: ${viewResult.view_count}`);
        console.log('   → 浏览数据将用于改进推荐算法');
      }
    }

    // ====== 流程6: 取消点赞 ======
    printSeparator('流程6: 用户交互 - 取消点赞');
    if (targetContent) {
      console.log(`\n📱 [前端] 用户再次点击点赞按钮（取消点赞）: "${targetContent.title}"`);
      console.log('   → 发起请求: DELETE /api/swipe/like');
      
      const unlikeResult = await SwipeService.unlikeContent(TEST_USER_ID, targetContent.id);
      
      if (unlikeResult.success) {
        console.log(`\n   ✅ 取消点赞成功！`);
        console.log(`   → 点赞数: ${unlikeResult.new_like_count}`);
      } else {
        console.log(`\n   ⚠️ ${unlikeResult.message}`);
      }
    }

    // ====== 流程7: 获取用户点赞/收藏列表 ======
    printSeparator('流程7: 获取用户点赞和收藏列表');
    
    console.log('\n📱 [前端] 获取用户点赞列表');
    const likesResult = await SwipeService.getUserLikes(TEST_USER_ID);
    console.log(`   → 用户共点赞 ${likesResult.data?.length || 0} 条内容`);
    
    console.log('\n📱 [前端] 获取用户收藏列表');
    const favoritesResult = await SwipeService.getUserFavorites(TEST_USER_ID);
    console.log(`   → 用户共收藏 ${favoritesResult.data?.length || 0} 条内容`);

    // ====== 演示完成 ======
    printSeparator('演示完成');
    console.log('\n✅ 滑一滑服务演示完成！');
    console.log('\n📝 API调用总结:');
    console.log('   1. GET  /api/swipe/top3     → 获取Top3推荐内容');
    console.log('   2. GET  /api/swipe/feed     → 获取推荐内容流');
    console.log('   3. POST /api/swipe/like     → 点赞内容');
    console.log('   4. POST /api/swipe/favorite → 收藏内容');
    console.log('   5. POST /api/swipe/view     → 记录浏览');
    console.log('   6. DELETE /api/swipe/like   → 取消点赞');
    console.log('   7. GET  /api/swipe/user/*   → 获取用户列表');
    console.log('\n🗄️ 数据库调用:');
    console.log('   - contents: 内容主表');
    console.log('   - content_tags: 内容标签');
    console.log('   - user_likes: 点赞记录');
    console.log('   - user_favorites: 收藏记录');
    console.log('   - user_views: 浏览记录 (推荐算法)');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ 演示出错:', error.message);
    console.log('\n请确保 swipe-server.js 正在运行 (端口 3002)');
  }
}

// 运行演示
runDemo();
