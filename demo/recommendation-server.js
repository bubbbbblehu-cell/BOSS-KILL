/**
 * 推荐服务 API 服务器
 * 演示社交关系、礼物、积分、打卡等功能的完整调用链路
 */

const express = require('express');
const { query, run, get, uuid } = require('./recommendation-db');

const app = express();
app.use(express.json());

const PORT = 3003;

// ============================================
// 社交关系API
// ============================================

// API: POST /api/social/follow - 关注用户
app.post('/api/social/follow', async (req, res) => {
  try {
    const { follower_id, following_id } = req.body;
    console.log(`\n📡 [API] POST /api/social/follow - ${follower_id} 关注 ${following_id}`);
    
    if (follower_id === following_id) {
      return res.json({ success: false, message: '不能关注自己' });
    }
    
    const existing = await get('SELECT 1 FROM user_follows WHERE follower_id = ? AND following_id = ?', [follower_id, following_id]);
    
    if (existing) {
      console.log('   → ⚠️ 已经关注过了');
      return res.json({ success: false, message: '已经关注过了' });
    }
    
    await run('INSERT INTO user_follows (id, follower_id, following_id) VALUES (?, ?, ?)', [uuid(), follower_id, following_id]);
    console.log('   → ✅ 关注成功');
    res.json({ success: true, message: '关注成功' });
  } catch (error) {
    console.error('关注失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: DELETE /api/social/follow - 取消关注
app.delete('/api/social/follow', async (req, res) => {
  try {
    const follower_id = req.body.follower_id || req.query.follower_id;
    const following_id = req.body.following_id || req.query.following_id;
    console.log(`\n📡 [API] DELETE /api/social/follow - ${follower_id} 取消关注 ${following_id}`);
    
    const result = await run('DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?', [follower_id, following_id]);
    
    if (result.changes > 0) {
      console.log('   → ✅ 取消关注成功');
      res.json({ success: true, message: '取消关注成功' });
    } else {
      console.log('   → ⚠️ 没有关注记录');
      res.json({ success: false, message: '没有关注记录' });
    }
  } catch (error) {
    console.error('取消关注失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: POST /api/social/friend/request - 发送好友请求
app.post('/api/social/friend/request', async (req, res) => {
  try {
    const { user_id, friend_id } = req.body;
    console.log(`\n📡 [API] POST /api/social/friend/request - ${user_id} 请求添加好友 ${friend_id}`);
    
    if (user_id === friend_id) {
      return res.json({ success: false, message: '不能添加自己为好友' });
    }
    
    const existing = await get(`
      SELECT status FROM user_friends 
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `, [user_id, friend_id, friend_id, user_id]);
    
    if (existing) {
      if (existing.status === 'accepted') {
        return res.json({ success: false, message: '已经是好友了' });
      } else if (existing.status === 'pending') {
        return res.json({ success: false, message: '已发送过好友请求' });
      }
    }
    
    await run('INSERT INTO user_friends (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)', [uuid(), user_id, friend_id, 'pending']);
    console.log('   → ✅ 好友请求已发送');
    res.json({ success: true, message: '好友请求已发送' });
  } catch (error) {
    console.error('发送好友请求失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 礼物系统API
// ============================================

// API: GET /api/gifts - 获取礼物列表
app.get('/api/gifts', async (req, res) => {
  try {
    console.log('\n📡 [API] GET /api/gifts - 获取礼物列表');
    const gifts = await query('SELECT * FROM gifts WHERE is_active = 1 ORDER BY sort_order');
    console.log(`   → 返回 ${gifts.length} 种礼物`);
    res.json({ success: true, data: gifts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: POST /api/gift/send - 发送礼物
app.post('/api/gift/send', async (req, res) => {
  try {
    const { sender_id, receiver_id, gift_id, message } = req.body;
    console.log(`\n📡 [API] POST /api/gift/send - ${sender_id} 发送礼物给 ${receiver_id}`);
    
    // 获取礼物价格
    const gift = await get('SELECT name, price_points FROM gifts WHERE id = ? AND is_active = 1', [gift_id]);
    if (!gift) {
      return res.json({ success: false, message: '礼物不存在' });
    }
    
    // 获取用户积分
    const userPoints = await get('SELECT available_points FROM user_points WHERE user_id = ?', [sender_id]);
    const availablePoints = userPoints?.available_points || 0;
    
    if (availablePoints < gift.price_points) {
      console.log(`   → ⚠️ 积分不足 (需要${gift.price_points}, 只有${availablePoints})`);
      return res.json({ success: false, message: `积分不足，需要${gift.price_points}分` });
    }
    
    // 扣除积分
    await run('UPDATE user_points SET available_points = available_points - ? WHERE user_id = ?', [gift.price_points, sender_id]);
    
    // 记录积分变动
    await run('INSERT INTO point_transactions (id, user_id, points, transaction_type, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)',
      [uuid(), sender_id, -gift.price_points, 'spend_gift', gift_id, `发送礼物: ${gift.name}`]);
    
    // 记录礼物发送
    await run('INSERT INTO gift_records (id, sender_id, receiver_id, gift_id, message) VALUES (?, ?, ?, ?, ?)',
      [uuid(), sender_id, receiver_id, gift_id, message]);
    
    console.log(`   → ✅ 礼物发送成功！花费 ${gift.price_points} 积分`);
    res.json({ success: true, message: '礼物发送成功', gift_name: gift.name, points_spent: gift.price_points });
  } catch (error) {
    console.error('发送礼物失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 积分系统API
// ============================================

// API: GET /api/points - 获取用户积分
app.get('/api/points', async (req, res) => {
  try {
    const user_id = req.query.user_id;
    console.log(`\n📡 [API] GET /api/points - 用户: ${user_id}`);
    
    const points = await get('SELECT total_points, available_points, level, exp FROM user_points WHERE user_id = ?', [user_id]);
    
    if (points) {
      console.log(`   → 总积分: ${points.total_points}, 可用: ${points.available_points}, 等级: ${points.level}`);
      res.json({ success: true, data: points });
    } else {
      res.json({ success: true, data: { total_points: 0, available_points: 0, level: 1, exp: 0 } });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: POST /api/action/record - 记录用户行为并奖励积分
app.post('/api/action/record', async (req, res) => {
  try {
    const { user_id, content_id, action_type } = req.body;
    console.log(`\n📡 [API] POST /api/action/record - 用户: ${user_id}, 行为: ${action_type}`);
    
    // 记录行为
    await run('INSERT INTO user_actions (id, user_id, content_id, action_type) VALUES (?, ?, ?, ?)',
      [uuid(), user_id, content_id, action_type]);
    
    // 获取积分规则
    const rule = await get('SELECT points_value, daily_limit FROM point_rules WHERE action_type = ? AND is_active = 1', [action_type]);
    
    let pointsEarned = 0;
    if (rule && rule.points_value > 0) {
      // 检查每日上限
      if (rule.daily_limit > 0) {
        const todayCount = await get(`
          SELECT COUNT(*) as count FROM user_actions 
          WHERE user_id = ? AND action_type = ? AND DATE(created_at) = DATE('now')
        `, [user_id, action_type]);
        
        if (todayCount.count <= rule.daily_limit) {
          pointsEarned = rule.points_value;
        }
      } else {
        pointsEarned = rule.points_value;
      }
      
      // 增加积分
      if (pointsEarned > 0) {
        await run(`
          INSERT INTO user_points (user_id, total_points, available_points) VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET 
            total_points = total_points + ?,
            available_points = available_points + ?
        `, [user_id, pointsEarned, pointsEarned, pointsEarned, pointsEarned]);
        
        await run('INSERT INTO point_transactions (id, user_id, points, transaction_type, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)',
          [uuid(), user_id, pointsEarned, 'earn_action', content_id, `行为奖励: ${action_type}`]);
      }
    }
    
    console.log(`   → ✅ 行为已记录，获得 ${pointsEarned} 积分`);
    res.json({ success: true, points_earned: pointsEarned });
  } catch (error) {
    console.error('记录行为失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 打卡系统API
// ============================================

// API: POST /api/checkin - 用户打卡
app.post('/api/checkin', async (req, res) => {
  try {
    const { user_id } = req.body;
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n📡 [API] POST /api/checkin - 用户: ${user_id}, 日期: ${today}`);
    
    // 检查今天是否已打卡
    const alreadyChecked = await get('SELECT 1 FROM check_in_records WHERE user_id = ? AND check_in_date = ?', [user_id, today]);
    
    if (alreadyChecked) {
      console.log('   → ⚠️ 今天已经打卡过了');
      return res.json({ success: false, message: '今天已经打卡过了', streak: 0, points_earned: 0 });
    }
    
    // 获取打卡统计
    const stats = await get('SELECT current_streak, last_check_in_date FROM check_in_stats WHERE user_id = ?', [user_id]);
    
    let currentStreak = 1;
    if (stats) {
      const lastDate = new Date(stats.last_check_in_date);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak = stats.current_streak + 1;
      } else if (diffDays > 1) {
        currentStreak = 1; // 断签
      }
    }
    
    // 计算积分
    const basePoints = 10;
    const bonusPoints = Math.min(currentStreak - 1, 10) * 2;
    const pointsEarned = basePoints + bonusPoints;
    
    // 插入打卡记录
    await run('INSERT INTO check_in_records (id, user_id, check_in_date, streak_count, points_earned) VALUES (?, ?, ?, ?, ?)',
      [uuid(), user_id, today, currentStreak, pointsEarned]);
    
    // 更新打卡统计
    await run(`
      INSERT INTO check_in_stats (user_id, current_streak, longest_streak, total_check_ins, last_check_in_date)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        current_streak = ?,
        longest_streak = MAX(longest_streak, ?),
        total_check_ins = total_check_ins + 1,
        last_check_in_date = ?
    `, [user_id, currentStreak, currentStreak, today, currentStreak, currentStreak, today]);
    
    // 增加积分
    await run(`
      INSERT INTO user_points (user_id, total_points, available_points) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET 
        total_points = total_points + ?,
        available_points = available_points + ?
    `, [user_id, pointsEarned, pointsEarned, pointsEarned, pointsEarned]);
    
    await run('INSERT INTO point_transactions (id, user_id, points, transaction_type, description) VALUES (?, ?, ?, ?, ?)',
      [uuid(), user_id, pointsEarned, 'earn_checkin', `打卡奖励(连续${currentStreak}天)`]);
    
    console.log(`   → ✅ 打卡成功！连续 ${currentStreak} 天，获得 ${pointsEarned} 积分`);
    res.json({
      success: true,
      streak: currentStreak,
      points_earned: pointsEarned,
      message: `打卡成功！连续${currentStreak}天`
    });
  } catch (error) {
    console.error('打卡失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: GET /api/checkin/progress - 获取打卡进度
app.get('/api/checkin/progress', async (req, res) => {
  try {
    const user_id = req.query.user_id;
    console.log(`\n📡 [API] GET /api/checkin/progress - 用户: ${user_id}`);
    
    const stats = await get('SELECT * FROM check_in_stats WHERE user_id = ?', [user_id]);
    const today = new Date().toISOString().split('T')[0];
    const checkedToday = stats?.last_check_in_date === today;
    
    const recentRecords = await query(
      'SELECT check_in_date, streak_count, points_earned FROM check_in_records WHERE user_id = ? ORDER BY check_in_date DESC LIMIT 7',
      [user_id]
    );
    
    console.log(`   → 连续: ${stats?.current_streak || 0}天, 今日已打卡: ${checkedToday}`);
    res.json({
      success: true,
      data: {
        current_streak: stats?.current_streak || 0,
        longest_streak: stats?.longest_streak || 0,
        total_check_ins: stats?.total_check_ins || 0,
        last_check_in_date: stats?.last_check_in_date,
        checked_today: checkedToday,
        recent_records: recentRecords
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: GET /api/checkin/leaderboard - 打卡排行榜
app.get('/api/checkin/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    console.log(`\n📡 [API] GET /api/checkin/leaderboard - 获取Top${limit}`);
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const leaderboard = await query(`
      SELECT user_id, current_streak, longest_streak, total_check_ins
      FROM check_in_stats 
      WHERE last_check_in_date >= ?
      ORDER BY current_streak DESC, total_check_ins DESC
      LIMIT ?
    `, [yesterday, limit]);
    
    // 添加排名
    leaderboard.forEach((item, index) => {
      item.rank = index + 1;
    });
    
    console.log(`   → 返回 ${leaderboard.length} 名用户`);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 奖励系统API
// ============================================

// API: GET /api/rewards - 获取所有奖励
app.get('/api/rewards', async (req, res) => {
  try {
    const user_id = req.query.user_id;
    console.log(`\n📡 [API] GET /api/rewards - 用户: ${user_id}`);
    
    const rewards = await query(`
      SELECT r.*, (ur.id IS NOT NULL) as is_unlocked, ur.unlocked_at, ur.is_equipped
      FROM rewards r
      LEFT JOIN user_rewards ur ON r.id = ur.reward_id AND ur.user_id = ?
      WHERE r.is_active = 1
      ORDER BY r.sort_order
    `, [user_id]);
    
    console.log(`   → 返回 ${rewards.length} 个奖励`);
    res.json({ success: true, data: rewards });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: POST /api/rewards/unlock - 解锁奖励
app.post('/api/rewards/unlock', async (req, res) => {
  try {
    const { user_id, reward_id } = req.body;
    console.log(`\n📡 [API] POST /api/rewards/unlock - 用户: ${user_id}, 奖励: ${reward_id}`);
    
    // 检查是否已解锁
    const alreadyUnlocked = await get('SELECT 1 FROM user_rewards WHERE user_id = ? AND reward_id = ?', [user_id, reward_id]);
    if (alreadyUnlocked) {
      return res.json({ success: false, message: '已经解锁过了' });
    }
    
    // 获取奖励要求
    const reward = await get('SELECT * FROM rewards WHERE id = ? AND is_active = 1', [reward_id]);
    if (!reward) {
      return res.json({ success: false, message: '奖励不存在' });
    }
    
    // 获取用户数据
    const userPoints = await get('SELECT available_points FROM user_points WHERE user_id = ?', [user_id]);
    const userStreak = await get('SELECT current_streak FROM check_in_stats WHERE user_id = ?', [user_id]);
    
    const availablePoints = userPoints?.available_points || 0;
    const currentStreak = userStreak?.current_streak || 0;
    
    // 检查条件
    if (reward.required_points > 0 && availablePoints < reward.required_points) {
      return res.json({ success: false, message: `积分不足，需要${reward.required_points}分` });
    }
    if (reward.required_streak > 0 && currentStreak < reward.required_streak) {
      return res.json({ success: false, message: `连续打卡天数不足，需要${reward.required_streak}天` });
    }
    
    // 扣除积分
    if (reward.required_points > 0) {
      await run('UPDATE user_points SET available_points = available_points - ? WHERE user_id = ?', [reward.required_points, user_id]);
      await run('INSERT INTO point_transactions (id, user_id, points, transaction_type, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid(), user_id, -reward.required_points, 'spend_reward', reward_id, `解锁奖励: ${reward.name}`]);
    }
    
    // 解锁奖励
    await run('INSERT INTO user_rewards (id, user_id, reward_id) VALUES (?, ?, ?)', [uuid(), user_id, reward_id]);
    
    console.log(`   → ✅ 解锁成功: ${reward.name}`);
    res.json({ success: true, message: '解锁成功', reward_name: reward.name });
  } catch (error) {
    console.error('解锁奖励失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 推荐服务 API 服务器运行在 http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 API接口列表:');
  console.log('   POST /api/social/follow         关注用户');
  console.log('   DELETE /api/social/follow       取消关注');
  console.log('   POST /api/social/friend/request 发送好友请求');
  console.log('   GET  /api/gifts                 获取礼物列表');
  console.log('   POST /api/gift/send             发送礼物');
  console.log('   GET  /api/points                获取积分');
  console.log('   POST /api/action/record         记录行为');
  console.log('   POST /api/checkin               打卡');
  console.log('   GET  /api/checkin/progress      打卡进度');
  console.log('   GET  /api/checkin/leaderboard   打卡排行榜');
  console.log('   GET  /api/rewards               获取奖励列表');
  console.log('   POST /api/rewards/unlock        解锁奖励');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
