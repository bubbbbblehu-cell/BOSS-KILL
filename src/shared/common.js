// 保存数据到手机本地存储
const Storage = {
    savePoops: (count) => localStorage.setItem('user_poops', count),
    getPoops: () => parseInt(localStorage.getItem('user_poops')) || 0,
    
    // 跨页面跳转
    goTo: (path) => { window.location.href = path; }
};

// 页面加载时自动打印当前路径，方便调试
console.log("当前所在模块:", window.location.pathname);
