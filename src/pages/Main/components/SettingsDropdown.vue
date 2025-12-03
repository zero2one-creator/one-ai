<!--
  SettingsDropdown.vue
  设置下拉菜单组件，包含历史记录和 Prompt 预设两个选项
-->
<template>
  <div>
    <n-dropdown trigger="click" :options="options" @select="handleSelect">
      <n-icon
        style="cursor: pointer; transform: translateY(3px)"
        v-tooltip="{ content: '设置', placement: 'left' }"
        size="16"
        :component="SettingsOutline"
      ></n-icon>
    </n-dropdown>

    <!-- 历史记录弹窗 -->
    <HistoryModal v-model="showHistoryModal" />

    <!-- Prompt 预设弹窗 -->
    <PromptPresetModal v-model="showPromptModal" @select="handlePromptSelect" />
  </div>
</template>

<script setup lang="ts">
import { h, ref } from "vue";
import { NDropdown, NIcon } from "naive-ui";
import {
  SettingsOutline,
  TimeOutline,
  DocumentTextOutline,
} from "@vicons/ionicons5";
import HistoryModal from "./HistoryModal.vue";
import PromptPresetModal from "./PromptPresetModal.vue";

// 定义 emit
const emit = defineEmits<{
  selectPrompt: [preset: any];
}>();

// 下拉菜单选项 key
const HISTORY_KEY = "history";
const PROMPT_KEY = "prompt";

// 弹窗显示状态
const showHistoryModal = ref(false);
const showPromptModal = ref(false);

// 渲染图标函数
const renderIcon = (icon: any) => () =>
  h(NIcon, null, {
    default: () => h(icon),
  });

// 下拉菜单选项
const options = [
  {
    label: "历史记录",
    key: HISTORY_KEY,
    icon: renderIcon(TimeOutline),
  },
  {
    label: "Prompt 预设",
    key: PROMPT_KEY,
    icon: renderIcon(DocumentTextOutline),
  },
];

// 处理下拉菜单选择
const handleSelect = (key: string) => {
  if (key === HISTORY_KEY) {
    showHistoryModal.value = true;
  } else if (key === PROMPT_KEY) {
    showPromptModal.value = true;
  }
};

// 处理 Prompt 预设选择
const handlePromptSelect = (preset: any) => {
  emit("selectPrompt", preset);
};
</script>
