import { app, BrowserWindow, shell, dialog, session, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pkg from "electron-updater";
import Store from "electron-store";

const { autoUpdater } = pkg;
app.setName("ONEAI");

// ==================== 历史记录存储 ====================
// 历史记录数据结构
interface HistoryRecord {
  id: string;
  text: string;
  createdAt: number; // 时间戳
}

// 初始化 electron-store 用于存储历史记录
const historyStore = new Store<{ searchHistory: HistoryRecord[] }>({
  name: "search-history",
  defaults: {
    searchHistory: [],
  },
});

// 历史记录最大条数
const MAX_HISTORY_COUNT = 1000;

// IPC 通道：获取历史记录列表
ipcMain.handle("history:getAll", () => {
  const history = historyStore.get("searchHistory", []);
  // 按时间倒序返回
  return [...history].sort((a, b) => b.createdAt - a.createdAt);
});

// IPC 通道：添加历史记录
ipcMain.handle("history:add", (_event, text: string) => {
  if (!text || !text.trim()) {
    return { success: false, message: "文本不能为空" };
  }

  const trimmedText = text.trim();
  const history = historyStore.get("searchHistory", []);

  // 创建新记录
  const newRecord: HistoryRecord = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text: trimmedText,
    createdAt: Date.now(),
  };

  // 添加到头部
  history.unshift(newRecord);

  // FIFO 策略：超过最大条数时删除最老的
  if (history.length > MAX_HISTORY_COUNT) {
    history.splice(MAX_HISTORY_COUNT);
  }

  historyStore.set("searchHistory", history);
  return { success: true, record: newRecord };
});

// IPC 通道：删除单条历史记录
ipcMain.handle("history:delete", (_event, id: string) => {
  const history = historyStore.get("searchHistory", []);
  const index = history.findIndex((item) => item.id === id);

  if (index === -1) {
    return { success: false, message: "记录不存在" };
  }

  history.splice(index, 1);
  historyStore.set("searchHistory", history);
  return { success: true };
});

// IPC 通道：清空所有历史记录
ipcMain.handle("history:clear", () => {
  historyStore.set("searchHistory", []);
  return { success: true };
});

// 添加崩溃处理
app.on("render-process-gone", (event, webContents, details) => {
  console.error("❌ Render process gone:", details);
  if (details.reason === "crashed" || details.reason === "oom") {
    console.error("应用因内存问题崩溃，原因:", details.reason);
  }
});

// 添加未捕获异常处理
process.on("uncaughtException", (error) => {
  console.error("❌ 未捕获的异常:", error);
});

