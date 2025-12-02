<!--
  PromptPresetModal.vue
  Prompt 预设弹窗组件
-->
<template>
  <n-modal
    v-model:show="visible"
    :show-icon="false"
    preset="card"
    title="Prompt 预设"
    style="width: 800px; max-width: 90vw; height: 600px"
  >
    <div class="modal-content">
      <!-- Prompt 预设内容待实现 -->
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { NModal } from "naive-ui";

const visible = defineModel<boolean>({ default: false });
</script>

<style scoped lang="scss">
.modal-content {
  min-height: 200px;
}
</style>
