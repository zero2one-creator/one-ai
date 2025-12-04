<!--
  PromptPresetModal.vue
  One Command 弹窗组件
-->
<template>
  <n-modal
    v-model:show="visible"
    :show-icon="false"
    preset="card"
    style="width: 900px; max-width: 95vw; height: 80vh; max-height: 700px"
    :bordered="false"
    :segmented="false"
  >
    <template #header>
      <div class="modal-header">
        <span>One Command</span>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-icon
              :size="16"
              style="margin-left: 8px; color: #999"
              :component="HelpCircleOutline"
            />
          </template>
          编辑 prompt 模板
        </n-tooltip>
      </div>
    </template>
    <div class="prompt-container">
      <!-- 搜索和新建栏 -->
      <div class="action-bar">
        <n-input
          v-model:value="searchQuery"
          placeholder="搜索标题、内容或标签..."
          clearable
          class="search-input"
          @input="handleSearch"
        >
          <template #prefix>
            <n-icon :size="18" :component="SearchOutline" />
          </template>
        </n-input>
        <n-button type="primary" @click="showEditDialog()" class="add-btn">
          <template #icon>
            <n-icon :component="AddOutline" />
          </template>
          新建
        </n-button>
      </div>

      <!-- 预设卡片列表 -->
      <n-scrollbar class="preset-list" v-if="!loading">
        <div class="preset-grid">
          <transition-group name="list">
            <div
              v-for="preset in filteredPresets"
              :key="preset.id"
              class="preset-card"
              @click="handleSelectPreset(preset)"
            >
              <!-- 卡片头部 -->
              <div class="card-header">
                <h3 class="card-title">{{ preset.title }}</h3>
                <div class="card-actions" @click.stop>
                  <n-tooltip trigger="hover">
                    <template #trigger>
                      <n-button
                        quaternary
                        circle
                        size="tiny"
                        @click="handleCopyContent(preset)"
                      >
                        <template #icon>
                          <n-icon :size="16" :component="CopyOutline" />
                        </template>
                      </n-button>
                    </template>
                    复制内容
                  </n-tooltip>
                  <n-tooltip trigger="hover">
                    <template #trigger>
                      <n-button
                        quaternary
                        circle
                        size="tiny"
                        @click="showEditDialog(preset)"
                      >
                        <template #icon>
                          <n-icon :size="16" :component="CreateOutline" />
                        </template>
                      </n-button>
                    </template>
                    编辑
                  </n-tooltip>
                  <n-popconfirm
                    @positive-click="handleDelete(preset.id)"
                    negative-text="取消"
                    positive-text="确认"
                  >
                    <template #trigger>
                      <n-tooltip trigger="hover">
                        <template #trigger>
                          <n-button quaternary circle size="tiny">
                            <template #icon>
                              <n-icon :size="16" :component="TrashOutline" />
                            </template>
                          </n-button>
                        </template>
                        删除
                      </n-tooltip>
                    </template>
                    确认删除这个预设吗？
                  </n-popconfirm>
                </div>
              </div>

              <!-- 卡片内容 -->
              <div class="card-content">
                <p class="content-text">{{ preset.content }}</p>
              </div>

              <!-- 卡片标签 -->
              <div
                class="card-footer"
                v-if="preset.tags && preset.tags.length > 0"
              >
                <n-tag
                  v-for="tag in preset.tags.slice(0, 3)"
                  :key="tag"
                  size="small"
                  :bordered="false"
                  class="preset-tag"
                >
                  {{ tag }}
                </n-tag>
                <span v-if="preset.tags.length > 3" class="more-tags">
                  +{{ preset.tags.length - 3 }}
                </span>
              </div>
            </div>
          </transition-group>
        </div>

        <!-- 空状态 -->
        <n-empty
          v-if="filteredPresets.length === 0 && !loading"
          description="暂无预设"
          class="empty-state"
        >
          <template #extra>
            <n-button type="primary" @click="showEditDialog()">
              创建第一个预设
            </n-button>
          </template>
        </n-empty>
      </n-scrollbar>

      <!-- 加载状态 -->
      <div v-else class="loading-container">
        <n-spin size="medium" />
      </div>
    </div>

    <!-- 编辑对话框 -->
    <n-modal
      v-model:show="editDialogVisible"
      preset="card"
      :title="editingPreset ? '编辑预设' : '新建预设'"
      style="width: 600px; max-width: 90vw"
      :bordered="false"
      :segmented="false"
    >
      <n-form ref="formRef" :model="formData" :rules="formRules">
        <n-form-item label="标题" path="title">
          <n-input
            v-model:value="formData.title"
            placeholder="请输入预设标题"
            maxlength="50"
            show-count
          />
        </n-form-item>
        <n-form-item label="内容" path="content">
          <n-input
            v-model:value="formData.content"
            type="textarea"
            placeholder="请输入预设内容，支持使用 [占位符] 形式的变量"
            :rows="8"
            maxlength="1000"
            show-count
          />
        </n-form-item>
        <n-form-item label="标签" path="tags">
          <n-dynamic-tags v-model:value="formData.tags" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="dialog-footer">
          <n-button @click="editDialogVisible = false">取消</n-button>
          <n-button type="primary" @click="handleSavePreset" :loading="saving">
            {{ editingPreset ? "保存" : "创建" }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import {
  NModal,
  NButton,
  NIcon,
  NInput,
  NScrollbar,
  NSpin,
  NEmpty,
  NTag,
  NTooltip,
  NPopconfirm,
  NForm,
  NFormItem,
  NDynamicTags,
  useMessage,
  FormInst,
  FormRules,
} from "naive-ui";
import {
  SearchOutline,
  AddOutline,
  CopyOutline,
  CreateOutline,
  TrashOutline,
  HelpCircleOutline,
} from "@vicons/ionicons5";
import {
  getPromptList,
  addPrompt,
  updatePrompt,
  deletePrompt,
  searchPrompts,
  getDefaultPrompts,
} from "../../../utils/promptStore";

const message = useMessage();

// Props
const visible = defineModel<boolean>({ default: false });

// State
const loading = ref(false);
const saving = ref(false);
const presets = ref<PromptPreset[]>([]);
const searchQuery = ref("");
const filteredPresets = ref<PromptPreset[]>([]);

// 编辑对话框相关
const editDialogVisible = ref(false);
const editingPreset = ref<PromptPreset | null>(null);
const formRef = ref<FormInst | null>(null);
const formData = ref({
  title: "",
  content: "",
  tags: [] as string[],
});

// 表单验证规则
const formRules: FormRules = {
  title: [
    { required: true, message: "请输入预设标题", trigger: "blur" },
    { min: 1, max: 50, message: "标题长度应在1-50个字符之间", trigger: "blur" },
  ],
  content: [
    { required: true, message: "请输入预设内容", trigger: "blur" },
    {
      min: 1,
      max: 1000,
      message: "内容长度应在1-1000个字符之间",
      trigger: "blur",
    },
  ],
};

// 加载预设列表
const loadPresets = async () => {
  loading.value = true;
  try {
    presets.value = await getPromptList();
    filteredPresets.value = presets.value;

    // 如果没有预设，初始化默认预设
    if (presets.value.length === 0) {
      await initializeDefaultPresets();
    }
  } catch (error) {
    console.error("[PromptPresetModal] 加载预设失败:", error);
    message.error("加载失败：" + (error as Error).message);
  } finally {
    loading.value = false;
  }
};

// 初始化默认预设
const initializeDefaultPresets = async () => {
  const defaults = getDefaultPrompts();
  for (const preset of defaults) {
    await addPrompt(preset);
  }
  // 重新加载
  presets.value = await getPromptList();
  filteredPresets.value = presets.value;
};

// 搜索处理
const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    filteredPresets.value = presets.value;
    return;
  }

  try {
    filteredPresets.value = await searchPrompts(searchQuery.value);
  } catch (error) {
    console.error("[PromptPresetModal] 搜索失败:", error);
    filteredPresets.value = presets.value;
  }
};

