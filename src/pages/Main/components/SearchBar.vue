<template>
  <div class="search-bar">
    <!-- AI 应用图标列表 -->
    <div class="app-icons-container">
      <div
        class="app-icon-item"
        v-for="app in aiAppList"
        :key="app.id"
        @click="onClickApp(app)"
        v-tooltip="app.name"
      >
        <img :src="app.logo" :alt="app.name" />
      </div>
    </div>

    <div class="search-container-divider"></div>
    <!-- 搜索框 -->
    <div class="search-container">
      <SearchInput />
    </div>

    <!-- 设置 / 右侧工具栏 -->
    <div class="toolbar-spacer"></div>
    <div class="layout-controls">
      <!-- 新建会话按钮 -->
      <button
        class="icon-button"
        @click="onCreateNewSession"
        v-tooltip="{ content: '新建会话', placement: 'bottom' }"
      >
        <n-icon :component="Add" size="16" />
      </button>
      <!-- 常用网站下拉菜单 -->
      <div class="icon-button">
        <BrowserDropdown />
      </div>
      <!-- 横向分屏按钮 -->
      <button
        class="icon-button"
        @click="onSplitHorizontal"
        v-tooltip="{ content: '横向分屏', placement: 'bottom' }"
      >
        <HorizontalSplitIcon />
      </button>
      <!-- 设置按钮 -->
      <div class="icon-button">
        <SettingsDropdown />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useMessage, NIcon } from "naive-ui";
import { Add } from "@vicons/ionicons5";
import { HorizontalSplitIcon } from "../../../components/Icon";
import { useAppStore } from "../../../store/appStore";
import { AIAppList, logoMap } from "../../../const/defaultConfig";
import SearchInput from "./SearchInput.vue";
import BrowserDropdown from "./BrowserDropdown.vue";
import SettingsDropdown from "./SettingsDropdown.vue";
import type { App } from "../../../store/appStore";

const appStore = useAppStore();
const message = useMessage();

// 为每个应用注入 logo
const aiAppList = ref(
  AIAppList.map((app: any) => ({
    ...app,
    logo: logoMap[app.id],
  }))
);

// 当前一维横向布局的 panel 数量
const paneCount = computed(() => {
  const layout = appStore.getSplitLayout;
  if (layout.type === "split" && layout.children) {
    return layout.children.length;
  }
  return 0;
});

const onClickApp = (app: App) => {
  // AI 应用分屏逻辑与常用网站保持一致：
  // 1. 有空白面板优先覆盖空白面板
  // 2. 否则覆盖当前激活面板
  appStore.openWebsiteWithSplit(app);
};

// 新建会话按钮：为所有已打开的 AI 应用创建新会话
const onCreateNewSession = async () => {
  const count = await appStore.createNewSessionForAll();
  if (count === 0) {
    message.warning("请先打开 AI 应用");
  } else {
    message.success(`已为 ${count} 个应用创建新会话`);
  }
};

// 右上角横向分屏按钮：在当前一维横向布局末尾新增一个 panel
const onSplitHorizontal = () => {
  const MAX_PANELS = 4;
  if (paneCount.value >= MAX_PANELS) {
    message.warning(`最多同时分屏 ${MAX_PANELS} 个应用`);
    return;
  }

  appStore.addPanel();
};
</script>

<style scoped lang="scss">
.search-bar {
  height: 60px;
  background-color: #ffffff;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  padding: 0 16px;
  flex-shrink: 0;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  gap: 16px;

  .app-icons-container {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
    padding: 4px 0;
    max-width: 50%;

    &::-webkit-scrollbar {
      height: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background-color: #d0d0d0;
      border-radius: 2px;

      &:hover {
        background-color: #b0b0b0;
      }
    }

    .app-icon-item {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border-radius: 8px;
      background-color: #ffffff;
      transition: all 0.2s;
      flex-shrink: 0;
      padding: 2px;

      &:hover {
        background-color: #f0f4f8;
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(74, 144, 226, 0.15);
      }

      &:active {
        transform: translateY(0);
      }

      img {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        transition: transform 0.2s;
      }
    }
  }

  .search-container-divider {
    width: 1px;
    height: 30px;
    background-color: rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 400px;
    max-width: 30%;
    flex-shrink: 0;
  }

  .toolbar-spacer {
    flex: 1;
  }

  .layout-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-right: -4px; // 让图标整体更贴近右侧

    .icon-button {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: none;
      background-color: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: rgba(0, 0, 0, 0.6);
      transition: all 0.2s ease;

      &:hover {
        background-color: #f5f7fb;
        color: #007aff;
      }

      &:active {
        transform: translateY(1px);
      }

      svg {
        width: 16px;
        height: 16px;
      }
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
