<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { NButton, NSpin, NTooltip, useDialog, useMessage } from 'naive-ui'
import type { Plan, PlanInput, TaskItem } from '@shared/types'
import { usePlanStore } from '@renderer/stores/plan'
import TaskCard from '@renderer/components/TaskCard.vue'
import PlanModal from '@renderer/components/PlanModal.vue'
import SkipReasonModal from '@renderer/components/SkipReasonModal.vue'
import DelayModal from '@renderer/components/DelayModal.vue'
import TaskDetailModal from '@renderer/components/TaskDetailModal.vue'

const planStore = usePlanStore()
const message = useMessage()
const dialog = useDialog()

const showPlanModal = ref(false)
const editingPlan = ref<Plan | null>(null)
const planSaving = ref(false)

const activeTask = ref<TaskItem | null>(null)
const showSkipModal = ref(false)
const showDelayModal = ref(false)
const actionSaving = ref(false)
const showDetailModal = ref(false)

const statTiles = computed(() => [
  {
    label: '今日计划',
    value: String(planStore.stats.total),
    unit: '项',
    icon: 'ph:list-checks',
    tone: 'accent'
  },
  {
    label: '已完成',
    value: String(planStore.stats.finished),
    unit: '项',
    icon: 'ph:check-circle',
    tone: 'success'
  },
  {
    label: '进行中',
    value: String(planStore.stats.inProgress),
    unit: '项',
    icon: 'ph:play-circle',
    tone: 'info'
  },
  {
    label: '已跳过',
    value: String(planStore.stats.skipped),
    unit: '项',
    icon: 'ph:skip-forward',
    tone: 'danger'
  }
])

onMounted(async () => {
  try {
    await planStore.loadToday()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载今日计划失败')
  }
})

function openCreate(): void {
  editingPlan.value = null
  showPlanModal.value = true
}

function openEdit(task: TaskItem): void {
  editingPlan.value = task.plan
  showPlanModal.value = true
}

async function handlePlanSave(input: PlanInput): Promise<void> {
  planSaving.value = true
  try {
    if (editingPlan.value) {
      await planStore.update(editingPlan.value.id, input)
      message.success('计划已更新')
    } else {
      await planStore.create(input)
      message.success('计划已创建')
    }
    showPlanModal.value = false
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存计划失败')
  } finally {
    planSaving.value = false
  }
}

async function handleStart(task: TaskItem): Promise<void> {
  try {
    await planStore.start(task.plan.id, task.execDate)
    message.success('专注开始，悬浮窗会同步显示')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '开始任务失败')
  }
}

async function handlePause(task: TaskItem): Promise<void> {
  try {
    await planStore.pause(task.plan.id, task.execDate)
    message.info('任务已暂停，倒计时会停留在原地')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '暂停任务失败')
  }
}

async function handleResume(task: TaskItem): Promise<void> {
  try {
    await planStore.resume(task.plan.id, task.execDate)
    message.success('继续专注')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '继续任务失败')
  }
}

async function handleFinish(task: TaskItem): Promise<void> {
  try {
    await planStore.finish(task.plan.id, task.execDate)
    message.success('这一段自律已完成')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '完成任务失败')
  }
}

function openSkip(task: TaskItem): void {
  activeTask.value = task
  showSkipModal.value = true
}

async function confirmSkip(reason: string): Promise<void> {
  if (!activeTask.value) {
    return
  }
  actionSaving.value = true
  try {
    await planStore.skip(activeTask.value.plan.id, activeTask.value.execDate, reason)
    showSkipModal.value = false
    activeTask.value = null
    message.success('已跳过，理由已存入复盘记录')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '跳过任务失败')
  } finally {
    actionSaving.value = false
  }
}

function openDelay(task: TaskItem): void {
  activeTask.value = task
  showDelayModal.value = true
}

async function confirmDelay(minutes: number): Promise<void> {
  if (!activeTask.value) {
    return
  }
  actionSaving.value = true
  try {
    await planStore.delay(activeTask.value.plan.id, activeTask.value.execDate, minutes)
    showDelayModal.value = false
    activeTask.value = null
    message.success(`已延期 ${minutes} 分钟，将在新的时间点提醒`)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '延期任务失败')
  } finally {
    actionSaving.value = false
  }
}

function openDetail(task: TaskItem): void {
  activeTask.value = task
  showDetailModal.value = true
}

function handleRemove(task: TaskItem): void {
  dialog.warning({
    title: '删除计划',
    content: `确定删除「${task.plan.name}」吗？历史执行记录会保留，用于之后复盘。`,
    positiveText: '删除计划',
    negativeText: '保留',
    onPositiveClick: async () => {
      try {
        await planStore.remove(task.plan.id)
        message.success('计划已删除')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除计划失败')
      }
    }
  })
}
</script>

