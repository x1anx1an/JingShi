<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { NButton, NModal } from 'naive-ui'
import { formatDateTime } from '@shared/date'
import type { TaskItem } from '@shared/types'
import { TASK_STATUS_META, describePlanRepeat, planTypeLabel } from '@renderer/utils/task'

const props = defineProps<{
  show: boolean
  task?: TaskItem | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const statusMeta = computed(() =>
  props.task ? TASK_STATUS_META[props.task.status] : TASK_STATUS_META.pending
)

const effectiveRange = computed(() => {
  if (!props.task) {
    return ''
  }
  return `${props.task.startText} - ${props.task.endText}`
})
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :style="{ width: '500px', maxWidth: '92vw' }"
    :bordered="false"
    @update:show="emit('update:show', $event)"
  >
    <template #header>
      <div class="modal-head">
        <div class="modal-icon"><Icon icon="ph:calendar-check" width="20" /></div>
        <div>
          <div class="eyebrow">PLAN DETAIL</div>
          <h2>计划详情</h2>
        </div>
      </div>
    </template>

    <template v-if="task">
      <div class="detail-hero">
        <div>
          <div class="hero-title">{{ task.plan.name }}</div>
          <div class="hero-date">{{ task.execDate }} · {{ effectiveRange }}</div>
        </div>
        <span class="status-badge" :class="statusMeta.className">{{ statusMeta.label }}</span>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">计划类型</span>
          <span class="detail-value">{{ planTypeLabel(task.plan.type) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">重复规则</span>
          <span class="detail-value">{{ describePlanRepeat(task.plan) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">生效区间</span>
          <span class="detail-value">
            {{ task.plan.startDate || '立即生效' }} 至 {{ task.plan.endDate || '长期' }}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">到点提醒</span>
          <span class="detail-value">{{ task.plan.enableRemind ? '已开启' : '未开启' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">悬浮窗展示</span>
          <span class="detail-value">{{ task.plan.showFloat ? '展示' : '不展示' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">创建时间</span>
          <span class="detail-value">{{ formatDateTime(task.plan.createAt) }}</span>
        </div>
      </div>

      <div v-if="task.plan.contractText" class="detail-block">
        <div class="detail-label">自律契约</div>
        <p class="contract-text">{{ task.plan.contractText }}</p>
      </div>

      <div v-if="task.remark" class="detail-block remark-block">
        <div class="detail-label">{{ task.status === 'skipped' ? '跳过理由' : '执行备注' }}</div>
        <p>{{ task.remark }}</p>
      </div>

      <div v-if="task.delayMinutes > 0" class="detail-block delay-block">
        <div class="detail-label">延期记录</div>
        <p>本日累计顺延 {{ task.delayMinutes }} 分钟，执行窗口已重新计算。</p>
      </div>
    </template>

    <template #footer>
      <div class="modal-footer">
        <n-button type="primary" @click="emit('update:show', false)">关闭</n-button>
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

.modal-head h2 {
  margin-top: 3px;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
}

.detail-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0 16px;
}

.hero-title {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
}

.hero-date {
  margin-top: 5px;
  color: var(--muted);
  font-size: 11px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 11px 14px;
}

.detail-item:nth-child(odd) {
  border-right: 1px solid var(--border);
}

.detail-item:nth-child(n + 3) {
  border-top: 1px solid var(--border);
}

.detail-label {
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.05em;
}

.detail-value {
  color: var(--text-soft);
  font-size: 12px;
}

.detail-block {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 11px;
  background: var(--surface-2);
}

.detail-block p {
  margin-top: 5px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.7;
}

.contract-text {
  font-family: var(--font-serif);
  font-style: italic;
}

.remark-block {
  border-left: 3px solid var(--danger);
}

.delay-block {
  border-left: 3px solid var(--warning);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
