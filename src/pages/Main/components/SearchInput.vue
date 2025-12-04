<template>
  <div class="search-input-container">
    <div class="search-input-wrapper-container">
      <div class="search-input-wrapper">
        <SearchIcon class="search-icon" />
        <textarea
          ref="searchInputRef"
          v-model="searchText"
          class="search-input"
          :placeholder="placeholder"
          @keydown.enter="handleKeyDown"
          @keydown.down="handleArrowDown"
          @keydown.up="handleArrowUp"
          @keydown.escape="closeSuggestions"
          @compositionstart="isComposing = true"
          @compositionend="isComposing = false"
          @input="handleInput"
          @focus="handleFocus"
          @blur="handleBlur"
          rows="1"
        />
        <button
          v-if="isMultiline"
          class="expand-button"
          @click="openExpandModal"
          title="展开编辑"
        >
          ⤢
        </button>
      </div>

      <!-- Prompt 提示下拉列表 -->
      <div
        v-if="showSuggestions && suggestions.length > 0"
        class="prompt-suggestions"
        :class="{ 'command-mode': isCommandMode }"
        @mousedown.prevent
      >
        <!-- 命令模式标题 -->
        <div v-if="isCommandMode" class="suggestions-header">
          <span class="header-icon">/</span>
          <span class="header-title">One Command</span>
          <span class="header-hint">选择命令填充到搜索框</span>
        </div>
        <div
          v-for="(item, index) in suggestions"
          :key="item.id"
          class="suggestion-item"
          :class="{ active: index === selectedIndex }"
          @click="selectSuggestion(item)"
          @mouseenter="selectedIndex = index"
        >
          <div class="suggestion-title">
            <span v-if="isCommandMode" class="command-prefix">/</span>
            {{ item.title }}
          </div>
          <div class="suggestion-content">{{ item.content }}</div>
          <!-- 命令模式显示标签 -->
          <div v-if="isCommandMode && item.tags && item.tags.length > 0" class="suggestion-tags">
            <span v-for="tag in item.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </div>
    <button
      class="search-button"
      :disabled="!searchText.trim() || isSearching"
      @click="handleSearch"
      title="搜索"
    >
      搜索
    </button>

    <!-- 展开编辑模态框 -->
    <Teleport to="body">
      <div
        v-if="showExpandModal"
        class="expand-modal-backdrop"
        @click="closeExpandModal"
      >
        <div class="expand-modal" @click.stop>
          <div class="modal-header">
            <span class="modal-title">编辑搜索内容</span>
            <button class="close-button" @click="closeExpandModal">×</button>
          </div>
          <textarea
            ref="expandTextareaRef"
            v-model="expandText"
            class="expand-textarea"
            placeholder="输入问题，支持多行..."
          />
          <div class="modal-actions">
            <button class="btn cancel" @click="closeExpandModal">取消</button>
            <button
              class="btn primary"
              :disabled="!expandText.trim() || isSearching"
              @click="confirmAndSearch"
            >
              搜索
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from "vue";
import { SearchIcon } from "../../../components/Icon";
import { useAppStore } from "../../../store/appStore";
import { searchPrompts, getPromptList } from "../../../utils/promptStore";

interface Props {
  placeholder?: string;
}

withDefaults(defineProps<Props>(), {
  placeholder: "输入问题，一键搜索所有 AI 应用...",
});

const appStore = useAppStore();

const searchText = ref("");
const isSearching = ref(false);
const isComposing = ref(false);
const searchInputRef = ref<HTMLTextAreaElement | null>(null);
const isMultiline = ref(false);

// 展开模态框相关
const showExpandModal = ref(false);
const expandText = ref("");
const expandTextareaRef = ref<HTMLTextAreaElement | null>(null);

// Prompt 提示相关
const showSuggestions = ref(false);
const suggestions = ref<any[]>([]);
const selectedIndex = ref(-1);
const isSelecting = ref(false);

// 斜杠命令模式相关
const isCommandMode = computed(() => searchText.value.startsWith("/"));
const commandQuery = computed(() => {
  if (isCommandMode.value) {
    return searchText.value.slice(1); // 去掉前缀 /
  }
  return "";
});

// 检查是否多行
const checkMultiline = () => {
  if (searchInputRef.value) {
    const lineCount = searchText.value.split("\n").length;
    isMultiline.value = lineCount > 1;
  }
};

