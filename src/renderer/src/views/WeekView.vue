<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { NDrawer, NDrawerContent, NSpin, useMessage } from 'naive-ui'
import { formatMonthDay, parseDate } from '@shared/date'
import type { WeekDay, WeekSnapshot, TaskItem } from '@shared/types'
import { TASK_STATUS_META, describePlanRepeat } from '@renderer/utils/task'

const message = useMessage()
const snapshot = ref<WeekSnapshot | null>(null)
const loading = ref(false)
const drawerOpen = ref(false)
const selectedDate = ref('')

let unsubscribe: (() => void) | null = null

const selectedDay = computed<WeekDay | null>(
  () => snapshot.value?.days.find((day) => day.date === selectedDate.value) ?? null
)

const totalTasks = computed(
  () => snapshot.value?.days.reduce((sum, day) => sum + day.tasks.length, 0) ?? 0
)

const finishedTasks = computed(
  () =>
    snapshot.value?.days.reduce(
      (sum, day) => sum + day.tasks.filter((task) => task.status === 'finished').length,
      0
    ) ?? 0
)

onMounted(async () => {
  await loadWeek()
  unsubscribe = window.api.events.onDataChanged(() => {
    void loadWeek(false)
  })
})

onBeforeUnmount(() => {
  unsubscribe?.()
})

async function loadWeek(withLoading = true): Promise<void> {
  if (withLoading) {
    loading.value = true
  }
  try {
    snapshot.value = await window.api.plans.week()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载周视图失败')
  } finally {
    loading.value = false
  }
}

function monthDay(date: string): string {
  const parsed = parseDate(date)
  return `${parsed.getMonth() + 1}/${String(parsed.getDate()).padStart(2, '0')}`
}

function openDay(day: WeekDay): void {
  selectedDate.value = day.date
  drawerOpen.value = true
}

function statusClass(task: TaskItem): string {
  return TASK_STATUS_META[task.status].className
}

function statusLabel(task: TaskItem): string {
  return TASK_STATUS_META[task.status].label
}
</script>

<template>
  <div class="page week-page">
    <div class="page-toolbar">
      <p class="week-intro">
        一周的节奏不必每一天都满。点击日期，查看当天的计划与状态。
      </p>
      <div class="week-summary">
        <span><strong>{{ totalTasks }}</strong> 项计划</span>
        <span class="summary-divider" />
        <span><strong>{{ finishedTasks }}</strong> 项完成</span>
        <span v-if="snapshot" class="week-range">
          {{ formatMonthDay(snapshot.startDate) }} - {{ formatMonthDay(snapshot.endDate) }}
        </span>
      </div>
    </div>

    <n-spin :show="loading">
      <div v-if="snapshot" class="week-board">
        <div
          v-for="day in snapshot.days"
          :key="day.date"
          class="week-column"
          :class="{ 'is-today': day.isToday }"
          @click="openDay(day)"
        >
          <div class="week-column-head">
            <div class="weekday-block">
              <span class="weekday-name">{{ day.label }}</span>
              <span class="weekday-date">{{ monthDay(day.date) }}</span>
            </div>
            <div class="weekday-meta">
              <span v-if="day.isToday" class="today-dot">今天</span>
            </div>
          </div>

          <div class="week-column-body">
            <div v-if="day.tasks.length" class="week-task-list">
              <div
                v-for="task in day.tasks"
                :key="`${task.plan.id}-${task.execDate}`"
                class="week-task"
                :class="`week-task--${task.status}`"
              >
                <div class="week-task-time mono">{{ task.startText }}</div>
                <div class="week-task-name">{{ task.plan.name }}</div>
                <div class="week-task-foot">
                  <span class="week-status" :class="statusClass(task)">
                    {{ statusLabel(task) }}
                  </span>
                  <Icon icon="ph:arrow-up-right" width="11" />
                </div>
              </div>
            </div>
            <div v-else class="week-empty">
              <span class="week-empty-line" />
              <span>留白</span>
            </div>
          </div>
        </div>
      </div>
    </n-spin>

    <n-drawer v-model:show="drawerOpen" :width="380" placement="right">
      <n-drawer-content v-if="selectedDay" closable>
        <template #header>
          <div>
            <div class="eyebrow">DAY DETAIL</div>
            <div class="drawer-title">
              {{ selectedDay.label }} · {{ formatMonthDay(selectedDay.date) }}
            </div>
          </div>
        </template>

        <div v-if="selectedDay.tasks.length" class="drawer-list">
          <div
            v-for="task in selectedDay.tasks"
            :key="`${task.plan.id}-${task.execDate}`"
            class="drawer-task"
          >
            <div class="drawer-task-top">
              <span class="drawer-task-time mono">{{ task.startText }} - {{ task.endText }}</span>
              <span class="status-badge" :class="statusClass(task)">{{ statusLabel(task) }}</span>
            </div>
            <div class="drawer-task-name">{{ task.plan.name }}</div>
            <div class="drawer-task-meta">
              <span><Icon icon="ph:repeat" width="12" /> {{ describePlanRepeat(task.plan) }}</span>
              <span v-if="task.plan.contractText" class="drawer-contract">
                <Icon icon="ph:quotes" width="12" /> {{ task.plan.contractText }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state drawer-empty">
          <div class="empty-state__icon"><Icon icon="ph:moon" /></div>
          <div class="empty-state__title">这一天是留白</div>
          <p class="empty-state__desc">没有安排，也是一种安排。</p>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
.week-intro {
  max-width: 470px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.7;
}

.week-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.week-summary strong {
  color: var(--text);
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 600;
}

.summary-divider {
  width: 1px;
  height: 12px;
  background: var(--border);
}

.week-range {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: var(--surface);
  font-size: 10px;
}

.week-board {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  padding-bottom: 12px;
}

.week-page {
  overflow-x: hidden;
}

.week-column {
  min-height: 470px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}

.week-column:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.week-column.is-today {
  border-color: var(--accent);
  background:
    linear-gradient(180deg, var(--accent-wash), transparent 110px),
    var(--surface);
}

.week-column-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 15px 14px 13px;
  border-bottom: 1px solid var(--border);
}

