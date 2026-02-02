/**
 * 优化后的发帖与通知逻辑
 * 适配路径：src/modules/posts/
 */

// 1. 模拟数据库 (原本的 notification-db.js 逻辑)
let posts = [];

// 2. 发帖核心功能 (优化自 notification-demo-client.js)
export async function createPost(content) {
    console.log("正在尝试发布内容:", content);
    
    // 模拟后端处理 (原本的 notification-server.js 逻辑)
    const newPost = {
        id: Date.now(),
        content: content,
        timestamp: new Date().toLocaleString(),
        author: "测试用户"
    };

    posts.unshift(newPost); // 模拟存入数据库
    return { success: true, post: newPost };
}

// 3. 读取公共词库 (修正后的路径，访问你根目录或 shared 下的 JSON)
export async function fetchInspiration() {
    try {
        // 修正路径：从 /src/modules/posts/ 回退三级到根目录寻找文件
        const response = await fetch('../../../激励文字词库.json'); 
        const data = await response.json();
        return data;
    } catch (err) {
        console.error("词库加载失败，请检查文件名是否包含中文或路径:", err);
        return ["加油！", "你可以的！"]; // 失败时的兜底文字
    }
}
