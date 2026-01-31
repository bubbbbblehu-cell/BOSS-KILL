/**
 * 激励文字服务 API 服务器
 * 演示激励文字的完整调用链路
 */

const express = require('express');
const { query, run, get, uuid } = require('./quotes-db');

const app = express();
app.use(express.json());

const PORT = 3004;

// ============================================
// API: GET /api/quotes/random
// 功能: 获取随机激励文字
// 数据库: get_random_motivational_quote
// ============================================
app.get('/api/quotes/random', async (req, res) => {
  try {
    console.log('\n📡 [API] GET /api/quotes/random - 获取随机激励文字');
    
    const quote = await get(`
      SELECT 
        mq.id, mq.text, mq.category, mq.author, 
        mq.usage_count, mq.effectiveness_score, mq.tags,
        qc.display_name as category_display, qc.color, qc.icon
      FROM motivational_quotes mq
      LEFT JOIN quote_categories qc ON mq.category = qc.name
      WHERE mq.is_active = 1
      ORDER BY RANDOM()
      LIMIT 1
    `);
    
    if (quote) {
      // 解析tags
      try {
        quote.tags = JSON.parse(quote.tags || '[]');
      } catch (e) {
        quote.tags = [];
      }
      
      console.log(`   → ✅ 返回: "${quote.text.substring(0, 20)}..." [${quote.category_display}]`);
      res.json({ success: true, data: quote });
    } else {
      res.status(404).json({ success: false, message: '没有可用的激励文字' });
    }
  } catch (error) {
    console.error('获取随机文字失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: GET /api/quotes/today
// 功能: 获取今日推荐文字（避免重复）
// 数据库: get_today_recommendation
// ============================================
app.get('/api/quotes/today', async (req, res) => {
  try {
    const userId = req.query.user_id || 'anonymous';
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`\n📡 [API] GET /api/quotes/today - 用户: ${userId}`);
    
    // 获取今日未展示过的高效文字
    const quote = await get(`
      SELECT 
        mq.id, mq.text, mq.category, mq.author,
        mq.usage_count, mq.effectiveness_score, mq.tags,
        qc.display_name as category_display, qc.color, qc.icon
      FROM motivational_quotes mq
      LEFT JOIN quote_categories qc ON mq.category = qc.name
      LEFT JOIN user_quote_usage uqu ON mq.id = uqu.quote_id 
        AND uqu.user_id = ? 
        AND DATE(uqu.used_at) = ?
      WHERE mq.is_active = 1 AND uqu.id IS NULL
      ORDER BY mq.effectiveness_score DESC, mq.usage_count ASC
      LIMIT 1
    `, [userId, today]);
    
    if (quote) {
      try {
        quote.tags = JSON.parse(quote.tags || '[]');
      } catch (e) {
        quote.tags = [];
      }
      
      console.log(`   → ✅ 今日推荐: "${quote.text.substring(0, 20)}..." (效果分: ${quote.effectiveness_score})`);
      res.json({ success: true, data: quote });
    } else {
      // 如果今日所有文字都已展示，返回随机一个
      console.log('   → ⚠️ 今日所有文字已展示，返回随机文字');
      const randomQuote = await get(`
        SELECT mq.*, qc.display_name as category_display 
        FROM motivational_quotes mq
        LEFT JOIN quote_categories qc ON mq.category = qc.name
        WHERE mq.is_active = 1
        ORDER BY RANDOM()
        LIMIT 1
      `);
      if (randomQuote) {
        randomQuote.tags = JSON.parse(randomQuote.tags || '[]');
      }
      res.json({ success: true, data: randomQuote, note: '今日所有文字已展示' });
    }
  } catch (error) {
    console.error('获取今日推荐失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: POST /api/quotes/usage
// 功能: 记录文字使用情况
// 数据库: record_quote_usage
// ============================================
app.post('/api/quotes/usage', async (req, res) => {
  try {
    const { user_id, quote_id, rating } = req.body;
    console.log(`\n📡 [API] POST /api/quotes/usage - 用户: ${user_id}, 文字: ${quote_id}, 评分: ${rating || '无'}`);
    
    // 插入使用记录
    await run('INSERT INTO user_quote_usage (id, user_id, quote_id, user_rating) VALUES (?, ?, ?, ?)',
      [uuid(), user_id, quote_id, rating || null]);
    
    // 更新使用统计
    await run('UPDATE motivational_quotes SET usage_count = usage_count + 1 WHERE id = ?', [quote_id]);
    
    // 如果有评分，更新效果分数
    if (rating) {
      // 简单的平均分更新算法
      await run(`
        UPDATE motivational_quotes 
        SET effectiveness_score = (effectiveness_score * usage_count + ? * 0.2) / (usage_count + 1)
        WHERE id = ?
      `, [rating, quote_id]);
    }
    
    console.log('   → ✅ 使用记录已保存');
    res.json({ success: true, message: '使用记录已保存' });
  } catch (error) {
    console.error('记录使用情况失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: GET /api/quotes/categories
// 功能: 获取所有文字分类
// ============================================
app.get('/api/quotes/categories', async (req, res) => {
  try {
    console.log('\n📡 [API] GET /api/quotes/categories - 获取分类列表');
    
    const categories = await query(`
      SELECT 
        qc.id, qc.name, qc.display_name, qc.description, qc.color, qc.icon,
        COUNT(mq.id) as quote_count
      FROM quote_categories qc
      LEFT JOIN motivational_quotes mq ON qc.name = mq.category AND mq.is_active = 1
      WHERE qc.is_active = 1
      GROUP BY qc.id
      ORDER BY qc.sort_order
    `);
    
    console.log(`   → 返回 ${categories.length} 个分类`);
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: GET /api/quotes/category/:name
// 功能: 按分类获取文字
// ============================================
app.get('/api/quotes/category/:name', async (req, res) => {
  try {
    const { name } = req.params;
    console.log(`\n📡 [API] GET /api/quotes/category/${name} - 获取分类文字`);
    
    const quotes = await query(`
      SELECT 
        mq.id, mq.text, mq.category, mq.author,
        mq.usage_count, mq.effectiveness_score, mq.tags,
        qc.display_name as category_display, qc.color
      FROM motivational_quotes mq
      LEFT JOIN quote_categories qc ON mq.category = qc.name
      WHERE mq.category = ? AND mq.is_active = 1
      ORDER BY mq.effectiveness_score DESC
    `, [name]);
    
    quotes.forEach(q => {
      try {
        q.tags = JSON.parse(q.tags || '[]');
      } catch (e) {
        q.tags = [];
      }
    });
    
    console.log(`   → 返回 ${quotes.length} 条文字`);
    res.json({ success: true, data: quotes });
  } catch (error) {
    console.error('获取分类文字失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: GET /api/quotes
// 功能: 获取所有文字（分页）
// ============================================
app.get('/api/quotes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 10;
    const offset = (page - 1) * pageSize;
    
    console.log(`\n📡 [API] GET /api/quotes - 获取所有文字 (页码: ${page})`);
    
    const quotes = await query(`
      SELECT 
        mq.id, mq.text, mq.category, mq.author,
        mq.usage_count, mq.effectiveness_score, mq.tags,
        qc.display_name as category_display, qc.color
      FROM motivational_quotes mq
      LEFT JOIN quote_categories qc ON mq.category = qc.name
      WHERE mq.is_active = 1
      ORDER BY mq.created_at DESC
      LIMIT ? OFFSET ?
    `, [pageSize, offset]);
    
    const total = await get('SELECT COUNT(*) as count FROM motivational_quotes WHERE is_active = 1');
    
    quotes.forEach(q => {
      try {
        q.tags = JSON.parse(q.tags || '[]');
      } catch (e) {
        q.tags = [];
      }
    });
    
    console.log(`   → 返回 ${quotes.length} 条文字 (共 ${total.count} 条)`);
    res.json({ success: true, data: quotes, total: total.count, page, pageSize });
  } catch (error) {
    console.error('获取文字列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: POST /api/quotes (管理员)
// 功能: 添加新的激励文字
// ============================================
app.post('/api/quotes', async (req, res) => {
  try {
    const { text, category, author, tags } = req.body;
    console.log(`\n📡 [API] POST /api/quotes - 添加新文字`);
    
    const id = `quote_${uuid().substring(0, 8)}`;
    await run('INSERT INTO motivational_quotes (id, text, category, author, tags) VALUES (?, ?, ?, ?, ?)',
      [id, text, category, author || '系统', JSON.stringify(tags || [])]);
    
    console.log(`   → ✅ 添加成功: ${id}`);
    res.json({ success: true, message: '添加成功', id });
  } catch (error) {
    console.error('添加文字失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: PUT /api/quotes/:id (管理员)
// 功能: 更新激励文字
// ============================================
app.put('/api/quotes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, category, author, tags } = req.body;
    console.log(`\n📡 [API] PUT /api/quotes/${id} - 更新文字`);
    
    await run(`
      UPDATE motivational_quotes 
      SET text = COALESCE(?, text), 
          category = COALESCE(?, category), 
          author = COALESCE(?, author),
          tags = COALESCE(?, tags)
      WHERE id = ?
    `, [text, category, author, tags ? JSON.stringify(tags) : null, id]);
    
    console.log('   → ✅ 更新成功');
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新文字失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: DELETE /api/quotes/:id (管理员)
// 功能: 删除激励文字（软删除）
// ============================================
app.delete('/api/quotes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`\n📡 [API] DELETE /api/quotes/${id} - 删除文字`);
    
    await run('UPDATE motivational_quotes SET is_active = 0 WHERE id = ?', [id]);
    
    console.log('   → ✅ 删除成功（软删除）');
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除文字失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// API: GET /api/quotes/stats
// 功能: 获取统计信息
// ============================================
app.get('/api/quotes/stats', async (req, res) => {
  try {
    console.log('\n📡 [API] GET /api/quotes/stats - 获取统计信息');
    
    const stats = await get(`
      SELECT 
        COUNT(*) as total_quotes,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_quotes,
        SUM(usage_count) as total_usage,
        AVG(effectiveness_score) as avg_effectiveness
      FROM motivational_quotes
    `);
    
    const categoryStats = await query(`
      SELECT category, COUNT(*) as count, AVG(effectiveness_score) as avg_score
      FROM motivational_quotes WHERE is_active = 1
      GROUP BY category
    `);
    
    console.log(`   → 总文字: ${stats.total_quotes}, 活跃: ${stats.active_quotes}`);
    res.json({ success: true, data: { ...stats, categories: categoryStats } });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 激励文字服务 API 服务器运行在 http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 API接口列表:');
  console.log('   GET  /api/quotes/random       获取随机激励文字');
  console.log('   GET  /api/quotes/today        获取今日推荐（避免重复）');
  console.log('   POST /api/quotes/usage        记录使用情况');
  console.log('   GET  /api/quotes/categories   获取分类列表');
  console.log('   GET  /api/quotes/category/:n  按分类获取文字');
  console.log('   GET  /api/quotes              获取所有文字（分页）');
  console.log('   POST /api/quotes              添加新文字（管理员）');
  console.log('   PUT  /api/quotes/:id          更新文字（管理员）');
  console.log('   DELETE /api/quotes/:id        删除文字（管理员）');
  console.log('   GET  /api/quotes/stats        获取统计信息');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
