/**
 * 滑一滑服务 API 服务器
 * 演示前端到数据库的完整调用链路
 * 
 * API接口:
 * - GET  /api/swipe/top3     获取Top3推荐内容
 * - GET  /api/swipe/feed     获取推荐内容流（分页）
 * - POST /api/swipe/like     点赞内容
 * - DELETE /api/swipe/like   取消点赞
 * - POST /api/swipe/favorite 收藏内容
 * - DELETE /api/swipe/favorite 取消收藏
 * - POST /api/swipe/view     记录浏览
 */

const express = require('express');
const { query, run, get, uuid } = require('./swipe-db');

const app = express();
app.use(express.json());

const PORT = 3002;

// ============================================
// API: GET /api/swipe/top3
// 功能: 获取Top3推荐内容 (对应 getTop3Content)
// 数据库: api_swipe_get_top3
// ============================================
app.get('/api/swipe/top3', async (req, res) => {
  try {
    const userId = req.query.user_id || 'anonymous';
    console.log(`\n📡 [API] GET /api/swipe/top3 - 用户: ${userId}`);
    
    // 获取Top3内容
    const contents = await query(`
      SELECT 
        c.id, c.image_url, c.title, c.description,
        c.like_count, c.favorite_count, c.view_count,
        c.created_at, c.author_id, c.top_rank
      FROM contents c
      WHERE c.is_active = 1 
        AND c.review_status = 'approved'
        AND c.is_top = 1
      ORDER BY c.top_rank ASC
      LIMIT 3
    `);
    
    // 为每个内容获取标签和用户交互状态
    for (const content of contents) {
      // 获取标签
      const tags = await query('SELECT tag_name FROM content_tags WHERE content_id = ?', [content.id]);
      content.tags = tags.map(t => t.tag_name);
      
      // 检查用户是否点赞
      const liked = await get('SELECT 1 FROM user_likes WHERE user_id = ? AND content_id = ?', [userId, content.id]);
      content.is_liked = !!liked;
      
      // 检查用户是否收藏
      const favorited = await get('SELECT 1 FROM user_favorites WHERE user_id = ? AND content_id = ?', [userId, content.id]);
      content.is_favorited = !!favorited;
    }
    
    console.log(`   → 返回 ${contents.length} 条Top3内容`);
    res.json({ success: true, data: contents });
  } catch (error) {
    console.error('获取Top3失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: GET /api/swipe/feed
// 功能: 获取推荐内容流 (对应 getContentStream)
// 数据库: api_swipe_get_feed
// 推荐算法: 点赞*1.0 + 收藏*2.0 + 浏览*0.1 + 时间衰减
// ============================================
app.get('/api/swipe/feed', async (req, res) => {
  try {
    const userId = req.query.user_id || 'anonymous';
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 10;
    const offset = (page - 1) * pageSize;
    
    console.log(`\n📡 [API] GET /api/swipe/feed - 用户: ${userId}, 页码: ${page}`);
    
    // 使用推荐算法获取内容
    // 推荐分数 = (点赞*1.0 + 收藏*2.0 + 浏览*0.1) * 时间衰减
    const contents = await query(`
      SELECT 
        c.id, c.image_url, c.title, c.description,
        c.like_count, c.favorite_count, c.view_count,
        c.created_at, c.author_id,
        (c.like_count * 1.0 + c.favorite_count * 2.0 + c.view_count * 0.1) * 
        (1.0 / (1.0 + (julianday('now') - julianday(c.created_at)) / 30.0)) AS recommendation_score
      FROM contents c
      WHERE c.is_active = 1 AND c.review_status = 'approved'
      ORDER BY recommendation_score DESC, c.created_at DESC
      LIMIT ? OFFSET ?
    `, [pageSize, offset]);
    
    // 获取每个内容的额外信息
    for (const content of contents) {
      const tags = await query('SELECT tag_name FROM content_tags WHERE content_id = ?', [content.id]);
      content.tags = tags.map(t => t.tag_name);
      
      const liked = await get('SELECT 1 FROM user_likes WHERE user_id = ? AND content_id = ?', [userId, content.id]);
      content.is_liked = !!liked;
      
      const favorited = await get('SELECT 1 FROM user_favorites WHERE user_id = ? AND content_id = ?', [userId, content.id]);
      content.is_favorited = !!favorited;
    }
    
    console.log(`   → 返回 ${contents.length} 条推荐内容 (推荐算法排序)`);
    res.json({ success: true, data: contents, page, pageSize });
  } catch (error) {
    console.error('获取推荐流失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: POST /api/swipe/like
// 功能: 点赞内容 (对应 likeContent)
// 数据库: api_swipe_like_content
// ============================================
app.post('/api/swipe/like', async (req, res) => {
  try {
    const { user_id, content_id } = req.body;
    console.log(`\n📡 [API] POST /api/swipe/like - 用户: ${user_id}, 内容: ${content_id}`);
    
    // 检查是否已点赞
    const existing = await get('SELECT 1 FROM user_likes WHERE user_id = ? AND content_id = ?', [user_id, content_id]);
    
    if (existing) {
      console.log('   → ⚠️ 已经点赞过了');
      const content = await get('SELECT like_count FROM contents WHERE id = ?', [content_id]);
      return res.json({ success: false, message: '已经点赞过了', new_like_count: content.like_count });
    }
    
    // 插入点赞记录
    await run('INSERT INTO user_likes (id, user_id, content_id) VALUES (?, ?, ?)', [uuid(), user_id, content_id]);
    
    // 更新内容点赞数
    await run('UPDATE contents SET like_count = like_count + 1 WHERE id = ?', [content_id]);
    
    const content = await get('SELECT like_count FROM contents WHERE id = ?', [content_id]);
    console.log(`   → ✅ 点赞成功，当前点赞数: ${content.like_count}`);
    
    res.json({ success: true, new_like_count: content.like_count });
  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: DELETE /api/swipe/like
// 功能: 取消点赞 (对应 unlikeContent)
// 数据库: api_swipe_unlike_content
// ============================================
app.delete('/api/swipe/like', async (req, res) => {
  try {
    const user_id = req.body.user_id || req.query.user_id;
    const content_id = req.body.content_id || req.query.content_id;
    console.log(`\n📡 [API] DELETE /api/swipe/like - 用户: ${user_id}, 内容: ${content_id}`);
    
    // 检查是否已点赞
    const existing = await get('SELECT 1 FROM user_likes WHERE user_id = ? AND content_id = ?', [user_id, content_id]);
    
    if (!existing) {
      console.log('   → ⚠️ 没有点赞记录');
      const content = await get('SELECT like_count FROM contents WHERE id = ?', [content_id]);
      return res.json({ success: false, message: '没有点赞记录', new_like_count: content.like_count });
    }
    
    // 删除点赞记录
    await run('DELETE FROM user_likes WHERE user_id = ? AND content_id = ?', [user_id, content_id]);
    
    // 更新内容点赞数
    await run('UPDATE contents SET like_count = MAX(like_count - 1, 0) WHERE id = ?', [content_id]);
    
    const content = await get('SELECT like_count FROM contents WHERE id = ?', [content_id]);
    console.log(`   → ✅ 取消点赞成功，当前点赞数: ${content.like_count}`);
    
    res.json({ success: true, new_like_count: content.like_count });
  } catch (error) {
    console.error('取消点赞失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: POST /api/swipe/favorite
// 功能: 收藏内容 (对应 favoriteContent)
// 数据库: api_swipe_favorite_content
// ============================================
app.post('/api/swipe/favorite', async (req, res) => {
  try {
    const { user_id, content_id } = req.body;
    console.log(`\n📡 [API] POST /api/swipe/favorite - 用户: ${user_id}, 内容: ${content_id}`);
    
    // 检查是否已收藏
    const existing = await get('SELECT 1 FROM user_favorites WHERE user_id = ? AND content_id = ?', [user_id, content_id]);
    
    if (existing) {
      console.log('   → ⚠️ 已经收藏过了');
      const content = await get('SELECT favorite_count FROM contents WHERE id = ?', [content_id]);
      return res.json({ success: false, message: '已经收藏过了', new_favorite_count: content.favorite_count });
    }
    
    // 插入收藏记录
    await run('INSERT INTO user_favorites (id, user_id, content_id) VALUES (?, ?, ?)', [uuid(), user_id, content_id]);
    
    // 更新内容收藏数
    await run('UPDATE contents SET favorite_count = favorite_count + 1 WHERE id = ?', [content_id]);
    
    const content = await get('SELECT favorite_count FROM contents WHERE id = ?', [content_id]);
    console.log(`   → ✅ 收藏成功，当前收藏数: ${content.favorite_count}`);
    
    res.json({ success: true, new_favorite_count: content.favorite_count });
  } catch (error) {
    console.error('收藏失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: DELETE /api/swipe/favorite
// 功能: 取消收藏 (对应 unfavoriteContent)
// 数据库: api_swipe_unfavorite_content
// ============================================
app.delete('/api/swipe/favorite', async (req, res) => {
  try {
    const user_id = req.body.user_id || req.query.user_id;
    const content_id = req.body.content_id || req.query.content_id;
    console.log(`\n📡 [API] DELETE /api/swipe/favorite - 用户: ${user_id}, 内容: ${content_id}`);
    
    // 检查是否已收藏
    const existing = await get('SELECT 1 FROM user_favorites WHERE user_id = ? AND content_id = ?', [user_id, content_id]);
    
    if (!existing) {
      console.log('   → ⚠️ 没有收藏记录');
      const content = await get('SELECT favorite_count FROM contents WHERE id = ?', [content_id]);
      return res.json({ success: false, message: '没有收藏记录', new_favorite_count: content.favorite_count });
    }
    
    // 删除收藏记录
    await run('DELETE FROM user_favorites WHERE user_id = ? AND content_id = ?', [user_id, content_id]);
    
    // 更新内容收藏数
    await run('UPDATE contents SET favorite_count = MAX(favorite_count - 1, 0) WHERE id = ?', [content_id]);
    
    const content = await get('SELECT favorite_count FROM contents WHERE id = ?', [content_id]);
    console.log(`   → ✅ 取消收藏成功，当前收藏数: ${content.favorite_count}`);
    
    res.json({ success: true, new_favorite_count: content.favorite_count });
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: POST /api/swipe/view
// 功能: 记录浏览 (用于推荐算法)
// 数据库: api_swipe_record_view
// ============================================
app.post('/api/swipe/view', async (req, res) => {
  try {
    const { user_id, content_id, view_duration } = req.body;
    console.log(`\n📡 [API] POST /api/swipe/view - 用户: ${user_id}, 内容: ${content_id}, 时长: ${view_duration}秒`);
    
    // 插入浏览记录
    await run('INSERT INTO user_views (id, user_id, content_id, view_duration) VALUES (?, ?, ?, ?)', 
      [uuid(), user_id, content_id, view_duration || 0]);
    
    // 更新内容浏览数
    await run('UPDATE contents SET view_count = view_count + 1 WHERE id = ?', [content_id]);
    
    const content = await get('SELECT view_count FROM contents WHERE id = ?', [content_id]);
    console.log(`   → ✅ 浏览记录已保存，总浏览数: ${content.view_count}`);
    
    res.json({ success: true, view_count: content.view_count });
  } catch (error) {
    console.error('记录浏览失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: GET /api/swipe/user/likes
// 功能: 获取用户点赞列表
// ============================================
app.get('/api/swipe/user/likes', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 10;
    const offset = (page - 1) * pageSize;
    
    console.log(`\n📡 [API] GET /api/swipe/user/likes - 用户: ${userId}`);
    
    const likes = await query(`
      SELECT 
        c.id, c.image_url, c.title, c.description,
        c.like_count, c.favorite_count, c.created_at, c.author_id,
        ul.created_at AS liked_at
      FROM user_likes ul
      INNER JOIN contents c ON ul.content_id = c.id
      WHERE ul.user_id = ? AND c.is_active = 1
      ORDER BY ul.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, pageSize, offset]);
    
    console.log(`   → 返回 ${likes.length} 条点赞记录`);
    res.json({ success: true, data: likes });
  } catch (error) {
    console.error('获取点赞列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: GET /api/swipe/user/favorites
// 功能: 获取用户收藏列表
// ============================================
app.get('/api/swipe/user/favorites', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 10;
    const offset = (page - 1) * pageSize;
    
    console.log(`\n📡 [API] GET /api/swipe/user/favorites - 用户: ${userId}`);
    
    const favorites = await query(`
      SELECT 
        c.id, c.image_url, c.title, c.description,
        c.like_count, c.favorite_count, c.created_at, c.author_id,
        uf.created_at AS favorited_at
      FROM user_favorites uf
      INNER JOIN contents c ON uf.content_id = c.id
      WHERE uf.user_id = ? AND c.is_active = 1
      ORDER BY uf.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, pageSize, offset]);
    
    console.log(`   → 返回 ${favorites.length} 条收藏记录`);
    res.json({ success: true, data: favorites });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 滑一滑服务 API 服务器运行在 http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 API接口列表:');
  console.log('   GET  /api/swipe/top3           获取Top3推荐');
  console.log('   GET  /api/swipe/feed           获取推荐内容流');
  console.log('   POST /api/swipe/like           点赞');
  console.log('   DELETE /api/swipe/like         取消点赞');
  console.log('   POST /api/swipe/favorite       收藏');
  console.log('   DELETE /api/swipe/favorite     取消收藏');
  console.log('   POST /api/swipe/view           记录浏览');
  console.log('   GET  /api/swipe/user/likes     用户点赞列表');
  console.log('   GET  /api/swipe/user/favorites 用户收藏列表');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
