/**
 * 推荐服务 前端模拟客户端
 * 演示社交、礼物、积分、打卡等功能的完整调用流程
 */

const http = require('http');

const API_BASE = 'http://localhost:3003';
const TEST_USER_ID = 'demo_user_001';
const TARGET_USER_ID = 'user_002';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } 
        catch (e) { resolve(body); }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// API方法封装
const RecommendationService = {
  followUser: (followerId, followingId) => 
    request('POST', '/api/social/follow', { follower_id: followerId, following_id: followingId }),
  unfollowUser: (followerId, followingId) => 
    request('DELETE', `/api/social/follow?follower_id=${followerId}&following_id=${followingId}`),
  addFriend: (userId, friendId) => 
    request('POST', '/api/social/friend/request', { user_id: userId, friend_id: friendId }),
  getGifts: () => request('GET', '/api/gifts'),
  sendGift: (senderId, receiverId, giftId, message) => 
    request('POST', '/api/gift/send', { sender_id: senderId, receiver_id: receiverId, gift_id: giftId, message }),
  getPoints: (userId) => request('GET', `/api/points?user_id=${userId}`),
  recordAction: (userId, contentId, actionType) => 
    request('POST', '/api/action/record', { user_id: userId, content_id: contentId, action_type: actionType }),
  checkIn: (userId) => request('POST', '/api/checkin', { user_id: userId }),
  getCheckInProgress: (userId) => request('GET', `/api/checkin/progress?user_id=${userId}`),
  getLeaderboard: (limit) => request('GET', `/api/checkin/leaderboard?limit=${limit}`),
  getRewards: (userId) => request('GET', `/api/rewards?user_id=${userId}`),
  unlockReward: (userId, rewardId) => request('POST', '/api/rewards/unlock', { user_id: userId, reward_id: rewardId }),
};