// 显示编辑对话框
const showEditDialog = (preset?: PromptPreset) => {
  editingPreset.value = preset || null;
  if (preset) {
    formData.value = {
      title: preset.title,
      content: preset.content,
      tags: preset.tags || [],
    };
  } else {
    formData.value = {
      title: "",
      content: "",
      tags: [],
    };
  }
  editDialogVisible.value = true;
};

// 保存预设
const handleSavePreset = async () => {
  try {
    await formRef.value?.validate();
    saving.value = true;

    if (editingPreset.value) {
      // 更新
      // 解构创建纯对象，避免 Vue 响应式对象导致的序列化问题
      const updateData = {
        title: formData.value.title,
        content: formData.value.content,
        tags: [...(formData.value.tags || [])], // 确保是数组的副本
      };
      const updated = await updatePrompt(editingPreset.value.id, updateData);
      if (updated) {
        message.success("预设更新成功");
        editDialogVisible.value = false;
        await loadPresets();
      } else {
        message.error("更新失败");
      }
    } else {
      // 新建
      // 解构 formData.value 创建纯对象，避免 Vue 响应式对象导致的序列化问题
      const presetData = {
        title: formData.value.title,
        content: formData.value.content,
        tags: [...(formData.value.tags || [])], // 确保是数组的副本
      };
      const created = await addPrompt(presetData);
      if (created) {
        message.success("预设创建成功");
        editDialogVisible.value = false;
        await loadPresets();
      } else {
        message.error("创建失败：请检查标题和内容是否为空");
      }
    }
  } catch (error) {
    message.error("保存失败：" + (error as Error).message);
  } finally {
    saving.value = false;
  }
};

