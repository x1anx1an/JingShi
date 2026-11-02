import { randomUUID } from 'node:crypto'
import type { AppDatabase } from '../db/database'
import {
  addDaysToDateString,
  combineDateTime,
  diffDays,
  formatClock,
  formatDate,
  getWeekDates,
  getWeekday,
  isDateString,
  isTimeString,
  parseDate,
  timeToMinutes,
  todayDate,
  WEEKDAY_LABELS
} from '@shared/date'
import type {
  ChartBar,
  CurrentTaskSnapshot,
  ExecutionRecord,
  Plan,
  PlanInput,
  RecordFilters,
  RecordRow,
  ReminderInfo,
  StatsPeriod,
  StatsSnapshot,
  TaskCapabilities,
  TaskItem,
  TaskRuntime,
  TaskStatus,
  TodaySnapshot,
  TodayStats,
  WeekSnapshot
} from '@shared/types'

const MIN_SKIP_REASON_LENGTH = 2
const MAX_DELAY_MINUTES = 1440

interface EffectiveTiming {
  startAt: number
  endAt: number
  runtime?: TaskRuntime
}

function runtimeKey(planId: string, execDate: string): string {
  return `${planId}|${execDate}`
}

function clampPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10
}

const EMPTY_CAPABILITIES: TaskCapabilities = {
  edit: false,
  remove: false,
  start: false,
  pause: false,
  resume: false,
  finish: false,
  delay: false,
  skip: false
}

/**
 * 计划与任务的领域服务：负责重复规则展开、状态推导、记录写入及统计。
 * 渲染进程只拿到展示数据，不直接操作 lowdb。
 */
export class PlanService {
  constructor(private readonly db: AppDatabase) {}

  create(input: PlanInput): Promise<Plan> {
    const normalized = this.normalizeInput(input)
    const plan: Plan = {
      id: randomUUID(),
      ...normalized,
      createAt: Date.now()
    }
    return this.db.addPlan(plan).then(() => plan)
  }

  async update(id: string, input: PlanInput): Promise<Plan> {
    const existing = this.requirePlan(id)
    const today = todayDate()
    const task = this.isPlanActiveOnDate(existing, today)
      ? this.buildTask(existing, today, Date.now())
      : null
    if (task && task.status !== 'pending') {
      throw new Error('只能编辑今日待开始的计划')
    }
    const updated: Plan = {
      ...existing,
      ...this.normalizeInput(input)
    }
    await this.db.updatePlan(updated)
    await this.db.removeRuntime(runtimeKey(id, today))
    return updated
  }

  async remove(id: string): Promise<void> {
    const existing = this.requirePlan(id)
    const today = todayDate()
    if (this.isPlanActiveOnDate(existing, today)) {
      const task = this.buildTask(existing, today, Date.now())
      if (task.status !== 'pending') {
        throw new Error('只能删除今日待开始的计划')
      }
    }
    await this.db.removePlan(id)
  }

  getToday(now = Date.now()): TodaySnapshot {
    const date = formatDate(new Date(now))
    const tasks = this.buildTasksForDate(date, now)

    const stats: TodayStats = {
      total: tasks.length,
      finished: tasks.filter((task) => task.status === 'finished').length,
      inProgress: tasks.filter(
        (task) => task.status === 'running' || (task.status === 'delayed' && !task.overdue)
      ).length,
      skipped: tasks.filter((task) => task.status === 'skipped').length,
      completionRate: tasks.length === 0 ? 0 : clampPercent((tasks.filter((task) => task.status === 'finished').length / tasks.length) * 100)
    }
    return { date, tasks, stats }
  }

  getWeek(now = Date.now()): WeekSnapshot {
    const dates = getWeekDates(new Date(now))
    const days = dates.map((date) => {
      const parsed = parseDate(date)
      return {
        date,
        weekday: parsed.getDay(),
        label: WEEKDAY_LABELS[parsed.getDay()],
        isToday: date === formatDate(new Date(now)),
        tasks: this.buildTasksForDate(date, now)
      }
    })
    return {
      startDate: dates[0],
      endDate: dates[6],
      days
    }
  }

