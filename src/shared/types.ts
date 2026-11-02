/** 计划类型：固定时段任务 / 计数目标任务 */
export type PlanType = 'time' | 'count'

/** 重复规则 */
export type RepeatMode = 'once' | 'day' | 'week' | 'month'

export interface RepeatRule {
  mode: RepeatMode
  /** 0 = 周日，1 = 周一 …… 6 = 周六 */
  weekDays?: number[]
  /** 每月日期，1 - 31 */
  monthDays?: number[]
}

/** 计划表（严格遵循 V0.1 数据结构） */
export interface Plan {
  id: string
  name: string
  type: PlanType
  startTime: string
  endTime: string
  repeatRule: RepeatRule
  startDate?: string
  endDate?: string
  contractText: string
  enableRemind: boolean
  showFloat: boolean
  createAt: number
}

/** 执行记录状态 */
export type RecordStatus = 'finish' | 'skip' | 'delay'

/** 执行记录表（严格遵循 V0.1 数据结构） */
export interface ExecutionRecord {
  id: string
  planId: string
  execDate: string
  originTime: string
  status: RecordStatus
  remark: string
  finishAt: number
}

/** 新建 / 编辑计划时提交的数据 */
export type PlanInput = Pick<
  Plan,
  | 'name'
  | 'type'
  | 'startTime'
  | 'endTime'
  | 'repeatRule'
  | 'startDate'
  | 'endDate'
  | 'contractText'
  | 'enableRemind'
  | 'showFloat'
>

/** 展示层任务状态（部分重叠：paused 归属“进行中”） */
export type TaskStatus = 'pending' | 'running' | 'finished' | 'skipped' | 'delayed'

/** 任务可执行操作 */
export interface TaskCapabilities {
  edit: boolean
  remove: boolean
  start: boolean
  pause: boolean
  resume: boolean
  finish: boolean
  delay: boolean
  skip: boolean
}

/** 今日看板 / 周视图展示的单次任务 */
export interface TaskItem {
  plan: Plan
  execDate: string
  /** 生效后的开始 / 结束时间（毫秒时间戳），延期中会变化 */
  startAt: number
  endAt: number
  startText: string
  endText: string
  status: TaskStatus
  paused: boolean
  /** 超过结束时间且没有终态记录 */
  overdue: boolean
  delayMinutes: number
  remainingMs: number
  /** 最近一次延期 / 跳过备注，便于卡片复盘 */
  remark: string
  capabilities: TaskCapabilities
}

export interface TodayStats {
  total: number
  finished: number
  inProgress: number
  skipped: number
  completionRate: number
}

export interface TodaySnapshot {
  date: string
  tasks: TaskItem[]
  stats: TodayStats
}

export interface WeekDay {
  date: string
  weekday: number
  /** 周一、周二…… */
  label: string
  isToday: boolean
  tasks: TaskItem[]
}

export interface WeekSnapshot {
  startDate: string
  endDate: string
  days: WeekDay[]
}

export type RecordFilterStatus = RecordStatus | 'all'

export interface RecordFilters {
  status?: RecordFilterStatus
  startDate?: string
  endDate?: string
}

export interface RecordRow extends ExecutionRecord {
  planName: string
}

export interface RecordQueryResult {
  rows: RecordRow[]
  total: number
}

export type StatsPeriod = 'week' | 'month' | 'all'

export interface ChartBar {
  label: string
  value: number
  hint: string
}

export interface StatsSnapshot {
  period: StatsPeriod
  totalOccurrences: number
  finishedOccurrences: number
  completionRate: number
  currentStreak: number
  longestStreak: number
  bars: ChartBar[]
  barUnit: string
}

export interface CurrentTaskSnapshot {
  task: TaskItem | null
  /** 同一时刻存在的其它进行中任务数量 */
  otherCount: number
}

export interface ReminderInfo {
  task: TaskItem
  secondReminder: boolean
}

export interface AppInfo {
  version: string
  dataPath: string
  packaged: boolean
}

/** 应用设置（持久化于同一个低代码 JSON 数据库） */
export type ThemeMode = 'light' | 'dark'
export type SoundType = 'chime' | 'soft' | 'none'
export type FloatDoubleClickAction = 'openMain' | 'hideFloat'

export interface AppSettings {
  theme: ThemeMode
  autoLaunch: boolean
  minimizeToTray: boolean
  sound: SoundType
  timeoutRemind: boolean
  reminderAlwaysOnTop: boolean
  floatOpacity: number
  floatAlwaysOnTop: boolean
  floatDoubleClickAction: FloatDoubleClickAction
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  autoLaunch: false,
  minimizeToTray: true,
  sound: 'chime',
  timeoutRemind: true,
  reminderAlwaysOnTop: true,
  floatOpacity: 0.94,
  floatAlwaysOnTop: true,
  floatDoubleClickAction: 'openMain'
}

/**
 * 运行时任务状态，用于保存“提前开始、暂停、延期”造成的实际执行窗口。
 * 不属于 V0.1 约定中的 plans / records 表，但为了让状态跨重启可靠而持久化。
 */
export interface TaskRuntime {
  planId: string
  execDate: string
  startAt: number
  endAt: number
  startedAt?: number
  pausedAt?: number
  delayMinutes: number
  updatedAt: number
}

export interface DatabaseSchema {
  plans: Plan[]
  records: ExecutionRecord[]
  settings: AppSettings
  runtime: Record<string, TaskRuntime>
  meta: {
    schemaVersion: number
    createdAt: number
  }
}

export function createDefaultDatabase(): DatabaseSchema {
  return {
    plans: [],
    records: [],
    settings: { ...DEFAULT_SETTINGS },
    runtime: {},
    meta: {
      schemaVersion: 1,
      createdAt: Date.now()
    }
  }
}

export interface DataTransferResult {
  canceled: boolean
  filePath?: string
}
