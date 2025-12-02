/**
 * historyStore.ts
 * 历史记录存储操作封装
 * 在 Electron 环境中通过 historyAPI 与主进程通信
 * 在浏览器环境中使用 localStorage 作为降级方案
 */

// 历史记录最大条数
const MAX_HISTORY_COUNT = 1000;
const STORAGE_KEY = "oneai_search_history";

// 检查是否在 Electron 环境中
const isElectron = (): boolean => {
  return typeof window !== "undefined" && !!window.historyAPI;
};

// 浏览器环境降级方案：从 localStorage 获取历史记录
const getHistoryFromStorage = (): HistoryRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryRecord[];
  } catch {
    return [];
  }
};

// 浏览器环境降级方案：保存历史记录到 localStorage
const saveHistoryToStorage = (history: HistoryRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("[historyStore] 保存到 localStorage 失败:", error);
  }
};

// 获取所有历史记录（已按时间倒序排列）
export async function getHistoryList(): Promise<HistoryRecord[]> {
  try {
    if (isElectron()) {
      return await window.historyAPI.getAll();
    }
    // 浏览器降级方案
    const history = getHistoryFromStorage();
    return [...history].sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("[historyStore] 获取历史记录失败:", error);
    return [];
  }
}

// 添加历史记录
export async function addHistory(text: string): Promise<boolean> {
  try {
    if (isElectron()) {
      const result = await window.historyAPI.add(text);
      return result.success;
    }
    // 浏览器降级方案
    const trimmedText = text.trim();
    if (!trimmedText) return false;

    const history = getHistoryFromStorage();
    const newRecord: HistoryRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: trimmedText,
      createdAt: Date.now(),
    };
    history.unshift(newRecord);

    // FIFO 策略
    if (history.length > MAX_HISTORY_COUNT) {
      history.splice(MAX_HISTORY_COUNT);
    }

    saveHistoryToStorage(history);
    return true;
  } catch (error) {
    console.error("[historyStore] 添加历史记录失败:", error);
    return false;
  }
}

// 删除单条历史记录
export async function deleteHistory(id: string): Promise<boolean> {
  try {
    if (isElectron()) {
      const result = await window.historyAPI.delete(id);
      return result.success;
    }
    // 浏览器降级方案
    const history = getHistoryFromStorage();
    const index = history.findIndex((item) => item.id === id);
    if (index === -1) return false;
    history.splice(index, 1);
    saveHistoryToStorage(history);
    return true;
  } catch (error) {
    console.error("[historyStore] 删除历史记录失败:", error);
    return false;
  }
}

// 清空所有历史记录
export async function clearHistory(): Promise<boolean> {
  try {
    if (isElectron()) {
      const result = await window.historyAPI.clear();
      return result.success;
    }
    // 浏览器降级方案
    saveHistoryToStorage([]);
    return true;
  } catch (error) {
    console.error("[historyStore] 清空历史记录失败:", error);
    return false;
  }
}