// 监听子进程崩溃
app.on("child-process-gone", (event, details) => {
  console.error("❌ Child process gone:", details);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 在生产环境中使用 app.getAppPath() 获取正确的应用路径
// 在开发环境中使用相对路径
const getAppRoot = () => {
  if (app.isPackaged) {
    return app.getAppPath();
  }
  return path.join(__dirname, "..");
};

process.env.APP_ROOT = getAppRoot();

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

async function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || "", "electron-vite.svg"),
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      webviewTag: true,
    },
  });

  // 统一处理主窗口中通过 window.open / target=_blank 打开的链接
  // 在主窗口内禁止新建 Electron 窗口，改为使用系统默认浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log("🔗 [main] window.open 捕获，转到默认浏览器:", url);
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  // 仅在开发环境下注册开发者工具快捷键（使用窗口级别的键盘事件，而非全局快捷键）
  if (VITE_DEV_SERVER_URL) {
    win.webContents.on("before-input-event", (event, input) => {
      // Command+Option+I (macOS) 或 Ctrl+Shift+I (Windows/Linux)
      if (
        (input.meta && input.alt && input.key === "i") ||
        (input.control && input.shift && input.key === "I")
      ) {
        win?.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }
}

// OAuth 登录相关的域名白名单（这些域名的弹窗需要在应用内打开）
const OAUTH_DOMAINS = [
  // ============ 国际通用 OAuth 提供商 ============
  "accounts.google.com",      // Google 登录
  "login.microsoftonline.com", // Microsoft 登录
  "login.live.com",           // Microsoft Live
  "appleid.apple.com",        // Apple 登录
  "github.com",               // GitHub 登录
  "auth0.com",                // Auth0
  "x.com",                    // X/Twitter 登录 (Grok)
  "twitter.com",              // Twitter 登录

  // ============ 中国主流 OAuth 提供商 ============
  // 微信系
  "open.weixin.qq.com",       // 微信开放平台
  "wx.qq.com",                // 微信
  "weixin.qq.com",            // 微信
  // QQ 系
  "graph.qq.com",             // QQ 互联
  "connect.qq.com",           // QQ 登录
  "ssl.ptlogin2.qq.com",      // QQ 安全登录
  "xui.ptlogin2.qq.com",      // QQ 登录
  "ui.ptlogin2.qq.com",       // QQ 登录
  // 阿里系
  "login.taobao.com",         // 淘宝登录
  "login.alipay.com",         // 支付宝登录
  "authz.alipay.com",         // 支付宝授权
  "auth.alipay.com",          // 支付宝认证
  "passport.aliyun.com",      // 阿里云登录
  // 字节系
  "sso.douyin.com",           // 抖音 SSO
  "open.douyin.com",          // 抖音开放平台
  "passport.feishu.cn",       // 飞书登录
  "login.feishu.cn",          // 飞书登录
  // 腾讯系
  "passport.tencent.com",     // 腾讯通行证
  "ssl.captcha.qq.com",       // 腾讯验证码

  // ============ AI 应用自身的登录域名 ============
  // DeepSeek
  "chat.deepseek.com",
  // 腾讯元宝
  "yuanbao.tencent.com",
  // Kimi
  "kimi.moonshot.cn",
  "account.moonshot.cn",
  // 豆包
  "www.doubao.com",
  "sso.doubao.com",
  // 通义千问
  "tongyi.aliyun.com",
  "qianwen.aliyun.com",
  // 海螺 MiniMax
  "chat.minimaxi.com",
  // 智谱
  "chatglm.cn",
  "open.bigmodel.cn",
  // 百川
  "ying.baichuan-ai.com",
  // Stepfun
  "stepfun.com",
  // ChatGPT
  "chatgpt.com",
  "auth.openai.com",
  "auth0.openai.com",
  // Gemini
  "gemini.google.com",
  // Grok
  "grok.com",
  // LM Arena
  "lmarena.ai",

  // ============ 通用登录关键词（路径匹配） ============
  "oauth",
  "login",
  "signin",
  "sign-in",
  "auth",
  "sso",
  "passport",
  "account",
  "authorize",
  "callback",
];

// 判断 URL 是否是 OAuth 相关的登录页面
const isOAuthUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    
    return OAUTH_DOMAINS.some(
      (domain) => hostname.includes(domain) || pathname.includes(domain)
    );
  } catch {
    return false;
  }
};

// 判断 URL 是否应该在外部浏览器打开（非登录相关的外部链接）
const shouldOpenExternal = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // 如果是 OAuth 相关的 URL，不要在外部打开
    if (isOAuthUrl(url)) {
      return false;
    }
    
    // 检查是否是 AI 应用的域名（不应该在外部打开）
    const aiAppDomains = [
      "chatgpt.com", "openai.com",
      "chat.deepseek.com", "deepseek.com",
      "yuanbao.tencent.com",
      "kimi.moonshot.cn", "moonshot.cn",
      "doubao.com",
      "qianwen.com", "tongyi.aliyun.com",
      "minimaxi.com",
      "chatglm.cn", "bigmodel.cn",
      "baichuan-ai.com",
      "stepfun.com",
      "gemini.google.com",
      "grok.com",
      "lmarena.ai",
      "claude.ai", "anthropic.com",
    ];
    
    // 如果是 AI 应用域名，不在外部打开
    if (aiAppDomains.some(domain => hostname.includes(domain))) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