<template>
  <div class="page today-page">
    <n-spin :show="planStore.loading">
      <section class="today-intro">
        <div class="intro-copy">
          <div class="eyebrow">A QUIET DAY</div>
          <h2 class="intro-title">给今天，留几段不被打扰的时间。</h2>
          <p class="intro-sub">
            不必追赶所有事情，先完成眼前这一小段。今日完成率
            <strong>{{ planStore.stats.completionRate }}%</strong>。
          </p>
        </div>
        <div class="progress-orbit" :style="{ '--progress': `${planStore.stats.completionRate * 3.6}deg` }">
          <div class="progress-inner">
            <span class="progress-value">{{ planStore.stats.completionRate }}<small>%</small></span>
            <span class="progress-label">完成率</span>
          </div>
        </div>
      </section>

      <section class="stat-grid">
        <div
          v-for="tile in statTiles"
          :key="tile.label"
          class="stat-tile panel"
          :class="`stat-tile--${tile.tone}`"
        >
          <div class="stat-icon"><Icon :icon="tile.icon" width="18" /></div>
          <div class="stat-copy">
            <span class="stat-label">{{ tile.label }}</span>
            <span class="stat-value">
              {{ tile.value }}<small>{{ tile.unit }}</small>
            </span>
          </div>
        </div>
      </section>

      <div class="section-head">
        <div>
          <div class="eyebrow">TODAY'S RHYTHM</div>
          <h3 class="section-title">今日节奏</h3>
        </div>
        <span class="section-caption">按开始时间排列 · 共 {{ planStore.stats.total }} 项</span>
      </div>

      <section v-if="planStore.tasks.length" class="task-list">
        <TaskCard
          v-for="task in planStore.tasks"
          :key="`${task.plan.id}-${task.execDate}`"
          :task="task"
          @start="handleStart(task)"
          @pause="handlePause(task)"
          @resume="handleResume(task)"
          @finish="handleFinish(task)"
          @delay="openDelay(task)"
          @skip="openSkip(task)"
          @edit="openEdit(task)"
          @remove="handleRemove(task)"
          @view="openDetail(task)"
        />
      </section>

      <section v-else class="empty-state panel">
        <div class="empty-state__icon"><Icon icon="ph:leaf" /></div>
        <div class="empty-state__title">今天还没有安排</div>
        <p class="empty-state__desc">
          空白不是浪费，是留给真正重要事情的位置。创建一个小计划，从容易完成的一段开始。
        </p>
        <n-button type="primary" secondary @click="openCreate">
          <template #icon><Icon icon="ph:plus" /></template>
          新建计划
        </n-button>
      </section>
    </n-spin>

    <n-tooltip trigger="hover" placement="left">
      <template #trigger>
        <n-button class="fab" type="primary" circle size="large" @click="openCreate">
          <template #icon><Icon icon="ph:plus" width="22" /></template>
        </n-button>
      </template>
      新建自律计划
    </n-tooltip>

    <PlanModal
      v-model:show="showPlanModal"
      :plan="editingPlan"
      :saving="planSaving"
      @save="handlePlanSave"
    />
    <SkipReasonModal
      v-model:show="showSkipModal"
      :plan-name="activeTask?.plan.name"
      :saving="actionSaving"
      @confirm="confirmSkip"
    />
    <DelayModal
      v-model:show="showDelayModal"
      :plan-name="activeTask?.plan.name"
      :saving="actionSaving"
      @confirm="confirmDelay"
    />
    <TaskDetailModal v-model:show="showDetailModal" :task="activeTask" />
  </div>
</template>

<style scoped>
.today-page {
  position: relative;
}

.today-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 26px;
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(110deg, var(--accent-wash), transparent 52%),
    var(--surface);
  box-shadow: var(--shadow-soft);
}

.intro-title {
  margin: 5px 0 6px;
  font-family: var(--font-serif);
  font-size: 23px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.intro-sub {
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.7;
}

.intro-sub strong {
  color: var(--accent-strong);
  font-weight: 600;
}

.progress-orbit {
  --progress: 0deg;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background: conic-gradient(var(--accent) var(--progress), var(--surface-2) 0);
  box-shadow: inset 0 0 0 1px var(--border);
}

.progress-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--surface);
}

.progress-value {
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 600;
  line-height: 1;
}

.progress-value small {
  margin-left: 1px;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 10px;
}

.progress-label {
  margin-top: 5px;
  color: var(--muted);
  font-size: 9px;
  letter-spacing: 0.1em;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stat-tile {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 14px 15px;
  border-radius: 13px;
  box-shadow: none;
}

.stat-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
}

.stat-tile--accent .stat-icon {
  color: var(--accent);
  background: var(--accent-soft);
}

.stat-tile--success .stat-icon {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.stat-tile--info .stat-icon {
  color: var(--info);
  background: color-mix(in srgb, var(--info) 10%, transparent);
}

.stat-tile--danger .stat-icon {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.stat-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-label {
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.05em;
}

.stat-value {
  color: var(--text);
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 600;
  line-height: 1;
}

.stat-value small {
  margin-left: 2px;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 9px;
  font-weight: 400;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fab {
  position: fixed;
  right: 38px;
  bottom: 34px;
  z-index: 30;
  width: 52px;
  height: 52px;
  box-shadow: 0 12px 30px rgba(55, 84, 68, 0.25);
}

@media (max-width: 1100px) {
  .intro-title {
    font-size: 20px;
  }

  .progress-orbit {
    width: 82px;
    height: 82px;
  }

  .progress-inner {
    width: 68px;
    height: 68px;
  }
}
</style>
