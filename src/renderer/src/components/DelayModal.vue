<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { NButton, NInputNumber, NModal } from 'naive-ui'

const props = defineProps<{
  show: boolean
  planName?: string
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [minutes: number]
}>()

const presetMinutes = [15, 30, 60]
const selected = ref<number | 'custom'>(15)
const customMinutes = ref<number | null>(25)

const finalMinutes = computed(() =>
  selected.value === 'custom' ? customMinutes.value : selected.value
)
const canSubmit = computed(
  () =>
    typeof finalMinutes.value === 'number' &&
    Number.isInteger(finalMinutes.value) &&
    finalMinutes.value >= 1 &&
    finalMinutes.value <= 1440
)

watch(
  () => props.show,
  (show) => {
    if (show) {
      selected.value = 15
      customMinutes.value = 25
    }
  }
)

function close(): void {
  emit('update:show', false)
}

function submit(): void {
  if (!canSubmit.value || typeof finalMinutes.value !== 'number') {
    return
  }
  emit('confirm', finalMinutes.value)
}
</script>

<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    preset="card"
    :style="{ width: '440px', maxWidth: '92vw' }"
    :bordered="false"
    @update:show="emit('update:show', $event)"
  >
    <template #header>
      <div class="modal-head">
        <div class="modal-icon"><Icon icon="ph:clock-counter-clockwise" width="20" /></div>
        <div>
          <div class="eyebrow">POSTPONE</div>
          <h2>延期执行</h2>
        </div>
      </div>
    </template>

    <p class="intro">
      「{{ planName || '当前计划' }}」将顺延执行时间，并在新的时间点再次提醒你。
    </p>

    <div class="delay-options">
      <button
        v-for="minutes in presetMinutes"
        :key="minutes"
        type="button"
        class="delay-chip"
        :class="{ 'is-selected': selected === minutes }"
        @click="selected = minutes"
      >
        <span class="delay-value">{{ minutes }}</span>
        <span class="delay-unit">分钟</span>
      </button>
      <button
        type="button"
        class="delay-chip"
        :class="{ 'is-selected': selected === 'custom' }"
        @click="selected = 'custom'"
      >
        <span class="delay-value"><Icon icon="ph:sliders-horizontal" width="18" /></span>
        <span class="delay-unit">自定义</span>
      </button>
    </div>

    <div v-if="selected === 'custom'" class="custom-row">
      <span class="custom-label">自定义时长</span>
      <n-input-number
        v-model:value="customMinutes"
        :min="1"
        :max="1440"
        :precision="0"
        placeholder="1 - 1440"
      >
        <template #suffix>分钟</template>
      </n-input-number>
    </div>

    <template #footer>
      <div class="modal-footer">
        <n-button quaternary @click="close">取消</n-button>
        <n-button type="warning" :disabled="!canSubmit" :loading="saving" @click="submit">
          确认延期
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
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 11%, transparent);
}

.modal-head h2 {
  margin-top: 3px;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
}

.intro {
  margin-bottom: 16px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.8;
}

.delay-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.delay-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 13px 8px 11px;
  border: 1px solid var(--border);
  border-radius: 11px;
  color: var(--text-soft);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.16s ease;
}

.delay-chip:hover {
  border-color: var(--border-strong);
}

.delay-chip.is-selected {
  border-color: var(--warning);
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
}

.delay-value {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
}

.delay-unit {
  color: var(--muted);
  font-size: 10px;
}

.delay-chip.is-selected .delay-unit {
  color: var(--warning);
}

.custom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px dashed var(--border);
  border-radius: 10px;
}

.custom-label {
  color: var(--text-soft);
  font-size: 12px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
