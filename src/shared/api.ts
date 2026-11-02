import type {
  AppInfo,
  AppSettings,
  CurrentTaskSnapshot,
  DataTransferResult,
  Plan,
  PlanInput,
  RecordFilters,
  RecordQueryResult,
  ReminderInfo,
  StatsPeriod,
  StatsSnapshot,
  TodaySnapshot,
  WeekSnapshot
} from './types'

export type Unsubscribe = () => void

/**
 * preload 通过 contextBridge 暴露给渲染进程的最小安全接口。
 * 渲染进程不能直接访问 ipcRenderer / Node.js。
 */
export interface WindowApi {
  app: {
    getInfo: () => Promise<AppInfo>
  }
  plans: {
    today: () => Promise<TodaySnapshot>
    week: () => Promise<WeekSnapshot>
    create: (input: PlanInput) => Promise<Plan>
    update: (id: string, input: PlanInput) => Promise<Plan>
    remove: (id: string) => Promise<void>
    start: (planId: string, execDate: string) => Promise<void>
    pause: (planId: string, execDate: string) => Promise<void>
    resume: (planId: string, execDate: string) => Promise<void>
    finish: (planId: string, execDate: string) => Promise<void>
    skip: (planId: string, execDate: string, reason: string) => Promise<void>
    delay: (planId: string, execDate: string, minutes: number) => Promise<void>
  }
  current: {
    get: () => Promise<CurrentTaskSnapshot>
  }
  records: {
    query: (filters: RecordFilters) => Promise<RecordQueryResult>
    exportCsv: (filters: RecordFilters) => Promise<DataTransferResult>
  }
  stats: {
    get: (period: StatsPeriod) => Promise<StatsSnapshot>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (patch: Partial<AppSettings>) => Promise<AppSettings>
  }
  data: {
    exportJson: () => Promise<DataTransferResult>
    importJson: () => Promise<DataTransferResult>
    clearAll: () => Promise<void>
  }
  reminder: {
    get: (planId: string, execDate: string) => Promise<ReminderInfo | null>
    close: () => Promise<void>
  }
  float: {
    doubleClick: () => Promise<void>
  }
  windows: {
    showMain: (route?: string) => Promise<void>
  }
  events: {
    onDataChanged: (callback: () => void) => Unsubscribe
    onSettingsChanged: (callback: (settings: AppSettings) => void) => Unsubscribe
    onNavigate: (callback: (route: string) => void) => Unsubscribe
  }
}
