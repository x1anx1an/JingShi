<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { NButton, NInput, NModal } from 'naive-ui'

const props = defineProps<{
  show: boolean
  planName?: string
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [reason: string]
}>()

const reason = ref('')

const reasonLength = computed(() => Array.from(reason.value.trim()).length)
const canSubmit = computed(() => reasonLength.value >= 2)

watch(
  () => props.show,
  (show) => {
    if (show) {
      reason.value = ''
    }
  }
)

function close(): void {
  emit('update:show', false)
}

function submit(): void {
  if (!canSubmit.value) {
    return
  }
  emit('confirm', reason.value.trim())
}
</script>

<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    preset="card"
    :style="{ width: '460px', maxWidth: '92vw' }"
    :bordered="false"
    @update:show="emit('update:show', $event)"
  >
    <template #header>
      <div class="modal-head">
        <div class="modal-icon modal-icon--danger"><Icon icon="ph:skip-forward" width="20" /></div>
        <div>
          <div class="eyebrow">SKIP PLAN</div>
          <h2>跳过这次计划</h2>
        </div>
      </div>
    </template>

    <p class="intro">
      你真的要跳过「{{ planName || '当前计划' }}」吗？留下一句真实的理由，
      用于之后复盘，而不是让这次放弃悄悄消失。
    </p>

    <n-input
      v-model:value="reason"
      type="textarea"
      :autosize="{ minRows: 4, maxRows: 7 }"
      maxlength="200"
      show-count
      placeholder="至少写 2 个字：为什么现在不适合完成它？"
      autofocus
    />

    <div class="reason-meta">
      <span :class="{ 'is-valid': canSubmit }">
        {{ canSubmit ? '理由已记录，可以确认跳过' : `还需要 ${Math.max(0, 2 - reasonLength)} 个字` }}
      </span>
    </div>

    <template #footer>
      <div class="modal-footer">
        <n-button quaternary @click="close">取消</n-button>
        <n-button type="error" :disabled="!canSubmit" :loading="saving" @click="submit">
          确认跳过
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  color: var(--accent);
  background: var(--accent-soft);
}

.modal-icon--danger {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.modal-head h2 {
  margin-top: 3px;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
}

.intro {
  margin-bottom: 14px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.8;
}

.reason-meta {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  color: var(--muted);
  font-size: 10px;
}

.reason-meta .is-valid {
  color: var(--accent);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