.weekday-block {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.weekday-name {
  color: var(--text-soft);
  font-size: 11px;
}

.is-today .weekday-name {
  color: var(--accent-strong);
  font-weight: 600;
}

.weekday-date {
  color: var(--text);
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 600;
  line-height: 1;
}

.weekday-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.today-dot {
  padding: 2px 6px;
  border-radius: 99px;
  color: var(--accent-strong);
  background: var(--accent-soft);
  font-size: 9px;
}

.week-column-body {
  padding: 9px 8px 14px;
}

.week-task-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.week-task {
  position: relative;
  padding: 9px 9px 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-2);
}

.week-task::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 100%;
  background: var(--gray);
  content: "";
}

.week-task--running::before {
  background: var(--info);
}

.week-task--finished::before {
  background: var(--success);
}

.week-task--skipped::before {
  background: var(--danger);
}

.week-task--delayed::before {
  background: var(--warning);
}

.week-task-time {
  color: var(--muted);
  font-size: 9px;
}

.week-task-name {
  display: -webkit-box;
  overflow: hidden;
  margin: 4px 0 7px;
  color: var(--text);
  font-size: 11px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.week-task-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--muted);
}

.week-status {
  font-size: 9px;
}

.week-status::before {
  width: 4px;
  height: 4px;
}

.status-badge.week-status {
  height: auto;
  padding: 0;
  background: transparent;
}

.week-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 44px;
  color: var(--muted);
  font-size: 10px;
}

.week-empty-line {
  width: 1px;
  height: 28px;
  background: var(--border);
}

.drawer-title {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
}

.drawer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-task {
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--surface);
}

.drawer-task-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.drawer-task-time {
  color: var(--muted);
  font-size: 10px;
}

.drawer-task-name {
  margin-top: 8px;
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
}

.drawer-task-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 7px;
  color: var(--muted);
  font-size: 10px;
}

.drawer-task-meta span {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.drawer-contract {
  font-style: italic;
  line-height: 1.5;
}

.drawer-empty {
  min-height: 300px;
}
</style>