  getCurrentTask(now = Date.now()): CurrentTaskSnapshot {
    const date = formatDate(new Date(now))
    const visibleCurrent = this.buildTasksForDate(date, now)
      .filter((task) => task.plan.showFloat && task.status === 'running')
      .sort((a, b) => a.startAt - b.startAt)

    return {
      task: visibleCurrent[0] ?? null,
      otherCount: Math.max(0, visibleCurrent.length - 1)
    }
  }

  getReminder(planId: string, execDate: string, now = Date.now()): ReminderInfo | null {
    const plan = this.db.getPlan(planId)
    if (!plan || !plan.enableRemind || !this.isPlanActiveOnDate(plan, execDate)) {
      return null
    }
    const task = this.buildTask(plan, execDate, now)
    if (task.status === 'finished' || task.status === 'skipped' || task.overdue) {
      return null
    }
    return { task, secondReminder: false }
  }

  async start(planId: string, execDate: string, now = Date.now()): Promise<void> {
    const plan = this.requirePlanForDate(planId, execDate)
    const task = this.buildTask(plan, execDate, now)
    if (task.status === 'finished' || task.status === 'skipped' || task.overdue) {
      throw new Error('该任务已经结束')
    }
    const timing = this.resolveTiming(plan, execDate)
    const runtime = timing.runtime
    if (!runtime) {
      const startsEarly = now < timing.startAt
      const duration = Math.max(60_000, timing.endAt - timing.startAt)
      await this.db.saveRuntime({
        planId,
        execDate,
        startAt: startsEarly ? now : timing.startAt,
        endAt: startsEarly ? now + duration : timing.endAt,
        startedAt: now,
        delayMinutes: 0,
        updatedAt: now
      })
      return
    }

    if (now < runtime.startAt) {
      const duration = Math.max(60_000, runtime.endAt - runtime.startAt)
      runtime.startAt = now
      runtime.endAt = now + duration
    }
    runtime.startedAt = now
    runtime.pausedAt = undefined
    runtime.updatedAt = now
    await this.db.saveRuntime(runtime)
  }

  async pause(planId: string, execDate: string, now = Date.now()): Promise<void> {
    const plan = this.requirePlanForDate(planId, execDate)
    const task = this.buildTask(plan, execDate, now)
    if (task.overdue) {
      throw new Error('该任务已经结束')
    }
    if (task.status !== 'running' || task.paused) {
      throw new Error('当前任务不在进行中')
    }
    const timing = this.resolveTiming(plan, execDate)
    const runtime: TaskRuntime = timing.runtime ?? {
      planId,
      execDate,
      startAt: timing.startAt,
      endAt: timing.endAt,
      delayMinutes: 0,
      updatedAt: now
    }
    runtime.pausedAt = now
    runtime.startedAt ??= now
    runtime.updatedAt = now
    await this.db.saveRuntime(runtime)
  }

  async resume(planId: string, execDate: string, now = Date.now()): Promise<void> {
    const runtime = this.db.getRuntime(runtimeKey(planId, execDate))
    if (!runtime || !runtime.pausedAt) {
      throw new Error('当前任务未处于暂停状态')
    }
    const pausedDuration = Math.max(0, now - runtime.pausedAt)
    runtime.endAt += pausedDuration
    runtime.pausedAt = undefined
    runtime.startedAt ??= now
    runtime.updatedAt = now
    await this.db.saveRuntime(runtime)
  }

  async finish(planId: string, execDate: string, now = Date.now()): Promise<void> {
    const plan = this.requirePlanForDate(planId, execDate)
    const task = this.buildTask(plan, execDate, now)
    if (task.status === 'finished' || task.status === 'skipped') {
      throw new Error('该任务已有结束记录')
    }
    if (task.status === 'pending') {
      throw new Error('任务尚未开始')
    }
    if (task.overdue) {
      throw new Error('该任务已经结束')
    }
    await this.db.addRecord(this.makeRecord(plan, execDate, 'finish', '', now))
    await this.db.removeRuntime(runtimeKey(planId, execDate))
  }