function printSeparator(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printBox(title, content) {
  console.log(`\n  ┌${'─'.repeat(50)}┐`);
  console.log(`  │ ${title.padEnd(48)}│`);
  console.log(`  ├${'─'.repeat(50)}┤`);
  if (Array.isArray(content)) {
    content.forEach(line => console.log(`  │ ${line.padEnd(48)}│`));
  } else {
    console.log(`  │ ${content.padEnd(48)}│`);
  }
  console.log(`  └${'─'.repeat(50)}┘`);
}

async function runDemo() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              BOSS KILL 推荐服务 演示                        ║');
  console.log('║       社交 · 礼物 · 积分 · 打卡 完整调用流程                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n👤 演示用户: ${TEST_USER_ID}`);

  try {
    // ====== 流程1: 查看用户积分 ======
    printSeparator('流程1: 查看用户积分');
    console.log('\n📱 [前端] 获取用户积分信息');
    const pointsResult = await RecommendationService.getPoints(TEST_USER_ID);
    
    if (pointsResult.success) {
      printBox('💰 用户积分', [
        `总积分: ${pointsResult.data.total_points}`,
        `可用积分: ${pointsResult.data.available_points}`,
        `等级: Lv.${pointsResult.data.level}`,
      ]);
    }

    // ====== 流程2: 打卡 ======
    printSeparator('流程2: 每日打卡');
    console.log('\n📱 [前端] 用户点击打卡按钮');
    console.log('   → 发起请求: POST /api/checkin');
    
    const checkInResult = await RecommendationService.checkIn(TEST_USER_ID);
    
    if (checkInResult.success) {
      printBox('🎯 打卡成功', [
        `连续打卡: ${checkInResult.streak} 天`,
        `获得积分: +${checkInResult.points_earned} 分`,
        `积分计算: 基础10分 + 连续奖励${checkInResult.points_earned - 10}分`,
      ]);
    } else {
      console.log(`\n   ⚠️ ${checkInResult.message}`);
    }

    // ====== 流程3: 查看打卡进度 ======
    printSeparator('流程3: 查看打卡进度');
    console.log('\n📱 [前端] 获取打卡进度详情');
    
    const progressResult = await RecommendationService.getCheckInProgress(TEST_USER_ID);
    
    if (progressResult.success) {
      const data = progressResult.data;
      printBox('📊 打卡统计', [
        `当前连续: ${data.current_streak} 天`,
        `历史最长: ${data.longest_streak} 天`,
        `累计打卡: ${data.total_check_ins} 次`,
        `今日已打卡: ${data.checked_today ? '✅' : '❌'}`,
      ]);
    }

    // ====== 流程4: 打卡排行榜 ======
    printSeparator('流程4: 打卡排行榜');
    console.log('\n📱 [前端] 获取打卡排行榜 Top5');
    
    const leaderboardResult = await RecommendationService.getLeaderboard(5);
    
    if (leaderboardResult.success && leaderboardResult.data.length > 0) {
      console.log('\n  🏆 打卡排行榜');
      console.log('  ┌──────┬────────────────┬──────────┬──────────┐');
      console.log('  │ 排名 │ 用户ID          │ 连续天数  │ 总打卡    │');
      console.log('  ├──────┼────────────────┼──────────┼──────────┤');
      leaderboardResult.data.forEach(item => {
        const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '  ';
        console.log(`  │ ${medal}${String(item.rank).padStart(2)} │ ${item.user_id.padEnd(14)} │ ${String(item.current_streak).padStart(6)}天 │ ${String(item.total_check_ins).padStart(6)}次 │`);
      });
      console.log('  └──────┴────────────────┴──────────┴──────────┘');
    }

    // ====== 流程5: 关注用户 ======
    printSeparator('流程5: 社交交互 - 关注用户');
    console.log(`\n📱 [前端] 关注用户 ${TARGET_USER_ID}`);
    console.log('   → 发起请求: POST /api/social/follow');
    
    const followResult = await RecommendationService.followUser(TEST_USER_ID, TARGET_USER_ID);
    console.log(`   → ${followResult.success ? '✅' : '⚠️'} ${followResult.message}`);

    // ====== 流程6: 发送好友请求 ======
    printSeparator('流程6: 社交交互 - 发送好友请求');
    console.log(`\n📱 [前端] 向 ${TARGET_USER_ID} 发送好友请求`);
    console.log('   → 发起请求: POST /api/social/friend/request');
    
    const friendResult = await RecommendationService.addFriend(TEST_USER_ID, TARGET_USER_ID);
    console.log(`   → ${friendResult.success ? '✅' : '⚠️'} ${friendResult.message}`);

    // ====== 流程7: 查看礼物列表 ======
    printSeparator('流程7: 礼物系统 - 查看礼物');
    console.log('\n📱 [前端] 获取可用礼物列表');
    
    const giftsResult = await RecommendationService.getGifts();
    
    if (giftsResult.success && giftsResult.data.length > 0) {
      console.log('\n  🎁 可用礼物');
      console.log('  ┌──────────────┬──────────┬────────────┐');
      console.log('  │ 礼物名称      │ 所需积分  │ 特效类型    │');
      console.log('  ├──────────────┼──────────┼────────────┤');
      giftsResult.data.forEach(gift => {
        console.log(`  │ ${gift.name.padEnd(10)} │ ${String(gift.price_points).padStart(6)}分 │ ${(gift.effect_type || '-').padEnd(10)} │`);
      });
      console.log('  └──────────────┴──────────┴────────────┘');
    }

    // ====== 流程8: 发送礼物 ======
    printSeparator('流程8: 礼物系统 - 发送礼物');
    console.log(`\n📱 [前端] 向 ${TARGET_USER_ID} 发送"小红花"礼物`);
    console.log('   → 发起请求: POST /api/gift/send');
    
    const sendGiftResult = await RecommendationService.sendGift(TEST_USER_ID, TARGET_USER_ID, 'gift_001', '感谢你的便便作品！');
    
    if (sendGiftResult.success) {
      console.log(`\n   ✅ ${sendGiftResult.message}`);
      console.log(`   → 花费: ${sendGiftResult.points_spent} 积分`);
    } else {
      console.log(`\n   ⚠️ ${sendGiftResult.message}`);
    }

    // ====== 流程9: 记录用户行为 ======
    printSeparator('流程9: 行为记录 - 获取积分');
    console.log('\n📱 [前端] 用户浏览内容、点赞、收藏');
    
    const actions = [
      { type: 'view', name: '浏览' },
      { type: 'like', name: '点赞' },
      { type: 'favorite', name: '收藏' },
    ];
    
    let totalEarned = 0;
    for (const action of actions) {
      const result = await RecommendationService.recordAction(TEST_USER_ID, 'content_001', action.type);
      console.log(`   → ${action.name}: +${result.points_earned} 积分`);
      totalEarned += result.points_earned;
    }
    console.log(`\n   📊 本轮行为总计获得: ${totalEarned} 积分`);

    // ====== 流程10: 查看奖励 ======
    printSeparator('流程10: 奖励系统');
    console.log('\n📱 [前端] 获取可解锁奖励列表');
    
    const rewardsResult = await RecommendationService.getRewards(TEST_USER_ID);
    
    if (rewardsResult.success && rewardsResult.data.length > 0) {
      console.log('\n  🏅 奖励列表');
      console.log('  ┌──────────────────┬────────────┬──────────┬──────────┬────────┐');
      console.log('  │ 奖励名称          │ 类型        │ 需要积分  │ 需打卡    │ 状态   │');
      console.log('  ├──────────────────┼────────────┼──────────┼──────────┼────────┤');
      rewardsResult.data.forEach(reward => {
        const status = reward.is_unlocked ? '✅已解锁' : '🔒未解锁';
        console.log(`  │ ${reward.name.padEnd(14)} │ ${reward.reward_type.padEnd(10)} │ ${String(reward.required_points).padStart(6)}分 │ ${String(reward.required_streak).padStart(6)}天 │ ${status} │`);
      });
      console.log('  └──────────────────┴────────────┴──────────┴──────────┴────────┘');
    }

    // ====== 流程11: 解锁奖励 ======
    printSeparator('流程11: 解锁奖励');
    console.log('\n📱 [前端] 尝试解锁"基础便便贴纸包"');
    console.log('   → 发起请求: POST /api/rewards/unlock');
    
    const unlockResult = await RecommendationService.unlockReward(TEST_USER_ID, 'reward_101');
    console.log(`   → ${unlockResult.success ? '✅' : '⚠️'} ${unlockResult.message}`);

    // ====== 流程12: 最终积分 ======
    printSeparator('流程12: 最终积分统计');
    const finalPoints = await RecommendationService.getPoints(TEST_USER_ID);
    
    if (finalPoints.success) {
      printBox('💰 最终积分', [
        `总积分: ${finalPoints.data.total_points}`,
        `可用积分: ${finalPoints.data.available_points}`,
        `等级: Lv.${finalPoints.data.level}`,
      ]);
    }

    // ====== 演示完成 ======
    printSeparator('演示完成');
    console.log('\n✅ 推荐服务演示完成！');
    console.log('\n📝 功能总结:');
    console.log('   📌 社交功能: 关注、好友请求');
    console.log('   🎁 礼物系统: 查看礼物、发送礼物');
    console.log('   💰 积分系统: 行为奖励、积分消费');
    console.log('   🎯 打卡系统: 每日打卡、连续奖励、排行榜');
    console.log('   🏅 奖励系统: 奖励列表、解锁奖励');
    console.log('\n🗄️ 数据库表:');
    console.log('   - user_follows: 关注关系');
    console.log('   - user_friends: 好友关系');
    console.log('   - gifts / gift_records: 礼物定义与发送记录');
    console.log('   - user_points / point_transactions: 积分与变动');
    console.log('   - check_in_records / check_in_stats: 打卡记录与统计');
    console.log('   - rewards / user_rewards: 奖励定义与解锁');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ 演示出错:', error.message);
    console.log('\n请确保 recommendation-server.js 正在运行 (端口 3003)');
  }
}

runDemo();
