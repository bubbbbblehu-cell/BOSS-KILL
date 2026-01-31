/**
 * 绘图服务 API Server
 * 运行: node drawing-server.js
 * 端口: 3006
 */

const express = require('express');
const { db, initializeDatabase, generateUUID, generateImageCode } = require('./drawing-db');

const app = express();
app.use(express.json());

const PORT = 3006;

// =========================================
// 贴纸相关 API
// =========================================

// 获取贴纸分类
app.get('/api/stickers/categories', (req, res) => {
  db.all(`
    SELECT 
      sc.id, sc.name, sc.display_name, sc.description, sc.icon, sc.color,
      (SELECT COUNT(*) FROM stickers s WHERE s.category_id = sc.id AND s.is_active = 1) as sticker_count
    FROM sticker_categories sc
    WHERE sc.is_active = 1
    ORDER BY sc.sort_order
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, categories: rows });
  });
});

// 获取贴纸列表
app.get('/api/stickers', (req, res) => {
  const { user_id, category_id } = req.query;
  
  let sql = `
    SELECT 
      s.id, s.name, s.image_url, s.thumbnail_url,
      s.is_premium, s.unlock_type, s.unlock_value,
      sc.name as category_name, sc.display_name as category_display,
      CASE WHEN us.id IS NOT NULL OR s.unlock_type = 'free' THEN 1 ELSE 0 END as is_unlocked
    FROM stickers s
    INNER JOIN sticker_categories sc ON s.category_id = sc.id
    LEFT JOIN user_stickers us ON s.id = us.sticker_id AND us.user_id = ?
    WHERE s.is_active = 1
  `;
  
  const params = [user_id || ''];
  
  if (category_id) {
    sql += ` AND s.category_id = ?`;
    params.push(category_id);
  }
  
  sql += ` ORDER BY sc.sort_order, s.sort_order`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, stickers: rows });
  });
});

// 解锁贴纸
app.post('/api/stickers/unlock', (req, res) => {
  const { user_id, sticker_id } = req.body;
  
  // 检查是否已解锁
  db.get(
    `SELECT id FROM user_stickers WHERE user_id = ? AND sticker_id = ?`,
    [user_id, sticker_id],
    (err, existing) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      if (existing) {
        return res.json({ success: false, message: '已经解锁过了' });
      }
      
      // 获取贴纸信息
      db.get(
        `SELECT unlock_type, unlock_value FROM stickers WHERE id = ? AND is_active = 1`,
        [sticker_id],
        (err, sticker) => {
          if (err || !sticker) {
            return res.json({ success: false, message: '贴纸不存在' });
          }
          
          if (sticker.unlock_type === 'free') {
            // 免费贴纸直接解锁
            db.run(
              `INSERT INTO user_stickers (id, user_id, sticker_id) VALUES (?, ?, ?)`,
              [generateUUID(), user_id, sticker_id],
              (err) => {
                if (err) {
                  return res.status(500).json({ success: false, message: err.message });
                }
                res.json({ success: true, message: '解锁成功' });
              }
            );
          } else if (sticker.unlock_type === 'points') {
            // 检查积分
            db.get(
              `SELECT available_points FROM user_points WHERE user_id = ?`,
              [user_id],
              (err, points) => {
                const userPoints = points ? points.available_points : 0;
                
                if (userPoints < sticker.unlock_value) {
                  return res.json({ 
                    success: false, 
                    message: `积分不足，需要${sticker.unlock_value}分，当前${userPoints}分` 
                  });
                }
                
                // 扣除积分
                db.run(
                  `UPDATE user_points SET available_points = available_points - ? WHERE user_id = ?`,
                  [sticker.unlock_value, user_id]
                );
                
                // 解锁贴纸
                db.run(
                  `INSERT INTO user_stickers (id, user_id, sticker_id) VALUES (?, ?, ?)`,
                  [generateUUID(), user_id, sticker_id],
                  (err) => {
                    if (err) {
                      return res.status(500).json({ success: false, message: err.message });
                    }
                    
                    // 更新贴纸使用统计
                    db.run(`UPDATE stickers SET usage_count = usage_count + 1 WHERE id = ?`, [sticker_id]);
                    
                    res.json({ 
                      success: true, 
                      message: '解锁成功',
                      points_spent: sticker.unlock_value,
                      remaining_points: userPoints - sticker.unlock_value
                    });
                  }
                );
              }
            );
          } else {
            res.json({ success: false, message: '不支持的解锁方式' });
          }
        }
      );
    }
  );
});

// =========================================
// 绘画作品相关 API
// =========================================

// 保存绘画作品
app.post('/api/drawings', async (req, res) => {
  const { user_id, title, description, image_url, thumbnail_url, canvas_data, canvas_width, canvas_height } = req.body;
  
  try {
    const drawingId = generateUUID();
    const imageCode = await generateImageCode();
    
    db.run(`
      INSERT INTO drawings (id, user_id, image_code, image_url, thumbnail_url, title, description, canvas_data, canvas_width, canvas_height, review_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [drawingId, user_id, imageCode, image_url, thumbnail_url, title, description, 
        canvas_data ? JSON.stringify(canvas_data) : null, canvas_width, canvas_height],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({
        success: true,
        drawing_id: drawingId,
        image_code: imageCode,
        image_url: image_url,
        thumbnail_url: thumbnail_url
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 提交作品审核
app.post('/api/drawings/:id/submit', (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  
  // 检查所有权和状态
  db.get(
    `SELECT user_id, review_status FROM drawings WHERE id = ?`,
    [id],
    (err, drawing) => {
      if (err || !drawing) {
        return res.json({ success: false, review_status: 'error', message: '作品不存在' });
      }
      if (drawing.user_id !== user_id) {
        return res.json({ success: false, review_status: 'error', message: '无权操作' });
      }
      if (drawing.review_status !== 'pending') {
        return res.json({ success: false, review_status: drawing.review_status, message: '作品已审核' });
      }
      
      // 模拟自动审核 (实际应调用AI审核服务)
      const reviewResult = Math.random() > 0.1 ? 'approved' : 'flagged';
      const reviewReason = reviewResult === 'approved' ? null : '内容需要人工审核';
      
      db.run(`
        UPDATE drawings 
        SET review_status = ?, review_reason = ?, reviewed_at = datetime('now'),
            is_public = CASE WHEN ? = 'approved' THEN 1 ELSE 0 END,
            published_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE NULL END
        WHERE id = ?
      `, [reviewResult, reviewReason, reviewResult, reviewResult, id], (err) => {
        if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }
        
        // 记录审核
        db.run(`
          INSERT INTO drawing_reviews (id, drawing_id, review_type, review_result, review_reason)
          VALUES (?, ?, 'auto', ?, ?)
        `, [generateUUID(), id, reviewResult, reviewReason]);
        
        res.json({
          success: true,
          review_status: reviewResult,
          message: reviewResult === 'approved' ? '审核通过，作品已公开' : '内容需要人工审核'
        });
      });
    }
  );
});

// 获取用户的绘画作品
app.get('/api/drawings/user/:userId', (req, res) => {
  const { userId } = req.params;
  const { include_private, page = 1, page_size = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  
  let sql = `
    SELECT 
      d.id, d.image_code, d.image_url, d.thumbnail_url,
      d.title, d.description, d.review_status,
      d.like_count, d.view_count, d.is_public,
      d.created_at, d.published_at
    FROM drawings d
    WHERE d.user_id = ? AND d.is_deleted = 0
  `;
  
  if (include_private !== 'true') {
    sql += ` AND d.is_public = 1`;
  }
  
  sql += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
  
  db.all(sql, [userId, parseInt(page_size), offset], (err, drawings) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    
    // 获取每个作品的标签
    const drawingIds = drawings.map(d => d.id);
    if (drawingIds.length === 0) {
      return res.json({ success: true, drawings: [] });
    }
    
    db.all(`
      SELECT drawing_id, GROUP_CONCAT(tag_name) as tags
      FROM drawing_tags
      WHERE drawing_id IN (${drawingIds.map(() => '?').join(',')})
      GROUP BY drawing_id
    `, drawingIds, (err, tagRows) => {
      const tagMap = {};
      (tagRows || []).forEach(row => {
        tagMap[row.drawing_id] = row.tags ? row.tags.split(',') : [];
      });
      
      drawings.forEach(d => {
        d.tags = tagMap[d.id] || [];
      });
      
      res.json({ success: true, drawings });
    });
  });
});

// 获取单个绘画作品详情
app.get('/api/drawings/:id', (req, res) => {
  const { id } = req.params;
  const { viewer_id } = req.query;
  
  // 增加浏览量
  db.run(`UPDATE drawings SET view_count = view_count + 1 WHERE id = ?`, [id]);
  
  db.get(`
    SELECT 
      d.id, d.user_id, d.image_code, d.image_url, d.thumbnail_url,
      d.title, d.description, d.review_status,
      d.like_count, d.view_count, d.share_count,
      d.is_public, d.created_at, d.published_at,
      d.canvas_width, d.canvas_height
    FROM drawings d
    WHERE d.id = ? AND d.is_deleted = 0
  `, [id], (err, drawing) => {
    if (err || !drawing) {
      return res.status(404).json({ success: false, error: '作品不存在' });
    }
    
    // 获取标签
    db.all(`SELECT tag_name FROM drawing_tags WHERE drawing_id = ?`, [id], (err, tags) => {
      drawing.tags = (tags || []).map(t => t.tag_name);
      
      // 获取使用的贴纸
      db.all(`
        SELECT ds.*, s.name as sticker_name, s.image_url as sticker_image
        FROM drawing_stickers ds
        INNER JOIN stickers s ON ds.sticker_id = s.id
        WHERE ds.drawing_id = ?
      `, [id], (err, stickers) => {
        drawing.stickers = stickers || [];
        res.json({ success: true, drawing });
      });
    });
  });
});

// =========================================
// 标签相关 API
// =========================================

// 获取标签列表
app.get('/api/tags', (req, res) => {
  const { category } = req.query;
  
  let sql = `
    SELECT id, name, display_name, category, color, icon, usage_count
    FROM tag_definitions
    WHERE is_active = 1
  `;
  
  const params = [];
  if (category) {
    sql += ` AND category = ?`;
    params.push(category);
  }
  
  sql += ` ORDER BY usage_count DESC, sort_order`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, tags: rows });
  });
});

// 为作品添加标签
app.post('/api/drawings/:id/tags', (req, res) => {
  const { id } = req.params;
  const { tags } = req.body;
  
  if (!Array.isArray(tags)) {
    return res.status(400).json({ success: false, error: 'tags must be an array' });
  }
  
  // 清除现有标签
  db.run(`DELETE FROM drawing_tags WHERE drawing_id = ?`, [id], (err) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    
    // 添加新标签
    if (tags.length === 0) {
      return res.json({ success: true, message: '标签已更新' });
    }
    
    const stmt = db.prepare(`INSERT INTO drawing_tags (id, drawing_id, tag_name) VALUES (?, ?, ?)`);
    let completed = 0;
    
    tags.forEach(tag => {
      stmt.run([generateUUID(), id, tag], (err) => {
        // 更新标签使用统计
        db.run(`UPDATE tag_definitions SET usage_count = usage_count + 1 WHERE name = ?`, [tag]);
        
        completed++;
        if (completed === tags.length) {
          stmt.finalize();
          res.json({ success: true, message: '标签已更新', tags_count: tags.length });
        }
      });
    });
  });
});