  async skip(planId: string, execDate: string, reason: string, now = Date.now()): Promise<void> {
    const plan = this.requirePlanForDate(planId, execDate)
    const trimmed = reason.trim()
    if (Array.from(trimmed).length < MIN_SKIP_REASON_LENGTH) {
      throw new Error('跳过理由至少需要 2 个字')
    }
    const task = this.buildTask(plan, execDate, now)
    if (task.status === 'finished' || task.status === 'skipped') {
      throw new Error('该任务已有结束记录')
    }
    await this.db.addRecord(this.makeRecord(plan, execDate, 'skip', trimmed, now))
    await this.db.removeRuntime(runtimeKey(planId, execDate))
  }

  async delay(planId: string, execDate: string, minutes: number, now = Date.now()): Promise<void> {
    const plan = this.requirePlanForDate(planId, execDate)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_DELAY_MINUTES) {
      throw new Error('延期时长需为 1 - 1440 分钟的整数')
    }
    const task = this.buildTask(plan, execDate, now)
    if (task.status === 'finished' || task.status === 'skipped') {
      throw new Error('该任务已有结束记录')
    }
    if (task.overdue) {
      throw new Error('该任务已经结束')
    }
    const timing = this.resolveTiming(plan, execDate)
    const runtime: TaskRuntime = timing.runtime ?? {
      planId,
      execDate,
      startAt: timing.startAt,
      endAt: timing.endAt,
      startedAt: undefined,
      delayMinutes: 0,
      updatedAt: now
    }
    const delta = minutes * 60_000
    runtime.startAt += delta
    runtime.endAt += delta
    runtime.delayMinutes += minutes
    // 延期即进入新的等待窗口：清除开始 / 暂停状态，让调度器在新时间点再次提醒。
    runtime.startedAt = undefined
    runtime.pausedAt = undefined
    runtime.updatedAt = now
    await this.db.saveRuntime(runtime)
    await this.db.addRecord(
      this.makeRecord(plan, execDate, 'delay', `延期 ${minutes} 分钟，执行时间顺延`, now)
    )
  }

  queryRecords(filters: RecordFilters = {}): RecordRow[] {
    const plans = new Map(this.db.listPlans().map((plan) => [plan.id, plan.name]))
    const rows = this.db
      .listRecords()
      .filter((record) => {
        if (filters.status && filters.status !== 'all' && record.status !== filters.status) {
          return false
        }
        if (filters.startDate && record.execDate < filters.startDate) {
          return false
        }
        if (filters.endDate && record.execDate > filters.endDate) {
          return false
        }
        return true
      })
      .map((record) => ({
        ...record,
        planName: plans.get(record.planId) ?? '已删除计划'
      }))
      .sort((a, b) => b.finishAt - a.finishAt)
    return rows
  }

  getStats(period: StatsPeriod, now = Date.now()): StatsSnapshot {
    const today = formatDate(new Date(now))
    const weekDates = getWeekDates(new Date(now))
    const monthStart = `${today.slice(0, 7)}-01`
    const earliest = this.getEarliestPlanDate()
    const allStart = earliest && earliest < today ? earliest : today
    const statStart = period === 'week' ? weekDates[0] : period === 'month' ? monthStart : allStart
    const statEnd = today

    const plans = this.db.listPlans()
    const totalMap = new Map<string, number>()
    const finishedMap = new Map<string, number>()
    let totalOccurrences = 0
    let finishedOccurrences = 0

    let cursor = statStart
    while (cursor <= statEnd) {
      for (const plan of plans) {
        if (!this.isPlanActiveOnDate(plan, cursor)) {
          continue
        }
        const task = this.buildTask(plan, cursor, now)
        totalMap.set(cursor, (totalMap.get(cursor) ?? 0) + 1)
        totalOccurrences += 1
        if (task.status === 'finished') {
          finishedMap.set(cursor, (finishedMap.get(cursor) ?? 0) + 1)
          finishedOccurrences += 1
        }
      }
      cursor = addDaysToDateString(cursor, 1)
    }

    const finishDates = new Set(
      this.db
        .listRecords()
        .filter((record) => record.status === 'finish')
        .map((record) => record.execDate)
    )
    const currentStreak = this.calcCurrentStreak(finishDates, today)
    const longestStreak = this.calcLongestStreak(finishDates)

    return {
      period,
      totalOccurrences,
      finishedOccurrences,
      completionRate: totalOccurrences === 0 ? 0 : clampPercent((finishedOccurrences / totalOccurrences) * 100),
      currentStreak,
      longestStreak,
      bars: this.buildStatsBars(period, now, finishedMap, totalMap, allStart),
      barUnit: '完成数'
    }
  }

  isPlanActiveOnDate(plan: Plan, date: string): boolean {
    const createdDate = formatDate(new Date(plan.createAt))
    const effectiveStart = plan.startDate || createdDate
    if (date < effectiveStart) {
      return false
    }
    if (plan.endDate && date > plan.endDate) {
      return false
    }
    if (plan.repeatRule.mode === 'once') {
      return date === effectiveStart
    }
    if (plan.repeatRule.mode === 'day') {
      return true
    }
    if (plan.repeatRule.mode === 'week') {
      return (plan.repeatRule.weekDays ?? []).includes(getWeekday(date))
    }
    if (plan.repeatRule.mode === 'month') {
      return (plan.repeatRule.monthDays ?? []).includes(parseDate(date).getDate())
    }
    return false
  }

  /** 调度器使用：是否已主动开始 / 暂停，避免重复弹提醒 */
  hasStarted(planId: string, execDate: string): boolean {
    const runtime = this.db.getRuntime(runtimeKey(planId, execDate))
    return !!runtime?.startedAt
  }

  private buildTasksForDate(date: string, now: number): TaskItem[] {
    return this.db
      .listPlans()
      .filter((plan) => this.isPlanActiveOnDate(plan, date))
      .map((plan) => this.buildTask(plan, date, now))
      .sort((a, b) => a.startAt - b.startAt)
  }

  private buildTask(plan: Plan, date: string, now: number): TaskItem {
    const timing = this.resolveTiming(plan, date)
    const runtime = timing.runtime
    const terminal = this.getLatestTerminal(plan.id, date)
    let status: TaskStatus = 'pending'
    let paused = false
    let overdue = false

    if (terminal?.status === 'finish') {
      status = 'finished'
    } else if (terminal?.status === 'skip') {
      status = 'skipped'
    } else if (runtime?.pausedAt) {
      status = 'running'
      paused = true
    } else if (now < timing.startAt) {
      status = runtime?.delayMinutes && !runtime.startedAt ? 'delayed' : 'pending'
    } else if (now <= timing.endAt) {
      status = 'running'
    } else {
      status = 'delayed'
      overdue = true
    }

    const latest = this.getLatestRecord(plan.id, date)
    const capabilities = this.buildCapabilities(status, overdue, paused)
    const remainingMs = this.calcRemaining(timing.endAt, now, status, runtime?.pausedAt)

    return {
      plan,
      execDate: date,
      startAt: timing.startAt,
      endAt: timing.endAt,
      startText: formatClock(timing.startAt),
      endText: formatClock(timing.endAt),
      status,
      paused,
      overdue,
      delayMinutes: runtime?.delayMinutes ?? 0,
      remainingMs,
      remark: latest?.remark ?? '',
      capabilities
    }
  }

  private buildCapabilities(
    status: TaskStatus,
    overdue: boolean,
    paused: boolean
  ): TaskCapabilities {
    if (overdue || status === 'finished' || status === 'skipped') {
      return { ...EMPTY_CAPABILITIES }
    }
    if (status === 'pending') {
      return {
        ...EMPTY_CAPABILITIES,
        edit: true,
        remove: true,
        start: true
      }
    }
    if (status === 'running') {
      return {
        ...EMPTY_CAPABILITIES,
        pause: !paused,
        resume: paused,
        finish: true,
        delay: true,
        skip: true
      }
    }
    // 延期等待中仍允许直接完成 / 再次延期 / 跳过。
    return {
      ...EMPTY_CAPABILITIES,
      finish: true,
      delay: true,
      skip: true
    }
  }

  private calcRemaining(
    endAt: number,
    now: number,
    status: TaskStatus,
    pausedAt?: number
  ): number {
    if (status === 'finished' || status === 'skipped') {
      return 0
    }
    return Math.max(0, endAt - (pausedAt ?? now))
  }

  private resolveTiming(plan: Plan, date: string): EffectiveTiming {
    const runtime = this.db.getRuntime(runtimeKey(plan.id, date))
    if (runtime) {
      return {
        startAt: runtime.startAt,
        endAt: runtime.endAt,
        runtime
      }
    }
    return {
      startAt: combineDateTime(date, plan.startTime),
      endAt: combineDateTime(date, plan.endTime)
    }
  }

  private getLatestTerminal(planId: string, date: string): ExecutionRecord | undefined {
    return this.db
      .listRecords()
      .filter(
        (record) =>
          record.planId === planId &&
          record.execDate === date &&
          (record.status === 'finish' || record.status === 'skip')
      )
      .sort((a, b) => b.finishAt - a.finishAt)[0]
  }

  private getLatestRecord(planId: string, date: string): ExecutionRecord | undefined {
    return this.db
      .listRecords()
      .filter((record) => record.planId === planId && record.execDate === date)
      .sort((a, b) => b.finishAt - a.finishAt)[0]
  }

  private makeRecord(
    plan: Plan,
    execDate: string,
    status: ExecutionRecord['status'],
    remark: string,
    now: number
  ): ExecutionRecord {
    return {
      id: randomUUID(),
      planId: plan.id,
      execDate,
      originTime: plan.startTime,
      status,
      remark,
      finishAt: now
    }
  }

  private requirePlan(id: string): Plan {
    const plan = this.db.getPlan(id)
    if (!plan) {
      throw new Error('计划不存在')
    }
    return plan
  }

  private requirePlanForDate(planId: string, execDate: string): Plan {
    const plan = this.requirePlan(planId)
    if (!isDateString(execDate) || !this.isPlanActiveOnDate(plan, execDate)) {
      throw new Error('该日期没有对应的计划')
    }
    return plan
  }

  private normalizeInput(input: PlanInput): PlanInput {
    const name = String(input.name ?? '').trim()
    if (!name) {
      throw new Error('计划名称不能为空')
    }
    if (Array.from(name).length > 60) {
      throw new Error('计划名称不能超过 60 字')
    }
    if (input.type !== 'time' && input.type !== 'count') {
      throw new Error('计划类型不合法')
    }
    if (!isTimeString(input.startTime) || !isTimeString(input.endTime)) {
      throw new Error('请填写有效的时间')
    }
    if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
      throw new Error('结束时间必须晚于开始时间（暂不支持跨天计划）')
    }
    if (!['once', 'day', 'week', 'month'].includes(input.repeatRule?.mode)) {
      throw new Error('重复规则不合法')
    }
    if (input.repeatRule.mode === 'week' && !(input.repeatRule.weekDays ?? []).length) {
      throw new Error('请至少选择一个星期')
    }
    if (input.repeatRule.mode === 'month' && !(input.repeatRule.monthDays ?? []).length) {
      throw new Error('请至少选择一个日期')
    }
    if (input.startDate && !isDateString(input.startDate)) {
      throw new Error('生效开始日期不合法')
    }
    if (input.endDate && !isDateString(input.endDate)) {
      throw new Error('生效结束日期不合法')
    }
    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      throw new Error('生效结束日期不能早于开始日期')
    }

    const today = todayDate()
    const startDate =
      input.startDate || (input.repeatRule.mode === 'once' ? today : undefined)

    return {
      name,
      type: input.type,
      startTime: input.startTime,
      endTime: input.endTime,
      repeatRule: {
        mode: input.repeatRule.mode,
        weekDays: input.repeatRule.mode === 'week' ? [...new Set(input.repeatRule.weekDays ?? [])].sort() : undefined,
        monthDays:
          input.repeatRule.mode === 'month'
            ? [...new Set(input.repeatRule.monthDays ?? [])].sort((a, b) => a - b)
            : undefined
      },
      startDate,
      endDate: input.endDate || undefined,
      contractText: String(input.contractText ?? '').trim(),
      enableRemind: !!input.enableRemind,
      showFloat: !!input.showFloat
    }
  }

  private getEarliestPlanDate(): string | null {
    const plans = this.db.listPlans()
    if (!plans.length) {
      return null
    }
    return plans
      .map((plan) => plan.startDate || formatDate(new Date(plan.createAt)))
      .sort()[0]
  }

  private calcCurrentStreak(finishDates: Set<string>, today: string): number {
    let cursor = finishDates.has(today) ? today : addDaysToDateString(today, -1)
    if (!finishDates.has(cursor)) {
      return 0
    }
    let streak = 0
    while (finishDates.has(cursor)) {
      streak += 1
      cursor = addDaysToDateString(cursor, -1)
    }
    return streak
  }

  private calcLongestStreak(finishDates: Set<string>): number {
    const dates = [...finishDates].sort()
    let longest = 0
    let current = 0
    let previous = ''
    for (const date of dates) {
      if (previous && diffDays(previous, date) === 1) {
        current += 1
      } else {
        current = 1
      }
      longest = Math.max(longest, current)
      previous = date
    }
    return longest
  }

  private buildStatsBars(
    period: StatsPeriod,
    now: number,
    finishedMap: Map<string, number>,
    totalMap: Map<string, number>,
    allStart: string
  ): ChartBar[] {
    if (period === 'week') {
      return getWeekDates(new Date(now)).map((date) => ({
        label: WEEKDAY_LABELS[getWeekday(date)].replace('周', ''),
        value: finishedMap.get(date) ?? 0,
        hint: `${date} · ${finishedMap.get(date) ?? 0}/${totalMap.get(date) ?? 0} 完成`
      }))
    }

    if (period === 'month') {
      const today = formatDate(new Date(now))
      const year = Number(today.slice(0, 4))
      const month = Number(today.slice(5, 7))
      const daysInMonth = new Date(year, month, 0).getDate()
      return Array.from({ length: daysInMonth }, (_, index) => {
        const date = `${today.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`
        return {
          label: String(index + 1),
          value: finishedMap.get(date) ?? 0,
          hint: `${date} · ${finishedMap.get(date) ?? 0}/${totalMap.get(date) ?? 0} 完成`
        }
      })
    }

    const months = new Set<string>()
    let cursorYear = Number(allStart.slice(0, 4))
    let cursorMonth = Number(allStart.slice(5, 7))
    const currentMonth = formatDate(new Date(now)).slice(0, 7)
    while (true) {
      const cursor = `${cursorYear}-${String(cursorMonth).padStart(2, '0')}`
      if (cursor > currentMonth) {
        break
      }
      months.add(cursor)
      cursorMonth += 1
      if (cursorMonth > 12) {
        cursorMonth = 1
        cursorYear += 1
      }
    }
    return [...months].map((month) => {
      const value = [...finishedMap.entries()]
        .filter(([date]) => date.slice(0, 7) === month)
        .reduce((sum, [, count]) => sum + count, 0)
      const [, m] = month.split('-')
      return {
        label: `${month.slice(2, 4)}/${m}`,
        value,
        hint: `${month.replace('-', ' 年 ')} 月 · ${value} 完成`
      }
    })
  }
}
