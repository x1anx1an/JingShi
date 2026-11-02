import { Notification } from 'electron'
import type { AppDatabase } from '../db/database'
import type { WindowManager } from '../windows/window-manager'
import type { PlanService } from './plan-service'
import type { TaskItem } from '@shared/types'

const SCAN_INTERVAL_MS = 30_000
const SECOND_REMIND_DELAY_MS = 5 * 60_000

/**
 * 任务时间调度器，运行在主进程。
 * 使用 30 秒低频轮询 + 日期时间比较，不依赖不稳定的高精度 setInterval。
 */
export class ReminderScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private scanning = false
  private remindersPaused = false
  private readonly firedKeys = new Set<string>()

  constructor(
    private readonly db: AppDatabase,
    private readonly planService: PlanService,
    private readonly windows: WindowManager
  ) {}

  start(): void {
    if (this.timer) {
      return
    }
    this.stopped = false
    this.scan()
    this.scheduleNext()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  get isPaused(): boolean {
    return this.remindersPaused
  }

  setPaused(paused: boolean): void {
    this.remindersPaused = paused
    if (paused) {
      this.windows.closeReminders()
    }
  }

  /** 数据变更后立即重新比对一次，同时刷新所有窗口。 */
  refresh(): void {
    this.scan()
  }

  /** 导入 / 清空数据后重置提醒去重状态，并立即重新扫描。 */
  reload(): void {
    this.firedKeys.clear()
    this.scan()
  }

  private scheduleNext(): void {
    if (this.stopped) {
      return
    }
    this.timer = setTimeout(() => {
      this.timer = null
      this.scan()
      this.scheduleNext()
    }, SCAN_INTERVAL_MS)
  }

  private scan(): void {
    if (this.scanning) {
      return
    }
    this.scanning = true
    try {
      const now = Date.now()
      const snapshot = this.planService.getToday(now)
      if (!this.remindersPaused) {
        for (const task of snapshot.tasks) {
          this.checkTask(task, now)
        }
      }
      this.windows.broadcastDataChanged()
    } finally {
      this.scanning = false
    }
  }

  private checkTask(task: TaskItem, now: number): void {
    if (!task.plan.enableRemind) {
      return
    }
    if (
      task.status === 'finished' ||
      task.status === 'skipped' ||
      task.overdue ||
      task.paused
    ) {
      return
    }
    // 用户已主动“开始专注”或暂停时不重复提醒。
    if (this.planService.hasStarted(task.plan.id, task.execDate)) {
      return
    }
    if (now < task.startAt || now > task.endAt) {
      return
    }

    const key = `${task.plan.id}|${task.execDate}|${task.startAt}`
    if (!this.firedKeys.has(key)) {
      this.firedKeys.add(key)
      this.triggerReminder(task, false)
      return
    }

    if (!this.db.settings.timeoutRemind) {
      return
    }
    const secondKey = `${key}|second`
    if (
      !this.firedKeys.has(secondKey) &&
      now >= task.startAt + SECOND_REMIND_DELAY_MS &&
      now <= task.endAt
    ) {
      this.firedKeys.add(secondKey)
      this.triggerReminder(task, true)
    }
  }

  private triggerReminder(task: TaskItem, second: boolean): void {
    const title = `现在是「${task.plan.name}」的自律时间`
    const contract = task.plan.contractText.trim()
    const body = second
      ? `已经过去 5 分钟，${contract ? `记得你的契约：${contract}` : '现在开始，仍然来得及。'}`
      : contract || '专注当下，完成这一段属于你的时间。'

    if (Notification.isSupported()) {
      const notification = new Notification({ title, body })
      notification.on('click', () => {
        this.windows.showReminder(task.plan.id, task.execDate)
      })
      notification.show()
    }

    // 独立提醒窗口作为系统通知被 Windows 拦截时的兜底。
    this.windows.showReminder(task.plan.id, task.execDate, second)
  }
}
