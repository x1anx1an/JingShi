<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { NButton, NTooltip } from 'naive-ui'
import type { TaskItem } from '@shared/types'
import { TASK_STATUS_META, describePlanRepeat, planTypeLabel, plusMinutesLabel } from '@renderer/utils/task'

const props = defineProps<{
  task: TaskItem
}>()

const emit = defineEmits<{
  start: []
  pause: []
  resume: []
  finish: []
  delay: []
  skip: []
  edit: []
  remove: []
  view: []
}>()

const statusMeta = computed(() => TASK_STATUS_META[props.task.status])
const ended = computed(
  () =>
    props.task.overdue ||
    props.task.status === 'finished' ||
    props.task.status === 'skipped'
)

const emits = {
  start: () => emit('start'),
  pause: () => emit('pause'),
  resume: () => emit('resume'),
  finish: () => emit('finish'),
  delay: () => emit('delay'),
  skip: () => emit('skip'),
  edit: () => emit('edit'),
  remove: () => emit('remove'),
  view: () => emit('view')
}
</script>

<template>
  <article
    class="task-card"
    :class="[
      `task-card--${task.status}`,
      { 'task-card--ended': ended, 'task-card--paused': task.paused }
    ]"
  >
    <div class="time-block">
      <span class="time-start mono">{{ task.startText }}</span>
      <span class="time-line" />
      <span class="time-end mono">{{ task.endText }}</span>
    </div>

    <div class="task-body">
      <div class="task-title-row">
        <h3 class="task-name">{{ task.plan.name }}</h3>
        <span class="status-badge" :class="statusMeta.className">{{ statusMeta.label }}</span>
        <span v-if="task.paused" class="mini-tag">已暂停</span>
        <span v-if="task.status === 'delayed' && !task.overdue" class="mini-tag">已顺延</span>
      </div>

      <div class="task-meta">
        <span class="meta-item">
          <Icon icon="ph:target" width="13" />
          {{ planTypeLabel(task.plan.type) }}
        </span>
        <span class="meta-item">
          <Icon icon="ph:repeat" width="13" />
          {{ describePlanRepeat(task.plan) }}
        </span>
        <span v-if="task.delayMinutes > 0" class="meta-item meta-delay">
          <Icon icon="ph:hourglass" width="13" />
          {{ plusMinutesLabel(task.delayMinutes) }}
        </span>
      </div>

      <div v-if="task.plan.contractText" class="contract">
        <Icon icon="ph:quotes" width="13" />
        <span>{{ task.plan.contractText }}</span>
      </div>

      <div
        v-if="ended && task.remark"
        class="remark"
        :class="{ 'remark--skip': task.status === 'skipped' }"
      >
        <Icon icon="ph:note" width="13" />
        <span>{{ task.remark }}</span>
      </div>
    </div>

    <div class="task-actions">
      <template v-if="!ended">
        <n-button
          v-if="task.capabilities.start"
          size="small"
          type="primary"
          secondary
          @click="emits.start"
        >
          <template #icon><Icon icon="ph:play" /></template>
          提前开始
        </n-button>
        <n-button
          v-if="task.capabilities.pause"
          size="small"
          quaternary
          @click="emits.pause"
        >
          <template #icon><Icon icon="ph:pause" /></template>
          暂停
        </n-button>
        <n-button
          v-if="task.capabilities.resume"
          size="small"
          type="primary"
          secondary
          @click="emits.resume"
        >
          <template #icon><Icon icon="ph:play" /></template>
          继续
        </n-button>
        <n-button
          v-if="task.capabilities.finish"
          size="small"
          type="primary"
          @click="emits.finish"
        >
          <template #icon><Icon icon="ph:check" /></template>
          完成
        </n-button>
        <n-button
          v-if="task.capabilities.delay"
          size="small"
          quaternary
          @click="emits.delay"
        >
          <template #icon><Icon icon="ph:clock-counter-clockwise" /></template>
          延期
        </n-button>
        <n-button
          v-if="task.capabilities.skip"
          size="small"
          quaternary
          @click="emits.skip"
        >
          <template #icon><Icon icon="ph:skip-forward" /></template>
          跳过
        </n-button>
        <n-tooltip v-if="task.capabilities.edit" trigger="hover">
          <template #trigger>
            <n-button size="small" quaternary circle @click="emits.edit">
              <template #icon><Icon icon="ph:pencil-simple" /></template>
            </n-button>
          </template>
          编辑计划
        </n-tooltip>
        <n-tooltip v-if="task.capabilities.remove" trigger="hover">
          <template #trigger>
            <n-button size="small" quaternary circle @click="emits.remove">
              <template #icon><Icon icon="ph:trash" /></template>
            </n-button>
          </template>
          删除计划
        </n-tooltip>
      </template>
      <n-button v-else size="small" quaternary @click="emits.view">
        查看详情
      </n-button>
    </div>
  </article>
</template>

<style scoped>
.task-card {
  position: relative;
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 18px 18px 18px 22px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.task-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow);
  transform: translateY(-1px);
}

.task-card::before {
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--gray);
  content: "";
}

.task-card--running::before {
  background: var(--info);
}

.task-card--finished::before {
  background: var(--success);
}

.task-card--skipped::before {
  background: var(--danger);
}

.task-card--delayed::before {
  background: var(--warning);
}

.task-card--ended {
  opacity: 0.82;
  background: color-mix(in srgb, var(--surface) 76%, var(--surface-2));
}

.task-card--paused {
  border-style: dashed;
}

.time-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding-left: 2px;
}

.time-start {
  color: var(--text);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.time-line {
  width: 18px;
  height: 1px;
  margin: 2px 0;
  background: var(--border-strong);
}

.time-end {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.task-body {
  min-width: 0;
}

.task-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.task-name {
  margin-right: 2px;
  overflow: hidden;
  color: var(--text);
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 13px;
  margin-top: 7px;
  color: var(--muted);
  font-size: 11px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.meta-delay {
  color: var(--warning);
}

.contract,
.remark {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  color: var(--text-soft);
  font-size: 11px;
  line-height: 1.6;
}

.contract {
  padding-left: 2px;
  opacity: 0.82;
}

.contract svg,
.remark svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.remark {
  padding: 6px 9px;
  border-radius: 7px;
  background: var(--surface-2);
}

.remark--skip {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}

.task-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 3px;
  max-width: 300px;
}

@media (max-width: 1180px) {
  .task-card {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .task-actions {
    grid-column: 2;
    justify-content: flex-start;
    max-width: none;
  }
}
</style>
