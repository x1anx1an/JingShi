import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CurrentTaskSnapshot, TaskItem } from '@shared/types'

export const useCurrentTaskStore = defineStore('current-task', () => {
  const task = ref<TaskItem | null>(null)
  const otherCount = ref(0)
  const loading = ref(false)
  const loaded = ref(false)

  const hasTask = computed(() => !!task.value)
  const paused = computed(() => !!task.value?.paused)

  async function load(withLoading = true): Promise<void> {
    if (withLoading) {
      loading.value = true
    }
    try {
      const snapshot: CurrentTaskSnapshot = await window.api.current.get()
      task.value = snapshot.task
      otherCount.value = snapshot.otherCount
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function finish(): Promise<void> {
    if (!task.value) {
      return
    }
    await window.api.plans.finish(task.value.plan.id, task.value.execDate)
    await load(false)
  }

  async function togglePause(): Promise<void> {
    if (!task.value) {
      return
    }
    if (task.value.paused) {
      await window.api.plans.resume(task.value.plan.id, task.value.execDate)
    } else {
      await window.api.plans.pause(task.value.plan.id, task.value.execDate)
    }
    await load(false)
  }

  function handleExternalChange(): void {
    if (!loaded.value) {
      return
    }
    void load(false).catch((error) => {
      console.error('刷新当前任务失败', error)
    })
  }

  return {
    task,
    otherCount,
    loading,
    loaded,
    hasTask,
    paused,
    load,
    finish,
    togglePause,
    handleExternalChange
  }
})
