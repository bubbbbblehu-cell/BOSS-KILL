/**
 * 激励文字服务 前端模拟客户端
 * 演示激励文字的完整调用流程
 */

const http = require('http');

const API_BASE = 'http://localhost:3004';
const TEST_USER_ID = 'demo_user_001';

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
const MotivationalQuotesService = {
  getRandomQuote: () => request('GET', '/api/quotes/random'),
  getTodayQuote: (userId) => request('GET', `/api/quotes/today?user_id=${userId}`),
  recordUsage: (userId, quoteId, rating) => request('POST', '/api/quotes/usage', { user_id: userId, quote_id: quoteId, rating }),
  getCategories: () => request('GET', '/api/quotes/categories'),
  getQuotesByCategory: (category) => request('GET', `/api/quotes/category/${category}`),
  getAllQuotes: (page, pageSize) => request('GET', `/api/quotes?page=${page}&page_size=${pageSize}`),
  addQuote: (text, category, tags) => request('POST', '/api/quotes', { text, category, tags }),
  getStats: () => request('GET', '/api/quotes/stats'),
};

function printSeparator(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printQuoteBox(quote, label) {
  const categoryColor = {
    'motivation': '🟢',
    'humor': '🟠',
    'inspirational': '🔵',
    'sarcastic': '🔴'
  };
  
  console.log(`\n  ┌${'─'.repeat(56)}┐`);
  console.log(`  │ ${label || '📜 激励文字'}`.padEnd(58) + '│');
  console.log(`  ├${'─'.repeat(56)}┤`);
  
  // 文字内容（自动换行）
  const text = quote.text;
  const maxLen = 50;
  for (let i = 0; i < text.length; i += maxLen) {
    const line = text.substring(i, i + maxLen);
    console.log(`  │ "${line}"`.padEnd(58) + '│');
  }
  
  console.log(`  ├${'─'.repeat(56)}┤`);
  console.log(`  │ ${categoryColor[quote.category] || '⚪'} 分类: ${(quote.category_display || quote.category).padEnd(10)} 效果分: ${(quote.effectiveness_score || 0).toFixed(2)}`.padEnd(58) + '│');
  console.log(`  │ 🏷️  标签: ${(quote.tags || []).join(', ')}`.padEnd(56) + '│');
  console.log(`  │ 📊 使用次数: ${quote.usage_count || 0}`.padEnd(58) + '│');
  console.log(`  └${'─'.repeat(56)}┘`);
}

async function runDemo() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              BOSS KILL 激励文字服务 演示                     ║');
  console.log('║          随机文字 · 今日推荐 · 分类浏览 · 使用记录             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n👤 演示用户: ${TEST_USER_ID}`);

  try {
    // ====== 流程1: 获取随机激励文字 ======
    printSeparator('流程1: 获取随机激励文字');
    console.log('\n📱 [前端] 用户扔便便后展示激励文字');
    console.log('   → 发起请求: GET /api/quotes/random');
    
    const randomResult = await MotivationalQuotesService.getRandomQuote();
    
    if (randomResult.success) {
      printQuoteBox(randomResult.data, '🎲 随机激励文字');
    }

    // ====== 流程2: 获取今日推荐文字 ======
    printSeparator('流程2: 获取今日推荐文字（智能避重）');
    console.log('\n📱 [前端] 获取今日个性化推荐');
    console.log('   → 发起请求: GET /api/quotes/today?user_id=xxx');
    console.log('   → 算法: 优先展示效果分高、使用次数少、今日未展示的文字');
    
    const todayResult = await MotivationalQuotesService.getTodayQuote(TEST_USER_ID);
    
    if (todayResult.success) {
      printQuoteBox(todayResult.data, '⭐ 今日推荐');
      if (todayResult.note) {
        console.log(`\n   📝 ${todayResult.note}`);
      }
    }

    // ====== 流程3: 记录使用情况 ======
    printSeparator('流程3: 记录使用情况和评分');
    console.log('\n📱 [前端] 用户看到文字后，记录使用情况');
    console.log('   → 发起请求: POST /api/quotes/usage');
    console.log(`   → 参数: user_id=${TEST_USER_ID}, quote_id=${randomResult.data?.id}, rating=5`);
    
    if (randomResult.data) {
      const usageResult = await MotivationalQuotesService.recordUsage(TEST_USER_ID, randomResult.data.id, 5);
      console.log(`   → ${usageResult.success ? '✅' : '❌'} ${usageResult.message}`);
      console.log('   → 该数据将用于优化推荐算法');
    }

    // ====== 流程4: 获取分类列表 ======
    printSeparator('流程4: 获取文字分类列表');
    console.log('\n📱 [前端] 展示文字分类供用户浏览');
    console.log('   → 发起请求: GET /api/quotes/categories');
    
    const categoriesResult = await MotivationalQuotesService.getCategories();
    
    if (categoriesResult.success && categoriesResult.data.length > 0) {
      console.log('\n  📚 文字分类');
      console.log('  ┌────────────────┬──────────────┬────────┬──────────┐');
      console.log('  │ 分类名称        │ 显示名称      │ 文字数  │ 颜色      │');
      console.log('  ├────────────────┼──────────────┼────────┼──────────┤');
      categoriesResult.data.forEach(cat => {
        console.log(`  │ ${cat.name.padEnd(14)} │ ${cat.display_name.padEnd(10)} │ ${String(cat.quote_count).padStart(4)}条 │ ${cat.color.padEnd(8)} │`);
      });
      console.log('  └────────────────┴──────────────┴────────┴──────────┘');
    }

    // ====== 流程5: 按分类获取文字 ======
    printSeparator('流程5: 按分类获取文字');
    console.log('\n📱 [前端] 用户选择"激励类"分类');
    console.log('   → 发起请求: GET /api/quotes/category/motivation');
    
    const categoryQuotesResult = await MotivationalQuotesService.getQuotesByCategory('motivation');
    
    if (categoryQuotesResult.success && categoryQuotesResult.data.length > 0) {
      console.log(`\n  🟢 激励类文字 (共${categoryQuotesResult.data.length}条):`);
      categoryQuotesResult.data.slice(0, 3).forEach((q, i) => {
        console.log(`\n  ${i + 1}. "${q.text}"`);
        console.log(`     效果分: ${q.effectiveness_score.toFixed(2)} | 使用: ${q.usage_count}次`);
      });
      if (categoryQuotesResult.data.length > 3) {
        console.log(`\n  ... 还有 ${categoryQuotesResult.data.length - 3} 条`);
      }
    }

    // ====== 流程6: 再次获取今日推荐（测试避重） ======
    printSeparator('流程6: 再次获取今日推荐（测试避重机制）');
    console.log('\n📱 [前端] 再次请求今日推荐，验证避重机制');
    
    // 先记录上一个推荐的使用
    if (todayResult.data) {
      await MotivationalQuotesService.recordUsage(TEST_USER_ID, todayResult.data.id, 4);
      console.log(`   → 已记录上次推荐文字的使用`);
    }
    
    const todayResult2 = await MotivationalQuotesService.getTodayQuote(TEST_USER_ID);
    
    if (todayResult2.success) {
      printQuoteBox(todayResult2.data, '⭐ 今日推荐 #2');
      
      if (todayResult.data && todayResult2.data) {
        if (todayResult.data.id !== todayResult2.data.id) {
          console.log('\n   ✅ 避重机制生效：返回了不同的文字');
        } else {
          console.log('\n   ⚠️ 返回了相同文字（可能所有文字今日已展示）');
        }
      }
    }

    // ====== 流程7: 获取统计信息 ======
    printSeparator('流程7: 获取统计信息');
    console.log('\n📱 [前端] 管理后台查看统计');
    console.log('   → 发起请求: GET /api/quotes/stats');
    
    const statsResult = await MotivationalQuotesService.getStats();
    
    if (statsResult.success) {
      const stats = statsResult.data;
      console.log('\n  📊 统计信息');
      console.log(`  ├─ 总文字数: ${stats.total_quotes}`);
      console.log(`  ├─ 活跃文字: ${stats.active_quotes}`);
      console.log(`  ├─ 总使用次数: ${stats.total_usage}`);
      console.log(`  └─ 平均效果分: ${(stats.avg_effectiveness || 0).toFixed(2)}`);
      
      if (stats.categories && stats.categories.length > 0) {
        console.log('\n  📈 分类统计:');
        stats.categories.forEach(cat => {
          console.log(`     ${cat.category}: ${cat.count}条, 平均效果分 ${(cat.avg_score || 0).toFixed(2)}`);
        });
      }
    }

    // ====== 流程8: 添加新文字（管理员功能） ======
    printSeparator('流程8: 添加新文字（管理员功能）');
    console.log('\n📱 [管理后台] 添加新的激励文字');
    console.log('   → 发起请求: POST /api/quotes');
    
    const newQuote = {
      text: '每一个便便都是对工作压力的抗议！',
      category: 'humor',
      tags: ['工作', '压力', '抗议']
    };
    
    const addResult = await MotivationalQuotesService.addQuote(newQuote.text, newQuote.category, newQuote.tags);
    
    if (addResult.success) {
      console.log(`\n   ✅ 添加成功！ID: ${addResult.id}`);
      console.log(`   → 文字: "${newQuote.text}"`);
      console.log(`   → 分类: ${newQuote.category}`);
      console.log(`   → 标签: ${newQuote.tags.join(', ')}`);
    }

    // ====== 演示完成 ======
    printSeparator('演示完成');
    console.log('\n✅ 激励文字服务演示完成！');
    console.log('\n📝 功能总结:');
    console.log('   🎲 随机文字: 随机返回一条激励文字');
    console.log('   ⭐ 今日推荐: 智能避重，优先高效果分文字');
    console.log('   📊 使用记录: 记录展示情况和用户评分');
    console.log('   📚 分类浏览: 按分类查看文字');
    console.log('   ➕ 管理功能: 添加/修改/删除文字');
    console.log('\n🗄️ 数据库表:');
    console.log('   - motivational_quotes: 激励文字主表');
    console.log('   - user_quote_usage: 用户使用记录');
    console.log('   - quote_categories: 文字分类');
    console.log('\n🔄 推荐算法:');
    console.log('   1. 排除今日已展示文字');
    console.log('   2. 按效果分(effectiveness_score)降序');
    console.log('   3. 按使用次数(usage_count)升序');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ 演示出错:', error.message);
    console.log('\n请确保 quotes-server.js 正在运行 (端口 3004)');
  }
}

runDemo();