// 处理所有 webContents（包括 <webview>）中新窗口的打开行为
app.on("web-contents-created", (_event, contents) => {
  const contentType = contents.getType();
  console.log("📌 [main] web-contents-created, type:", contentType);

  if (contentType === "webview") {
    console.log("📌 [main] webview 创建，设置 window open handler");
    
    // 为 webview 设置正常浏览器的 User-Agent
    const chromeUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    contents.setUserAgent(chromeUserAgent);
    
    // 监听 webview 导航，用于调试
    contents.on("did-start-navigation", (_event, url) => {
      console.log("🚀 [main] webview 开始导航:", url);
    });
    
    contents.on("did-navigate", (_event, url) => {
      console.log("✅ [main] webview 导航完成:", url);
    });
    
    contents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      console.log("❌ [main] webview 加载失败:", errorCode, errorDescription, validatedURL);
    });
    
    // 拦截 webview 中通过 window.open / target=_blank 打开的新窗口
    // 只有打开新窗口的场景才使用外部浏览器打开
    contents.setWindowOpenHandler(({ url }) => {
      console.log("🔗 [main] webview window.open 捕获:", url);

      // 判断是否应该在外部浏览器打开
      if (shouldOpenExternal(url)) {
        console.log("🌐 [main] 外部链接，使用默认浏览器:", url);
        shell.openExternal(url);
        return { action: "deny" };
      }

      // OAuth 或 AI 应用相关的 URL，在应用内新窗口打开
      console.log("🔐 [main] 内部链接，创建应用内窗口:", url);
      
      // 获取与 webview 相同的 session（partition: persist:webview）
      const webviewSession = session.fromPartition("persist:webview");
      
      // 设置正常浏览器的 User-Agent（避免被检测为非标准浏览器）
      const chromeUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      webviewSession.setUserAgent(chromeUserAgent);
      
      // 创建一个新的 BrowserWindow
      const popupWindow = new BrowserWindow({
        width: 800,
        height: 700,
        parent: win || undefined,
        modal: false,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          session: webviewSession, // 共享 session
        },
      });
      
      popupWindow.loadURL(url);

      // 处理弹窗内部的新窗口请求（递归处理）
      popupWindow.webContents.setWindowOpenHandler(({ url: innerUrl }) => {
        console.log("🔗 [main] 弹窗内部链接:", innerUrl);
        if (shouldOpenExternal(innerUrl)) {
          shell.openExternal(innerUrl);
          return { action: "deny" };
        }
        // 在同一个窗口内打开
        popupWindow.loadURL(innerUrl);
        return { action: "deny" };
      });

      // 监听页面导航，处理登录完成后的重定向回调
      popupWindow.webContents.on("will-navigate", (_event, navUrl) => {
        console.log("🔄 [main] 弹窗导航:", navUrl);
        
        // 如果重定向回 AI 应用主页面，关闭弹窗
        const aiAppMainUrls = [
          "chatgpt.com", "chat.openai.com",
          "chat.deepseek.com",
          "kimi.moonshot.cn",
        ];
        try {
          const navUrlObj = new URL(navUrl);
          if (aiAppMainUrls.some(domain => navUrlObj.hostname.includes(domain)) && 
              !navUrl.includes("auth") && !navUrl.includes("login")) {
            console.log("✅ [main] 登录完成，关闭弹窗");
            setTimeout(() => popupWindow.close(), 500);
          }
        } catch {}
      });
      
      return { action: "deny" };
    });

    // 注意：不再拦截 will-navigate 事件
    // 让 webview 内部的页面跳转正常工作，这对于登录流程至关重要
    // 拦截 webview 内部的页面跳转
    // 只拦截外域链接，同域链接允许正常导航（如新建会话）
    contents.on("will-navigate", (event, url) => {
      try {
        const currentUrl = contents.getURL();
        const currentOrigin = currentUrl ? new URL(currentUrl).origin : null;
        const targetOrigin = new URL(url).origin;

        // 同域导航：允许在 webview 内正常跳转
        if (currentOrigin && currentOrigin === targetOrigin) {
          console.log("🔗 [main] webview will-navigate 同域跳转，允许:", url);
          return;
        }

        // 外域导航：使用默认浏览器打开
        console.log(
          "🔗 [main] webview will-navigate 外域跳转，转到默认浏览器:",
          url
        );
        event.preventDefault();
        shell.openExternal(url);
      } catch (error) {
        // URL 解析失败时，默认用浏览器打开
        console.error("🔗 [main] URL 解析失败，转到默认浏览器:", url, error);
        event.preventDefault();
        shell.openExternal(url);
      }
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  console.log("🚀 Application started");
  createWindow();

  // 自动更新：检查 GitHub Releases 上的新版本
  try {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on("error", (error) => {
      console.error("❌ Auto update error:", (error as Error).message);
    });

    autoUpdater.on("update-available", (info) => {
      console.log("⬆️ Update available:", info.version);
    });

    autoUpdater.on("update-downloaded", () => {
      dialog
        .showMessageBox({
          type: "info",
          buttons: ["立即重启", "稍后"],
          defaultId: 0,
          cancelId: 1,
          title: "发现新版本",
          message: "新版本已下载，是否立即重启并安装更新？",
        })
        .then((result) => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall();
          }
        });
    });
  } catch (error) {
    console.error("❌ Failed to init auto updater:", (error as Error).message);
  }
});
