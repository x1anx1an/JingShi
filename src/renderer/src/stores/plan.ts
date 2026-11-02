import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  Plan,
  PlanInput,
  TaskItem,
  TodaySnapshot,
  TodayStats
} from '@shared/types'

const EMPTY_STATS: TodayStats = {
  total: 0,
  finished: 0,
  inProgress: 0,
  skipped: 0,
  completionRate: 0
}

export const usePlanStore = defineStore('plan', () => {
  const snapshot = ref<TodaySnapshot | null>(null)
  const loading = ref(false)
  const loaded = ref(false)

  const tasks = computed<TaskItem[]>(() => snapshot.value?.tasks ?? [])
  const stats = computed<TodayStats>(() => snapshot.value?.stats ?? EMPTY_STATS)
  const date = computed(() => snapshot.value?.date ?? '')

  async function loadToday(withLoading = true): Promise<void> {
    if (withLoading) {
      loading.value = true
    }
    try {
      snapshot.value = await window.api.plans.today()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function create(input: PlanInput): Promise<Plan> {
    const plan = await window.api.plans.create(input)
    await loadToday(false)
    return plan
  }

  async function update(id: string, input: PlanInput): Promise<Plan> {
    const plan = await window.api.plans.update(id, input)
    await loadToday(false)
    return plan
  }

  async function remove(id: string): Promise<void> {
    await window.api.plans.remove(id)
    await loadToday(false)
  }

  async function start(planId: string, execDate: string): Promise<void> {
    await window.api.plans.start(planId, execDate)
    await loadToday(false)
  }

  async function pause(planId: string, execDate: string): Promise<void> {
    await window.api.plans.pause(planId, execDate)
    await loadToday(false)
  }

  async function resume(planId: string, execDate: string): Promise<void> {
    await window.api.plans.resume(planId, execDate)
    await loadToday(false)
  }

  async function finish(planId: string, execDate: string): Promise<void> {
    await window.api.plans.finish(planId, execDate)
    await loadToday(false)
  }

  async function skip(planId: string, execDate: string, reason: string): Promise<void> {
    await window.api.plans.skip(planId, execDate, reason)
    await loadToday(false)
  }

  async function delay(planId: string, execDate: string, minutes: number): Promise<void> {
    await window.api.plans.delay(planId, execDate, minutes)
    await loadToday(false)
  }

  function handleExternalChange(): void {
    if (!loaded.value) {
      return
    }
    void loadToday(false).catch((error) => {
      console.error('刷新今日任务失败', error)
    })
  }

  return {
    snapshot,
    loading,
    loaded,
    tasks,
    stats,
    date,
    loadToday,
    create,
    update,
    remove,
    start,
    pause,
    resume,
    finish,
    skip,
    delay,
    handleExternalChange
  }
})
