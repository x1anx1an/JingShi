<script setup lang="ts">
import { computed } from 'vue'
import type { ChartBar } from '@shared/types'

const props = defineProps<{
  bars: ChartBar[]
}>()

const maxValue = computed(() => Math.max(1, ...props.bars.map((bar) => bar.value)))

function height(value: number): string {
  if (value === 0) {
    return '3px'
  }
  return `${Math.max(10, (value / maxValue.value) * 100)}%`
}
</script>

<template>
  <div class="chart-shell">
    <div class="chart-grid-line chart-grid-line--top" />
    <div class="chart-grid-line chart-grid-line--middle" />
    <div class="chart-grid-line chart-grid-line--bottom" />
    <div class="chart-bars">
      <div v-for="(bar, index) in bars" :key="`${bar.label}-${index}`" class="bar-column" :title="bar.hint">
        <span class="bar-value">{{ bar.value }}</span>
        <div class="bar-track">
          <div class="bar-fill" :style="{ height: height(bar.value) }" />
        </div>
        <span class="bar-label">{{ bar.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-shell {
  position: relative;
  width: 100%;
  min-height: 240px;
  padding: 18px 4px 0;
  overflow-x: auto;
}

.chart-grid-line {
  position: absolute;
  right: 4px;
  left: 4px;
  height: 1px;
  background: var(--border);
  opacity: 0.55;
}

.chart-grid-line--top {
  top: 26px;
}

.chart-grid-line--middle {
  top: 48%;
}

.chart-grid-line--bottom {
  bottom: 28px;
}

.chart-bars {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  width: 100%;
  min-width: max-content;
  height: 206px;
}

.bar-column {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  min-width: 34px;
  height: 100%;
}

.bar-value {
  height: 18px;
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.bar-track {
  display: flex;
  flex: 1;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  min-height: 0;
}

.bar-fill {
  width: min(22px, 70%);
  min-height: 3px;
  border-radius: 5px 5px 2px 2px;
  background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 58%, var(--surface)));
  transition: height 0.3s ease;
}

.bar-column:hover .bar-fill {
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
}

.bar-label {
  height: 26px;
  padding-top: 8px;
  color: var(--muted);
  font-size: 9px;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
</style>
