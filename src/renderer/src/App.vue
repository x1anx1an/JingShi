<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NMessageProvider,
  NNotificationProvider,
  darkTheme,
  dateZhCN,
  zhCN,
  type GlobalThemeOverrides
} from 'naive-ui'
import { useSettingsStore } from '@renderer/stores/settings'
import { usePlanStore } from '@renderer/stores/plan'
import { useCurrentTaskStore } from '@renderer/stores/current-task'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const planStore = usePlanStore()
const currentTaskStore = useCurrentTaskStore()

const theme = computed(() => (settingsStore.isDark ? darkTheme : null))

// 深浅主题各用一套主色，保证文字与背景的对比度
const themeOverrides = computed<GlobalThemeOverrides>(() => {
  const dark = settingsStore.isDark
  return {
    common: {
      primaryColor: dark ? '#90b69e' : '#557b68',
      primaryColorHover: dark ? '#a5c7b2' : '#668d78',
      primaryColorPressed: dark ? '#749981' : '#466757',
      primaryColorSuppl: dark ? '#7ea58d' : '#8aa79a',
      infoColor: dark ? '#76a8c2' : '#5d7e8e',
      successColor: dark ? '#7bb28b' : '#4f8561',
      warningColor: dark ? '#d9a45b' : '#c18742',
      errorColor: dark ? '#d98b85' : '#b15752',
      borderRadius: '10px',
      fontFamily:
        '"Inter", "Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    },
    Button: {
      borderRadiusMedium: '9px',
      borderRadiusSmall: '8px'
    },
    Card: {
      borderRadius: '18px'
    },
    Modal: {
      borderRadius: '20px'
    },
    Tag: {
      borderRadius: '999px'
    }
  }
})

const unsubscribes: Array<() => void> = []
let planRefreshTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => Boolean(route.meta.transparent),
  (transparent) => {
    document.body.classList.toggle('window-transparent', transparent)
  },
  { immediate: true }
)

onMounted(async () => {
  try {
    await settingsStore.load()
  } catch (error) {
    console.error('加载设置失败', error)
  }

  unsubscribes.push(
    window.api.events.onSettingsChanged((settings) => {
      settingsStore.applyRemoteSettings(settings)
    })
  )
  unsubscribes.push(
    window.api.events.onNavigate((path) => {
      void router.push(path)
    })
  )
  unsubscribes.push(
    window.api.events.onDataChanged(() => {
      if (planRefreshTimer) {
        clearTimeout(planRefreshTimer)
      }
      planRefreshTimer = setTimeout(() => {
        planStore.handleExternalChange()
        currentTaskStore.handleExternalChange()
      }, 80)
    })
  )
})

onBeforeUnmount(() => {
  unsubscribes.forEach((unsubscribe) => unsubscribe())
  if (planRefreshTimer) {
    clearTimeout(planRefreshTimer)
  }
})
</script>

<template>
  <n-config-provider
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <router-view />
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