// 处理输入
const handleInput = async () => {
  checkMultiline();

  // 如果正在选择建议，不触发搜索
  if (isSelecting.value) {
    isSelecting.value = false;
    return;
  }

  // 斜杠命令模式：搜索 One Command
  if (isCommandMode.value) {
    try {
      const query = commandQuery.value.trim();
      let results: any[];

      if (query.length === 0) {
        // 只输入了 /，显示所有 commands
        results = await getPromptList();
      } else {
        // 输入了 /xxx，搜索匹配的 commands
        results = await searchPrompts(query);
      }

      suggestions.value = results.slice(0, 8); // 命令模式最多显示8个
      showSuggestions.value = suggestions.value.length > 0;
      selectedIndex.value = suggestions.value.length > 0 ? 0 : -1; // 默认选中第一个
    } catch (error) {
      showSuggestions.value = false;
      suggestions.value = [];
    }
    return;
  }

  // 普通模式：搜索 prompt 提示
  const query = searchText.value.trim();

  if (query.length >= 2) {
    // 至少输入2个字符才搜索
    try {
      const results = await searchPrompts(query);
      suggestions.value = results.slice(0, 5); // 最多显示5个建议
      showSuggestions.value = suggestions.value.length > 0;
      selectedIndex.value = -1;
    } catch (error) {
      showSuggestions.value = false;
      suggestions.value = [];
    }
  } else {
    showSuggestions.value = false;
    suggestions.value = [];
  }
};

// 处理焦点
const handleFocus = () => {
  if (suggestions.value.length > 0) {
    showSuggestions.value = true;
  }
};

// 处理失焦
const handleBlur = () => {
  // 使用 setTimeout 延迟关闭，让点击事件先执行
  setTimeout(() => {
    showSuggestions.value = false;
  }, 200);
};

// 关闭建议列表
const closeSuggestions = () => {
  showSuggestions.value = false;
  selectedIndex.value = -1;
};

// 选择建议
const selectSuggestion = (item: any) => {
  isSelecting.value = true;

  // 无论是命令模式还是普通模式，都用 content 替换
  searchText.value = item.content;

  showSuggestions.value = false;
  selectedIndex.value = -1;
  checkMultiline();

  // 聚焦输入框并将光标移到末尾
  nextTick(() => {
    searchInputRef.value?.focus();
    // 将光标移到文本末尾
    if (searchInputRef.value) {
      const len = searchText.value.length;
      searchInputRef.value.setSelectionRange(len, len);
    }
  });
};

// 处理向下箭头
const handleArrowDown = (e: KeyboardEvent) => {
  if (showSuggestions.value && suggestions.value.length > 0) {
    e.preventDefault();
    selectedIndex.value = Math.min(
      selectedIndex.value + 1,
      suggestions.value.length - 1
    );
  }
};

// 处理向上箭头
const handleArrowUp = (e: KeyboardEvent) => {
  if (showSuggestions.value && suggestions.value.length > 0) {
    e.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
  }
};

// 打开展开模态框
const openExpandModal = () => {
  expandText.value = searchText.value;
  showExpandModal.value = true;
  nextTick(() => {
    expandTextareaRef.value?.focus();
  });
};

// 关闭展开模态框
const closeExpandModal = () => {
  showExpandModal.value = false;
};

// 确认展开编辑并搜索
const confirmAndSearch = async () => {
  const trimmedText = expandText.value.trim();
  if (!trimmedText) {
    // 如果文本为空，只关闭弹窗
    showExpandModal.value = false;
    return;
  }

  searchText.value = expandText.value;
  showExpandModal.value = false;
  checkMultiline();
  // 直接触发搜索
  await handleSearch();
  // 搜索完成后清空输入
  searchText.value = "";
  expandText.value = "";
  isMultiline.value = false;
};

const handleKeyDown = (e: KeyboardEvent) => {
  // 避免输入法候选词确认时触发搜索
  if (isComposing.value) return;

  // 如果有选中的建议项，按 Enter 选择它
  if (showSuggestions.value && selectedIndex.value >= 0) {
    e.preventDefault();
    selectSuggestion(suggestions.value[selectedIndex.value]);
    return;
  }

  // 如果按下 Shift+Enter，允许换行（不做任何处理）
  if (e.shiftKey) {
    return;
  }

  // 如果只按 Enter（没有 Shift），触发搜索
  e.preventDefault();
  handleSearch();
};

const handleSearch = async () => {
  const text = searchText.value.trim();
  if (!text || isSearching.value) return;

  isSearching.value = true;
  try {
    await appStore.searchAllApps(text);
    // 搜索成功后清空输入框内容
    searchText.value = "";
    isMultiline.value = false;
  } catch (error) {
    console.error("搜索失败:", error);
  } finally {
    isSearching.value = false;
  }
};

// 暴露方法给父组件
const setSearchText = (text: string) => {
  // 标记为正在选择，避免触发搜索提示
  isSelecting.value = true;
  searchText.value = text;
  checkMultiline();
  // 关闭提示
  showSuggestions.value = false;
  suggestions.value = [];
  // 聚焦输入框
  nextTick(() => {
    searchInputRef.value?.focus();
    // 重置选择标记
    setTimeout(() => {
      isSelecting.value = false;
    }, 100);
  });
};

// 使用 defineExpose 暴露方法
defineExpose({
  setSearchText,
});
</script>

