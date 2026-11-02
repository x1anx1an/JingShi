<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { NButton } from 'naive-ui'
import { formatCountdown } from '@shared/date'
import { useCurrentTaskStore } from '@renderer/stores/current-task'

const currentTaskStore = useCurrentTaskStore()

const now = ref(Date.now())
const acting = ref(false)

let ticker: ReturnType<typeof setInterval> | null = null

const task = computed(() => currentTaskStore.task)
const paused = computed(() => !!task.value?.paused)

/** 暂停时使用快照中的剩余时间，运行中则按结束时间实时计算 */
const remaining = computed(() => {
  if (!task.value) {
    return 0
  }
  return task.value.paused ? task.value.remainingMs : Math.max(0, task.value.endAt - now.value)
})
const countdown = computed(() => formatCountdown(remaining.value))

onMounted(async () => {
  try {
    await currentTaskStore.load()
  } catch (error) {
    console.error('加载当前任务失败', error)
  }
  ticker = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (ticker) {
    clearInterval(ticker)
  }
})

async function finishTask(): Promise<void> {
  if (!task.value || acting.value) {
    return
  }
  acting.value = true
  try {
    await currentTaskStore.finish()
  } catch (error) {
    console.error('完成任务失败', error)
  } finally {
    acting.value = false
  }
}

async function togglePause(): Promise<void> {
  if (!task.value || acting.value) {
    return
  }
  acting.value = true
  try {
    await currentTaskStore.togglePause()
    now.value = Date.now()
  } catch (error) {
    console.error('切换暂停状态失败', error)
  } finally {
    acting.value = false
  }
}

/**
 * 双击执行设置中配置的动作（默认打开主面板）。
 * 仅按钮本身不触发；内容区与空状态提示都可双击，
 * 因此内容区必须设置为 no-drag，否则 Windows 拖拽区域会吞掉鼠标事件。
 */
function handleDoubleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('.n-button, button')) {
    return
  }
  void window.api.float.doubleClick()
}
</script>

<template>
  <div class="float-shell" @dblclick="handleDoubleClick">
    <section class="float-card">
      <header class="float-head">
        <span class="float-brand">
          <Icon icon="ph:leaf" width="13" />
          静时
        </span>
        <span v-if="task" class="float-status" :class="{ 'is-paused': paused }">
          <span class="status-dot" />
          {{ paused ? '已暂停' : '专注中' }}
        </span>
        <span v-else class="float-status is-idle">
          <span class="status-dot" />
          空闲
        </span>
      </header>

      <div v-if="task" class="float-body">
        <div class="float-info">
          <div class="float-name" :title="task.plan.name">{{ task.plan.name }}</div>
          <div class="float-sub">
            {{ task.startText }} - {{ task.endText }}
            <span v-if="currentTaskStore.otherCount > 0">
              · 另有 {{ currentTaskStore.otherCount }} 项进行中
            </span>
          </div>
        </div>
        <div class="float-clock mono" :class="{ 'is-paused': paused }">{{ countdown }}</div>
      </div>

      <div v-else class="float-empty">
        <Icon icon="ph:moon" width="18" />
        <span>暂无自律任务</span>
      </div>

      <footer class="float-actions no-drag">
        <n-button
          v-if="task"
          size="tiny"
          type="primary"
          :loading="acting"
          @click="finishTask"
        >
          <template #icon><Icon icon="ph:check" width="12" /></template>
          完成
        </n-button>
        <n-button v-if="task" size="tiny" secondary :disabled="acting" @click="togglePause">
          <template #icon>
            <Icon :icon="paused ? 'ph:play' : 'ph:pause'" width="12" />
          </template>
          {{ paused ? '继续' : '暂停' }}
        </n-button>
        <span v-else class="float-tip">双击打开主面板，安排下一段自律</span>
      </footer>
    </section>
  </div>
</template>

<style scoped>
/* 整个外壳可拖动，内容与按钮区域通过 no-drag 恢复鼠标事件 */
.float-shell {
  width: 100%;
  /* 外层 NaiveUI Provider 容器没有高度，这里用视口高度撑满悬浮窗 */
  height: 100vh;
  padding: 6px;
  -webkit-app-region: drag;
  user-select: none;
  -webkit-user-select: none;
}

.float-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 11px 14px 10px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

.float-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.float-brand {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent-strong);
  font-family: var(--font-serif);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
}

.float-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--info);
  font-size: 9px;
  letter-spacing: 0.06em;
}

.float-status.is-paused {
  color: var(--warning);
}

.float-status.is-idle {
  color: var(--muted);
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-dot 2s ease-in-out infinite;
}

.float-status.is-paused .status-dot {
  animation: none;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.float-body {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 9px;
  -webkit-app-region: no-drag;
}

.float-info {
  flex: 1;
  min-width: 0;
}

.float-name {
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.float-sub {
  margin-top: 3px;
  overflow: hidden;
  color: var(--muted);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.float-clock {
  flex-shrink: 0;
  color: var(--accent-strong);
  font-family: var(--font-serif);
  font-size: 25px;
  font-weight: 600;
  letter-spacing: 0.03em;
  line-height: 1;
}

.float-clock.is-paused {
  color: var(--warning);
}

.float-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 12px;
  -webkit-app-region: no-drag;
}

.float-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 8px;
  -webkit-app-region: no-drag;
}

.float-tip {
  color: var(--muted);
  font-size: 9px;
}

/* 按钮必须可点击，不能被系统拖拽区域吞掉 */
.float-actions :deep(.n-button) {
  -webkit-app-region: no-drag;
}
</style>

<style>
/* 悬浮窗仅展示信息，禁止选中文本，避免拖动时出现蓝色选区 */
body * {
  user-select: none;
  -webkit-user-select: none;
}
</style>