// 删除预设
const handleDelete = async (id: string) => {
  const success = await deletePrompt(id);
  if (success) {
    message.success("预设已删除");
    await loadPresets();
  } else {
    message.error("删除失败");
  }
};

// 复制内容
const handleCopyContent = async (preset: PromptPreset) => {
  try {
    await navigator.clipboard.writeText(preset.content);
    message.success("内容已复制");
  } catch (error) {
    console.error("[PromptPresetModal] 复制失败:", error);
    message.error("复制失败");
  }
};

// 选择预设（可以在父组件中处理）
const handleSelectPreset = (preset: PromptPreset) => {
  // 触发自定义事件，让父组件处理
  emit("select", preset);
  visible.value = false;
};

// Events
const emit = defineEmits<{
  select: [preset: PromptPreset];
}>();

// Lifecycle
onMounted(() => {
  if (visible.value) {
    loadPresets();
  }
});

// Watch
watch(visible, (newVal) => {
  if (newVal) {
    loadPresets();
    searchQuery.value = "";
  }
});
</script>

<style scoped lang="scss">
.modal-header {
  display: flex;
  align-items: center;
}

.prompt-container {
  display: flex;
  flex-direction: column;
  height: calc(80vh - 120px);
  max-height: 580px;
}

.action-bar {
  position: relative;
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding: 0 20px; // 左右内边距与卡片区域保持一致
  z-index: 1; // 确保操作栏在卡片下方

  .search-input {
    flex: 1;
  }
}

.preset-list {
  flex: 1;
  overflow: hidden;

  // 自定义 n-scrollbar 样式，确保滚动条不压内容
  :deep(.n-scrollbar) {
    .n-scrollbar-container {
      .n-scrollbar-content {
        padding-right: 0 !important; // 避免内容区域的默认右内边距
      }
    }

    .n-scrollbar-rail {
      right: 2px; // 调整滚动条轨道位置
    }
  }
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 4px 20px 20px 20px; // 上右下左: 4px 20px 20px 20px，左右保持一致
  overflow: visible; // 确保卡片悬停效果不被裁剪
}

.preset-card {
  position: relative;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: var(--n-color-target);
    z-index: 10;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;

    .card-title {
      font-size: 15px;
      font-weight: 500;
      margin: 0;
      flex: 1;
      color: var(--n-text-color);
      line-height: 1.4;
    }

    .card-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }
  }

  &:hover .card-actions {
    opacity: 1;
  }

  .card-content {
    flex: 1;

    .content-text {
      margin: 0;
      color: var(--n-text-color-3);
      font-size: 13px;
      line-height: 1.6;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .card-footer {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;

    .preset-tag {
      font-size: 12px;
    }

    .more-tags {
      font-size: 12px;
      color: var(--n-text-color-3);
    }
  }
}

.empty-state {
  margin-top: 80px;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

// 列表动画
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