// =========================================
// 用户积分查询 API (辅助)
// =========================================

app.get('/api/users/:userId/points', (req, res) => {
  const { userId } = req.params;
  
  db.get(`SELECT available_points FROM user_points WHERE user_id = ?`, [userId], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ 
      success: true, 
      user_id: userId,
      available_points: row ? row.available_points : 0 
    });
  });
});

// =========================================
// 启动服务器
// =========================================

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🎨 绘图服务 API Server 已启动`);
    console.log(`📍 地址: http://localhost:${PORT}`);
    console.log(`\n可用接口:`);
    console.log(`  GET  /api/stickers/categories  - 获取贴纸分类`);
    console.log(`  GET  /api/stickers             - 获取贴纸列表`);
    console.log(`  POST /api/stickers/unlock      - 解锁贴纸`);
    console.log(`  POST /api/drawings             - 保存绘画作品`);
    console.log(`  POST /api/drawings/:id/submit  - 提交作品审核`);
    console.log(`  GET  /api/drawings/user/:userId - 获取用户作品`);
    console.log(`  GET  /api/drawings/:id         - 获取作品详情`);
    console.log(`  GET  /api/tags                 - 获取标签列表`);
    console.log(`  POST /api/drawings/:id/tags    - 添加作品标签`);
    console.log(`\n`);
  });
});
