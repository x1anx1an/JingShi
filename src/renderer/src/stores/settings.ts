import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)
  const saving = ref(false)

  const isDark = computed(() => settings.value.theme === 'dark')

  watch(
    () => settings.value.theme,
    (theme) => {
      document.documentElement.dataset.theme = theme
    },
    { immediate: true }
  )

  async function load(): Promise<void> {
    settings.value = await window.api.settings.get()
    loaded.value = true
  }

  async function update(patch: Partial<AppSettings>): Promise<void> {
    const previous = { ...settings.value }
    settings.value = { ...settings.value, ...patch }
    saving.value = true
    try {
      settings.value = await window.api.settings.update(patch)
      loaded.value = true
    } catch (error) {
      settings.value = previous
      throw error
    } finally {
      saving.value = false
    }
  }

  function applyRemoteSettings(next: AppSettings): void {
    settings.value = next
    loaded.value = true
  }

  async function toggleTheme(): Promise<void> {
    await update({ theme: settings.value.theme === 'dark' ? 'light' : 'dark' })
  }

  return {
    settings,
    loaded,
    saving,
    isDark,
    load,
    update,
    applyRemoteSettings,
    toggleTheme
  }
})
