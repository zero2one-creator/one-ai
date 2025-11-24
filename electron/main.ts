import { app, BrowserWindow, globalShortcut, shell } from "electron";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
import { fileURLToPath } from "node:url";
import path from "node:path";

app.setName("ONEAI");

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

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

// 安装 Vue Devtools（仅开发环境）--> 兼容问题，暂不能用
async function openDevTools() {
  if (!VITE_DEV_SERVER_URL) return;

  try {
    console.log("🔧 Installing Vue DevTools...");
    const name = await installExtension(VUEJS_DEVTOOLS, {
      loadExtensionOptions: {
        allowFileAccess: true,
      },
    });
    console.log(`✅ Vue DevTools installed: ${name}`);
  } catch (err) {
    console.error("❌ Vue DevTools installation failed:", err);
  }
}

async function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
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

    // 在页面加载完成后打开 DevTools（仅开发环境）
    if (VITE_DEV_SERVER_URL) {
      // 使用 'right' 模式将 DevTools 停靠在右侧，更方便查看
      win?.webContents.openDevTools({ mode: "right" });
      console.log("✅ DevTools opened in right mode");
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
    // win.loadURL("http://localhost:5173/index.html");
  }

  // macOS 打开开发者工具
  globalShortcut.register("Command+Option+I", () => {
    win?.webContents.toggleDevTools();
  });
}

// 处理所有 webContents（包括 <webview>）中新窗口的打开行为
// 对类型为 "webview" 的内容，同样使用默认浏览器打开外部链接
app.on("web-contents-created", (_event, contents) => {
  if (contents.getType() === "webview") {
    // 拦截 webview 中通过 window.open / target=_blank 打开的新窗口
    contents.setWindowOpenHandler(({ url }) => {
      console.log("🔗 [main] webview window.open 捕获，转到默认浏览器:", url);
      shell.openExternal(url);
      return { action: "deny" };
    });

    // 拦截 webview 内部的页面跳转（在当前窗口打开的链接）
    contents.on("will-navigate", (event, url) => {
      console.log("🔗 [main] webview will-navigate 捕获，转到默认浏览器:", url);
      event.preventDefault();
      shell.openExternal(url);
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
  await openDevTools();
  console.log("🚀 Application started");
  createWindow();
});