<style scoped lang="scss">
.search-input-container {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.search-input-wrapper-container {
  flex: 1;
  position: relative;
  z-index: 100; // 确保下拉框在其他元素之上
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background-color: rgba(142, 142, 147, 0.12);
  border-radius: 10px;
  border: 0.5px solid transparent;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;

  &:hover {
    background-color: rgba(255, 255, 255, 0.8);
  }

  &:focus-within {
    background-color: rgba(255, 255, 255, 1);
    border-color: rgba(0, 122, 255, 0.5);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  }

  .search-icon {
    position: absolute;
    left: 14px;
    top: 14px;
    color: rgba(142, 142, 147, 0.8);
    pointer-events: none;
    transition: color 0.2s ease;
  }

  .search-input {
    flex: 1;
    min-height: 38px;
    max-height: 200px;
    padding: 9px 40px 9px 40px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 400;
    color: #000000;
    background-color: transparent;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
      "Helvetica Neue", Helvetica, Arial, sans-serif;
    letter-spacing: -0.01em;
    resize: none;
    line-height: 1.5;
    overflow-y: auto;

    &::placeholder {
      color: rgba(142, 142, 147, 0.6);
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* 自定义滚动条 */
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

  .expand-button {
    position: absolute;
    right: 8px;
    top: 8px;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background-color: rgba(0, 122, 255, 0.1);
    color: rgba(0, 122, 255, 0.8);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background-color: rgba(0, 122, 255, 0.2);
      color: rgba(0, 122, 255, 1);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

// Prompt 提示下拉框样式
.prompt-suggestions {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.08);
  max-height: 300px;
  overflow-y: auto;
  z-index: 9999;

  // 命令模式样式
  &.command-mode {
    max-height: 400px;
    border-color: rgba(0, 122, 255, 0.2);
    box-shadow: 0 4px 16px rgba(0, 122, 255, 0.15);
  }

  // 命令模式标题栏
  .suggestions-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: linear-gradient(135deg, rgba(0, 122, 255, 0.08) 0%, rgba(0, 122, 255, 0.04) 100%);
    border-bottom: 1px solid rgba(0, 122, 255, 0.1);
    position: sticky;
    top: 0;
    z-index: 1;

    .header-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 122, 255, 0.15);
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      color: #007aff;
    }

    .header-title {
      font-size: 13px;
      font-weight: 600;
      color: #007aff;
    }

    .header-hint {
      font-size: 11px;
      color: #9ca3af;
      margin-left: auto;
    }
  }

  .suggestion-item {
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    transition: background-color 0.2s;

    &:last-child {
      border-bottom: none;
    }

    &:hover,
    &.active {
      background-color: rgba(0, 122, 255, 0.08);
    }

    .suggestion-title {
      font-size: 14px;
      font-weight: 500;
      color: #1f2937;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;

      .command-prefix {
        color: #007aff;
        font-weight: 600;
      }
    }

    .suggestion-content {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    // 命令模式标签
    .suggestion-tags {
      display: flex;
      gap: 6px;
      margin-top: 8px;

      .tag {
        font-size: 10px;
        padding: 2px 6px;
        background: rgba(0, 122, 255, 0.1);
        color: #007aff;
        border-radius: 4px;
      }
    }
  }

  // 滚动条样式
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;

    &:hover {
      background-color: rgba(0, 0, 0, 0.3);
    }
  }
}

.search-button {
  padding: 0 20px;
  height: 38px;
  border: none;
  border-radius: 10px;
  background-color: rgba(0, 122, 255, 0.9);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Helvetica Neue", Helvetica, Arial, sans-serif;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background-color: rgba(0, 122, 255, 1);
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    background-color: rgba(142, 142, 147, 0.3);
    cursor: not-allowed;
  }
}

/* 展开模态框样式 */
.expand-modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  backdrop-filter: blur(4px);
}

.expand-modal {
  width: 680px;
  max-width: 90vw;
  max-height: 85vh;
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

.expand-textarea {
  flex: 1;
  min-height: 300px;
  max-height: 650px;
  padding: 20px 24px;
  border: none;
  font-size: 15px;
  line-height: 1.6;
  color: #1f2937;
  resize: none;
  outline: none;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Helvetica Neue", Helvetica, Arial, sans-serif;
  overflow-y: auto;

  &::placeholder {
    color: rgba(107, 114, 128, 0.6);
  }

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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);

  .btn {
    min-width: 80px;
    padding: 10px 20px;
    border-radius: 10px;
    border: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
      "Helvetica Neue", Helvetica, Arial, sans-serif;

    &.cancel {
      background-color: transparent;
      color: #6b7280;

      &:hover {
        background-color: rgba(0, 0, 0, 0.05);
        color: #374151;
      }
    }

    &.primary {
      background-color: rgba(0, 122, 255, 0.9);
      color: #ffffff;

      &:hover:not(:disabled) {
        background-color: rgba(0, 122, 255, 1);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
      }

      &:active:not(:disabled) {
        transform: translateY(0);
      }

      &:disabled {
        background-color: rgba(142, 142, 147, 0.3);
        cursor: not-allowed;
        opacity: 0.6;
      }
    }
  }
}
</style>
