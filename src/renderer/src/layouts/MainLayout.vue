<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { NSwitch, useMessage } from 'naive-ui'
import { useSettingsStore } from '@renderer/stores/settings'

const route = useRoute()
const settingsStore = useSettingsStore()
const message = useMessage()

const navItems = [
  { to: '/', label: '今日看板', icon: 'ph:sun-horizon', match: 'today' },
  { to: '/week', label: '周视图', icon: 'ph:calendar-dots', match: 'week' },
  { to: '/records', label: '执行记录', icon: 'ph:clock-counter-clockwise', match: 'records' },
  { to: '/stats', label: '统计', icon: 'ph:chart-bar', match: 'stats' },
  { to: '/settings', label: '设置', icon: 'ph:sliders-horizontal', match: 'settings' }
]

const pageTitle = computed(() => String(route.meta.title ?? '今日看板'))
const pageKicker = computed(() => String(route.meta.kicker ?? 'TODAY'))

const dateLabel = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
}).format(new Date())

function isActive(match: string): boolean {
  return route.name === match
}

async function handleThemeChange(value: boolean): Promise<void> {
  try {
    await settingsStore.update({ theme: value ? 'dark' : 'light' })
  } catch (error) {
    message.error(error instanceof Error ? error.message : '切换主题失败')
  }
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">静</div>
        <div class="brand-copy">
          <div class="brand-name">静时</div>
          <div class="brand-sub">把时间安静下来</div>
        </div>
      </div>

      <div class="rail-label">自律空间</div>
      <nav class="nav-list">
        <router-link
          v-for="item in navItems"
          :key="item.match"
          :to="item.to"
          class="nav-item"
          :class="{ 'is-active': isActive(item.match) }"
        >
          <Icon :icon="item.icon" width="19" />
          <span>{{ item.label }}</span>
          <span v-if="isActive(item.match)" class="nav-dot" />
        </router-link>
      </nav>

      <div class="rail-spacer" />

      <div class="rail-note">
        <Icon icon="ph:lock-key" width="15" />
        <span>数据仅保存在本机</span>
      </div>

      <div class="rail-footer">
        <router-link to="/about" class="about-link" :class="{ 'is-active': route.name === 'about' }">
          <Icon icon="ph:info" width="17" />
          <span>关于静时</span>
        </router-link>
        <div class="theme-row">
          <div class="theme-copy">
            <Icon :icon="settingsStore.isDark ? 'ph:moon-stars' : 'ph:sun'" width="17" />
            <span>{{ settingsStore.isDark ? '深色主题' : '浅色主题' }}</span>
          </div>
          <n-switch
            :value="settingsStore.isDark"
            size="small"
            :loading="settingsStore.saving"
            @update:value="handleThemeChange"
          />
        </div>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div class="topbar-heading">
          <div class="eyebrow">{{ pageKicker }}</div>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="topbar-meta">
          <div class="local-pill">
            <Icon icon="ph:shield-check" width="14" />
            <span>本地模式 · 不上传网络</span>
          </div>
          <span class="topbar-date">{{ dateLabel }}</span>
        </div>
      </header>

      <div class="content-scroll">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  background: var(--bg);
}

.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 28px 18px 20px;
  overflow: hidden;
  border-right: 1px solid var(--border);
  background:
    radial-gradient(circle at 0 0, var(--accent-wash), transparent 36%),
    var(--bg-elevated);
}

.sidebar::after {
  position: absolute;
  right: -70px;
  bottom: -90px;
  width: 200px;
  height: 200px;
  border: 1px solid var(--border);
  border-radius: 50%;
  content: "";
  opacity: 0.5;
  /* 纯装饰圆环不能拦截鼠标，否则会盖住底部主题开关 */
  pointer-events: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px 30px;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--accent);
  border-radius: 50%;
  color: var(--accent-strong);
  background: var(--accent-soft);
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 600;
}

.brand-name {
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0.12em;
  line-height: 1.1;
}

.brand-sub {
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.13em;
}

.rail-label {
  padding: 0 10px;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2em;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  height: 44px;
  padding: 0 12px;
  border-radius: 11px;
  color: var(--text-soft);
  font-size: 13px;
  text-decoration: none;
  transition:
    color 0.18s ease,
    background 0.18s ease;
}

.nav-item:hover {
  color: var(--text);
  background: var(--accent-wash);
}

.nav-item.is-active {
  color: var(--accent-strong);
  background: var(--accent-soft);
  font-weight: 600;
}

.nav-item.is-active::before {
  position: absolute;
  left: 0;
  width: 3px;
  height: 18px;
  border-radius: 0 3px 3px 0;
  background: var(--accent);
  content: "";
}

.nav-dot {
  width: 5px;
  height: 5px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--accent);
}

.rail-spacer {
  flex: 1;
}

.rail-note {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 11px 12px;
  margin-bottom: 12px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  color: var(--muted);
  font-size: 10px;
}

.rail-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.about-link {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  border-radius: 9px;
  color: var(--text-soft);
  font-size: 12px;
  text-decoration: none;
}

.about-link:hover,
.about-link.is-active {
  color: var(--accent);
  background: var(--accent-wash);
}

.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
}

.theme-copy {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-soft);
  font-size: 11px;
}

.workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background:
    radial-gradient(circle at 92% 0, var(--accent-wash), transparent 26%),
    radial-gradient(circle at 0 100%, rgba(194, 135, 62, 0.045), transparent 30%),
    var(--bg);
}

.topbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: 100px;
  padding: 24px 36px 12px;
}

.topbar-heading h1 {
  margin-top: 5px;
  font-family: var(--font-serif);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 0.03em;
  line-height: 1.15;
}

.topbar-meta {
  display: flex;
  align-items: center;
  gap: 14px;
}

.local-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-soft);
  background: var(--surface);
  font-size: 10px;
  letter-spacing: 0.02em;
}

.topbar-date {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.05em;
}

.content-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 1080px) {
  .app-shell {
    grid-template-columns: 210px minmax(0, 1fr);
  }

  .topbar {
    padding-right: 24px;
    padding-left: 24px;
  }

  .local-pill {
    display: none;
  }
}
</style>
