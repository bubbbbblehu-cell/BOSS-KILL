// Node.js API 服务 - 激励文字接口演示
const express = require('express');
const cors = require('cors');
const { getRandomQuote, getAllQuotes } = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ============================================================
// API: GET /api/quotes/random
// 功能: 获取随机激励文字
// 对应前端: MotivationalQuotesService.getRandomQuote()
// 对应数据库: get_random_motivational_quote() 存储过程
// ============================================================
app.get('/api/quotes/random', async (req, res) => {
  console.log('\n📥 收到请求: GET /api/quotes/random');
  console.log('⏳ 步骤3-4: Node.js API 调用数据库...');
  
  try {
    // 步骤4: 执行数据库查询（模拟存储过程）
    const quote = await getRandomQuote();
    
    console.log('✅ 步骤5: 数据库返回数据:', quote);
    
    if (quote) {
      // 步骤6: 返回JSON响应
      const response = {
        success: true,
        data: {
          id: quote.id,
          text: quote.text,
          category: quote.category,
          author: quote.author
        }
      };
      console.log('📤 步骤6: API返回JSON响应');
      res.json(response);
    } else {
      res.status(404).json({ success: false, message: '没有可用的激励文字' });
    }
  } catch (error) {
    console.error('❌ 错误:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: GET /api/quotes - 获取所有激励文字
app.get('/api/quotes', async (req, res) => {
  try {
    const quotes = await getAllQuotes();
    res.json({ success: true, data: quotes, total: quotes.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     BOSS KILL 激励文字 API 服务已启动                      ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 服务地址: http://localhost:${PORT}                       ║`);
  console.log('║                                                           ║');
  console.log('║  📚 可用接口:                                              ║');
  console.log('║    GET /api/quotes/random  - 获取随机激励文字              ║');
  console.log('║    GET /api/quotes         - 获取所有激励文字              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
});
