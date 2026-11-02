<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { NButton } from 'naive-ui'
import type { ReminderInfo, SoundType } from '@shared/types'
import { formatCountdown } from '@shared/date'
import { useSettingsStore } from '@renderer/stores/settings'
import SkipReasonModal from '@renderer/components/SkipReasonModal.vue'
import DelayModal from '@renderer/components/DelayModal.vue'

const route = useRoute()
const settingsStore = useSettingsStore()

const planId = typeof route.query.planId === 'string' ? route.query.planId : ''
const execDate = typeof route.query.execDate === 'string' ? route.query.execDate : ''
const isSecondReminder = route.query.second === '1'

const info = ref<ReminderInfo | null>(null)
const loading = ref(true)
const now = ref(Date.now())
const actionSaving = ref(false)
const showSkipModal = ref(false)
const showDelayModal = ref(false)
const failed = ref(false)

let ticker: ReturnType<typeof setInterval> | null = null

const planName = computed(() => info.value?.task.plan.name ?? '自律计划')
const remaining = computed(() => {
  if (!info.value) {
    return 0
  }
  const target = info.value.task.endAt
  return Math.max(0, target - now.value)
})
const countdown = computed(() => formatCountdown(remaining.value))
const timeRange = computed(() =>
  info.value ? `${info.value.task.startText} - ${info.value.task.endText}` : ''
)
const contract = computed(() => info.value?.task.plan.contractText.trim() ?? '')

