/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// 历史记录数据结构
interface HistoryRecord {
  id: string;
  text: string;
  createdAt: number;
}

interface HistoryResult {
  success: boolean;
  message?: string;
  record?: HistoryRecord;
}

// 历史记录 API 接口
interface HistoryAPI {
  getAll: () => Promise<HistoryRecord[]>;
  add: (text: string) => Promise<HistoryResult>;
  delete: (id: string) => Promise<HistoryResult>;
  clear: () => Promise<HistoryResult>;
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer;
  historyAPI: HistoryAPI;
}
