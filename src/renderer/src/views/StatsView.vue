<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { NSpin, useMessage } from 'naive-ui'
import type { StatsPeriod, StatsSnapshot } from '@shared/types'
import StatsBarChart from '@renderer/components/StatsBarChart.vue'

const message = useMessage()
const period = ref<StatsPeriod>('week')
const loading = ref(false)
const stats = ref<StatsSnapshot | null>(null)

const periodOptions: Array<{ value: StatsPeriod; label: string; caption: string }> = [
  { value: 'week', label: '本周', caption: '本周每日完成情况' },
  { value: 'month', label: '本月', caption: '本月每日完成情况' },
  { value: 'all', label: '全部', caption: '全部时间按月完成情况' }
]

const chartCaption = computed(
  () => periodOptions.find((option) => option.value === period.value)?.caption ?? ''
)

onMounted(() => {
  void loadStats()
})

watch(period, () => {
  void loadStats(false)
})

async function loadStats(withLoading = true): Promise<void> {
  if (withLoading) {
    loading.value = true
  }
  try {
    stats.value = await window.api.stats.get(period.value)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载统计失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page stats-page">
    <div class="stats-toolbar">
      <p class="stats-intro">不是每一天都要完美，只要趋势还在向前。</p>
      <div class="period-switch">
        <button
          v-for="option in periodOptions"
          :key="option.value"
          type="button"
          class="period-button"
          :class="{ 'is-active': period === option.value }"
          @click="period = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <n-spin :show="loading">
      <template v-if="stats">
        <section class="stats-hero">
          <div class="completion-card panel">
            <div class="completion-copy">
              <div class="eyebrow">COMPLETION</div>
              <h2 class="completion-title">总完成率</h2>
              <p class="completion-desc">
                {{ stats.finishedOccurrences }} 次完成 / {{ stats.totalOccurrences }} 次计划
              </p>
            </div>
            <div class="completion-number">
              {{ stats.completionRate }}<span>%</span>
            </div>
            <div class="completion-bar">
              <div class="completion-bar-fill" :style="{ width: `${stats.completionRate}%` }" />
            </div>
          </div>

          <div class="streak-card panel">
            <div class="streak-icon streak-icon--flame"><Icon icon="ph:flame" width="21" /></div>
            <div class="streak-copy">
              <span class="stat-label">连续打卡</span>
              <span class="streak-value">{{ stats.currentStreak }}<small>天</small></span>
              <span class="streak-note">连续完成任意计划</span>
            </div>
            <div class="streak-divider" />
            <div class="streak-icon streak-icon--trophy"><Icon icon="ph:trophy" width="21" /></div>
            <div class="streak-copy">
              <span class="stat-label">最长连续</span>
              <span class="streak-value">{{ stats.longestStreak }}<small>天</small></span>
              <span class="streak-note">历史最佳记录</span>
            </div>
          </div>
        </section>

        <section class="chart-panel panel">
          <div class="chart-head">
            <div>
              <div class="eyebrow">COMPLETED TREND</div>
              <h3 class="section-title">完成趋势</h3>
            </div>
            <div class="chart-meta">
              <span class="chart-legend"><span class="legend-dot" /> 完成数</span>
              <span class="chart-caption">{{ chartCaption }}</span>
            </div>
          </div>
          <StatsBarChart :bars="stats.bars" />
        </section>

        <section class="insight-strip">
          <div class="insight-item">
            <Icon icon="ph:calendar-check" width="16" />
            <span>本期计划 <strong>{{ stats.totalOccurrences }}</strong> 次</span>
          </div>
          <div class="insight-item">
            <Icon icon="ph:check-circle" width="16" />
            <span>本期完成 <strong>{{ stats.finishedOccurrences }}</strong> 次</span>
          </div>
          <div class="insight-quote">
            <Icon icon="ph:quotes" width="14" />
            记录不会评判你，它只是诚实地告诉你，时间去了哪里。
          </div>
        </section>
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
.stats-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.stats-intro {
  max-width: 440px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.7;
}

.period-switch {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
}

.period-button {
  height: 29px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  color: var(--text-soft);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.16s ease;
}

.period-button.is-active {
  color: var(--accent-strong);
  background: var(--accent-soft);
  font-weight: 600;
}

.stats-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 12px;
}

.completion-card {
  position: relative;
  padding: 22px 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0, var(--accent-wash), transparent 50%),
    var(--surface);
}

.completion-title {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
}

.completion-desc {
  margin-top: 8px;
  color: var(--muted);
  font-size: 11px;
}

.completion-number {
  position: absolute;
  top: 24px;
  right: 26px;
  color: var(--accent-strong);
  font-family: var(--font-serif);
  font-size: 50px;
  font-weight: 600;
  line-height: 1;
}

.completion-number span {
  margin-left: 2px;
  font-family: var(--font-sans);
  font-size: 16px;
}

.completion-bar {
  height: 6px;
  overflow: hidden;
  margin-top: 24px;
  border-radius: 99px;
  background: var(--surface-2);
}

.completion-bar-fill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  transition: width 0.35s ease;
}

.streak-card {
  display: grid;
  grid-template-columns: 38px 1fr 1px 38px 1fr;
  align-items: center;
  gap: 10px;
  padding: 18px;
}

.streak-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
}

.streak-icon--flame {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 11%, transparent);
}

.streak-icon--trophy {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 11%, transparent);
}

.streak-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  color: var(--muted);
  font-size: 10px;
}

.streak-value {
  color: var(--text);
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 600;
  line-height: 1.1;
}

.streak-value small {
  margin-left: 2px;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 9px;
  font-weight: 400;
}

.streak-note {
  color: var(--muted);
  font-size: 9px;
}

.streak-divider {
  align-self: stretch;
  width: 1px;
  margin: 8px 0;
  background: var(--border);
}

.chart-panel {
  padding: 20px 22px 12px;
  margin-top: 12px;
}

.chart-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.chart-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--muted);
  font-size: 10px;
}

.chart-legend {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: var(--accent);
}

.chart-caption {
  font-size: 10px;
}

.insight-strip {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
  padding: 16px 4px 0;
}

.insight-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 10px;
}

.insight-item strong {
  color: var(--text-soft);
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
}

.insight-quote {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 11px;
  font-style: italic;
}

@media (max-width: 1100px) {
  .stats-hero {
    grid-template-columns: 1fr;
  }

  .insight-quote {
    margin-left: 0;
  }
}
</style>