onMounted(async () => {
  try {
    await settingsStore.load()
    info.value = await window.api.reminder.get(planId, execDate)
    if (!info.value) {
      failed.value = true
    } else {
      playAlertSound(settingsStore.settings.sound)
    }
  } catch (error) {
    console.error('加载提醒失败', error)
    failed.value = true
  } finally {
    loading.value = false
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

/** 使用 Web Audio 播放提示音，无需额外音频资源文件 */
function playAlertSound(type: SoundType): void {
  if (type === 'none') {
    return
  }
  const context = new AudioContext()
  const notes =
    type === 'chime'
      ? [
          { frequency: 880, offset: 0 },
          { frequency: 1174, offset: 0.18 },
          { frequency: 1568, offset: 0.42 }
        ]
      : [
          { frequency: 523, offset: 0 },
          { frequency: 659, offset: 0.32 }
        ]
  notes.forEach(({ frequency, offset }) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, context.currentTime + offset)
    gain.gain.linearRampToValueAtTime(0.16, context.currentTime + offset + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.4)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(context.currentTime + offset)
    oscillator.stop(context.currentTime + offset + 0.45)
  })
  setTimeout(() => {
    void context.close()
  }, 2000)
}

async function closeWindow(): Promise<void> {
  await window.api.reminder.close()
}

async function startFocus(): Promise<void> {
  if (!info.value || actionSaving.value) {
    return
  }
  actionSaving.value = true
  try {
    await window.api.plans.start(planId, execDate)
    await closeWindow()
  } catch (error) {
    console.error('开始专注失败', error)
    actionSaving.value = false
  }
}

function openSkip(): void {
  showSkipModal.value = true
}

async function confirmSkip(reason: string): Promise<void> {
  actionSaving.value = true
  try {
    await window.api.plans.skip(planId, execDate, reason)
    await closeWindow()
  } catch (error) {
    console.error('跳过任务失败', error)
    actionSaving.value = false
  }
}

function openDelay(): void {
  showDelayModal.value = true
}

async function confirmDelay(minutes: number): Promise<void> {
  actionSaving.value = true
  try {
    await window.api.plans.delay(planId, execDate, minutes)
    await closeWindow()
  } catch (error) {
    console.error('延期任务失败', error)
    actionSaving.value = false
  }
}
</script>

<template>
  <div class="reminder-page">
    <section class="reminder-card">
      <button type="button" class="close-button" title="暂时关闭" @click="closeWindow">
        <Icon icon="ph:x" width="16" />
      </button>

      <header class="reminder-head">
        <div class="head-mark"><Icon icon="ph:bell-ringing" width="22" /></div>
        <div class="head-copy">
          <div class="eyebrow">A MOMENT OF FOCUS</div>
          <div class="head-meta">
            <span class="mini-tag">当前时间 {{ timeRange || '—' }}</span>
            <span v-if="isSecondReminder" class="mini-tag mini-tag--warning">第二次提醒</span>
          </div>
        </div>
      </header>

      <div v-if="loading" class="reminder-body reminder-body--center">
        <span class="muted">正在读取这一段自律安排…</span>
      </div>

      <div v-else-if="failed || !info" class="reminder-body reminder-body--center">
        <div class="empty-state__icon"><Icon icon="ph:leaf" /></div>
        <p class="reminder-empty">这个计划已经结束，或提醒已被关闭。</p>
        <n-button secondary @click="closeWindow">关闭窗口</n-button>
      </div>

      <div v-else class="reminder-body">
        <h1 class="reminder-title">
          现在是<span class="highlight">「{{ planName }}」</span>的自律时间
        </h1>

        <div class="contract-block" :class="{ 'is-empty': !contract }">
          <div class="contract-label">
            <Icon icon="ph:seal-check" width="14" />
            你写给自己的契约
          </div>
          <p class="contract-text">
            {{ contract || '专注当下，完成这一段属于你的时间。' }}
          </p>
        </div>

        <div class="countdown-block">
          <span class="countdown-label">距离本次结束还剩</span>
          <div class="countdown mono">{{ countdown }}</div>
          <span class="countdown-hint">
            {{ remaining > 0 ? '不必做完所有事，先做眼前这一小段。' : '计划时段已结束，仍可手动完成记录。' }}
          </span>
        </div>

        <div class="reminder-actions">
          <n-button type="primary" size="large" :loading="actionSaving" @click="startFocus">
            <template #icon><Icon icon="ph:play" /></template>
            开始专注
          </n-button>
          <n-button type="warning" secondary size="large" @click="openDelay">
            <template #icon><Icon icon="ph:clock-counter-clockwise" /></template>
            延期
          </n-button>
          <n-button type="error" secondary size="large" @click="openSkip">
            <template #icon><Icon icon="ph:skip-forward" /></template>
            跳过
          </n-button>
        </div>

        <p class="privacy-note">
          <Icon icon="ph:shield-check" width="12" />
          静时完全离线运行，这次提醒不会离开你的电脑。
        </p>
      </div>
    </section>

    <SkipReasonModal
      v-model:show="showSkipModal"
      :plan-name="planName"
      :saving="actionSaving"
      @confirm="confirmSkip"
    />
    <DelayModal
      v-model:show="showDelayModal"
      :plan-name="planName"
      :saving="actionSaving"
      @confirm="confirmDelay"
    />
  </div>
</template>

<style scoped>
.reminder-page {
  display: flex;
  width: 100%;
  height: 100%;
  padding: 10px;
}

.reminder-card {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 22px 26px 24px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background:
    radial-gradient(circle at 100% 0, var(--accent-wash), transparent 46%),
    var(--surface);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.close-button {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
  transition: all 0.16s ease;
}

.close-button:hover {
  color: var(--text);
  background: var(--surface-2);
}

.reminder-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.head-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  color: var(--accent);
  background: var(--accent-soft);
  animation: ring-soft 1.6s ease-in-out 2;
}

@keyframes ring-soft {
  0%,
  100% {
    transform: rotate(0);
  }
  20% {
    transform: rotate(-8deg);
  }
  40% {
    transform: rotate(8deg);
  }
  60% {
    transform: rotate(-5deg);
  }
  80% {
    transform: rotate(4deg);
  }
}

.head-copy {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.head-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.mini-tag--warning {
  border-color: color-mix(in srgb, var(--warning) 40%, transparent);
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
}

.reminder-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  margin-top: 22px;
}

.reminder-body--center {
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
}

.reminder-empty {
  color: var(--muted);
  font-size: 12px;
}

.reminder-title {
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 600;
  line-height: 1.6;
  letter-spacing: 0.02em;
}

.highlight {
  color: var(--accent-strong);
}

.contract-block {
  padding: 14px 16px;
  margin-top: 16px;
  border-left: 3px solid var(--accent);
  border-radius: 4px 12px 12px 4px;
  background: var(--accent-wash);
}

.contract-block.is-empty {
  border-left-color: var(--border-strong);
  background: var(--surface-2);
}

.contract-label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.08em;
}

.contract-text {
  margin-top: 7px;
  color: var(--text-soft);
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.countdown-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0 18px;
  margin-top: 16px;
  border: 1px dashed var(--border-strong);
  border-radius: 14px;
  background: var(--bg-elevated);
}

.countdown-label {
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.12em;
}

.countdown {
  margin: 6px 0 4px;
  color: var(--accent-strong);
  font-family: var(--font-serif);
  font-size: 44px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1;
}

.countdown-hint {
  color: var(--muted);
  font-size: 10px;
}

.reminder-actions {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 8px;
  margin-top: auto;
  padding-top: 18px;
}

.privacy-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 12px;
  color: var(--muted);
  font-size: 9px;
}
</style>
