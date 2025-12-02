<!--
  HistoryModal.vue
  历史记录弹窗组件，展示搜索历史列表，支持查看详情和删除
-->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="history-modal-backdrop"
      @click="closeModal"
    >
      <div class="history-modal" @click.stop>
        <div class="modal-header">
          <span class="modal-title">历史记录</span>
          <button class="close-button" @click="closeModal">×</button>
        </div>
        
        <div class="modal-content">
          <!-- 加载状态 -->
          <div v-if="loading" class="loading-state">
            <n-spin size="medium" />
            <span class="loading-text">加载中...</span>
          </div>

          <!-- 空状态 -->
          <div v-else-if="historyList.length === 0" class="empty-state">
            <n-empty description="暂无历史记录">
              <template #icon>
                <n-icon :size="48" :component="TimeOutline" />
              </template>
            </n-empty>
          </div>

          <!-- 历史记录列表 -->
          <div v-else class="history-scrollbar">
            <div class="history-list">
              <div
                v-for="item in historyList"
                :key="item.id"
                class="history-item"
              >
                <div class="history-content" @click="toggleExpand(item.id)">
                  <div class="history-text" :class="{ expanded: expandedIds.has(item.id) }">
                    {{ item.text }}
                  
                  </div>
                  <div class="history-meta">
                    <span class="history-time">{{ formatTime(item.createdAt) }}</span>
                    <div class="history-actions">
                      <n-button
                        text
                        type="error"
                        class="delete-btn"
                        @click.stop="handleDelete(item.id)"
                      >
                        <n-icon :component="TrashOutline" />
                      </n-button>
                      <n-button
                        text
                        size="small"
                        class="copy-btn"
                        @click.stop="handleCopy(item.text)"
                      >
                        <n-icon :component="CopyOutline" />
                      </n-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Teleport } from "vue";
import { NEmpty, NIcon, NButton, NSpin, useMessage } from "naive-ui";
import { TimeOutline, TrashOutline, CopyOutline } from "@vicons/ionicons5";
import dayjs from "dayjs";
import { getHistoryList, deleteHistory } from "../../../utils/historyStore";

const message = useMessage();

const visible = defineModel<boolean>({ default: false });

// 历史记录列表
const historyList = ref<HistoryRecord[]>([]);
// 加载状态
const loading = ref(false);
// 展开的记录 ID 集合
const expandedIds = ref<Set<string>>(new Set());

// 格式化时间
const formatTime = (timestamp: number): string => {
  return dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss");
};

// 切换展开/收起状态
const toggleExpand = (id: string) => {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
  }
  // 触发响应式更新
  expandedIds.value = new Set(expandedIds.value);
};

// 关闭模态框
const closeModal = () => {
  visible.value = false;
};

// 加载历史记录
const loadHistory = async () => {
  loading.value = true;
  try {
    historyList.value = await getHistoryList();
  } catch (error) {
    console.error("[HistoryModal] 加载历史记录失败:", error);
    historyList.value = [];
  } finally {
    loading.value = false;
  }
};

// 删除历史记录
const handleDelete = async (id: string) => {
  const success = await deleteHistory(id);
  if (success) {
    historyList.value = historyList.value.filter((item) => item.id !== id);
    // 从展开集合中移除
    expandedIds.value.delete(id);
    expandedIds.value = new Set(expandedIds.value);
  }
};

// 复制历史记录
const handleCopy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    message.success("copied");
  } catch (error) {
    console.error("[HistoryModal] 复制失败:", error);
    // 降级方案：使用传统方法
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      message.success("copied");
    } catch (fallbackError) {
      console.error("[HistoryModal] 降级复制也失败:", fallbackError);
      message.error("复制失败，请手动复制");
    }
  }
};

// 监听弹窗显示状态，打开时加载数据
watch(visible, (newVal) => {
  if (newVal) {
    loadHistory();
    // 重置展开状态
    expandedIds.value = new Set();
  }
});
</script>

<style scoped lang="scss">
/* 模态框背景 */
.history-modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5000;
  backdrop-filter: blur(4px);
}

/* 模态框主体 */
.history-modal {
  width: 680px;
  max-width: 90vw;
  height: 600px;
  max-height: 90vh;
  background-color: #ffffff;
  border-radius: 16px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  animation: modalFadeIn 0.2s ease-out;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 模态框头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);

  .modal-title {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  .close-button {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background-color: transparent;
    color: #6b7280;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.05);
      color: #374151;
    }
  }
}

/* 模态框内容区域 */
.modal-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loading-state {
  @apply flex flex-col items-center justify-center;
  flex: 1;
  gap: 12px;
  
  .loading-text {
    color: #8e8e93;
    font-size: 14px;
  }
}

.empty-state {
  @apply flex items-center justify-center;
  flex: 1;
}

.history-scrollbar {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  
  /* 自定义滚动条 */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 4px;

    &:hover {
      background-color: rgba(0, 0, 0, 0.3);
    }
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  @apply flex items-start gap-3;
  padding: 16px 20px;
  border-radius: 12px;
  background-color: rgba(142, 142, 147, 0.08);
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(142, 142, 147, 0.12);
  }
}

.history-content {
  @apply flex-1 min-w-0 cursor-pointer;
}

.history-text {
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
  word-break: break-word;
  white-space: pre-wrap;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Helvetica Neue", Helvetica, Arial, sans-serif;
  
  // 默认截断显示
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  
  // 展开状态
  &.expanded {
    display: block;
    -webkit-line-clamp: unset;
    max-height: 300px;
    overflow-y: auto;
    
    // 自定义滚动条
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background-color: rgba(142, 142, 147, 0.3);
      border-radius: 3px;

      &:hover {
        background-color: rgba(142, 142, 147, 0.5);
      }
    }
  }
}

.history-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  width: 100%;
}

.history-time {
  font-size: 12px;
  color: #8e8e93;
}

.history-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.copy-btn,
.delete-btn {
  opacity: 0.5;
  transition: opacity 0.2s ease;
  width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    opacity: 1;
  }
}
</style>
