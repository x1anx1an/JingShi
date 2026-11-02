import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import type { AppDatabase } from './db/database'
import type { PlanService } from './services/plan-service'
import type { ReminderScheduler } from './services/scheduler'
import type { WindowManager } from './windows/window-manager'
import { IPC } from '@shared/ipc'
import { isDateString, todayDate } from '@shared/date'
import {
  createDefaultDatabase,
  DEFAULT_SETTINGS,
  type AppSettings,
  type DatabaseSchema,
  type ExecutionRecord,
  type Plan,
  type PlanInput,
  type RecordFilters,
  type RecordStatus,
  type StatsPeriod,
  type TaskRuntime
} from '@shared/types'

interface IpcContext {
  db: AppDatabase
  planService: PlanService
  scheduler: ReminderScheduler
  windows: WindowManager
}

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]

function isRecordStatus(value: unknown): value is RecordStatus {
  return value === 'finish' || value === 'skip' || value === 'delay'
}

function isStatsPeriod(value: unknown): value is StatsPeriod {
  return value === 'week' || value === 'month' || value === 'all'
}

function sanitizeFilters(filters: unknown): RecordFilters {
  const raw = (filters ?? {}) as RecordFilters
  const result: RecordFilters = {}
  if (raw.status === 'all' || isRecordStatus(raw.status)) {
    result.status = raw.status
  }
  if (typeof raw.startDate === 'string' && isDateString(raw.startDate)) {
    result.startDate = raw.startDate
  }
  if (typeof raw.endDate === 'string' && isDateString(raw.endDate)) {
    result.endDate = raw.endDate
  }
  return result
}

function escapeCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  // 防止 Excel 公式注入。
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`
  }
  return `"${text.replace(/"/g, '""')}"`
}

function exportRecordsToCsv(rows: ReturnType<PlanService['queryRecords']>): string {
  const statusLabels: Record<RecordStatus, string> = {
    finish: '已完成',
    skip: '已跳过',
    delay: '已延期'
  }
  const header = ['记录ID', '计划名称', '计划ID', '执行日期', '原计划时间', '状态', '备注', '操作时间']
  const lines = rows.map((row) =>
    [
      row.id,
      row.planName,
      row.planId,
      row.execDate,
      row.originTime,
      statusLabels[row.status],
      row.remark,
      new Date(row.finishAt).toLocaleString('zh-CN')
    ]
      .map(escapeCsvCell)
      .join(',')
  )
  return `\uFEFF${[header.map(escapeCsvCell).join(','), ...lines].join('\r\n')}`
}

function sanitizeSettings(input: unknown): AppSettings {
  const raw = (input ?? {}) as Partial<AppSettings>
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...raw
  }
  settings.theme = settings.theme === 'dark' ? 'dark' : 'light'
  settings.autoLaunch = !!settings.autoLaunch
  settings.minimizeToTray = !!settings.minimizeToTray
  settings.sound = ['chime', 'soft', 'none'].includes(settings.sound) ? settings.sound : 'chime'
  settings.timeoutRemind = !!settings.timeoutRemind
  settings.reminderAlwaysOnTop = !!settings.reminderAlwaysOnTop
  settings.floatOpacity = Math.min(
    1,
    Math.max(0.3, Number.isFinite(Number(settings.floatOpacity)) ? Number(settings.floatOpacity) : 0.94)
  )
  settings.floatAlwaysOnTop = !!settings.floatAlwaysOnTop
  settings.floatDoubleClickAction =
    settings.floatDoubleClickAction === 'hideFloat' ? 'hideFloat' : 'openMain'
  return settings
}

function validatePlan(raw: unknown): Plan {
  if (!raw || typeof raw !== 'object') {
    throw new Error('备份中包含无效计划')
  }
  const plan = raw as Plan
  if (
    typeof plan.id !== 'string' ||
    typeof plan.name !== 'string' ||
    (plan.type !== 'time' && plan.type !== 'count') ||
    typeof plan.startTime !== 'string' ||
    typeof plan.endTime !== 'string' ||
    !plan.repeatRule ||
    typeof plan.createAt !== 'number'
  ) {
    throw new Error('备份中的计划结构不正确')
  }
  return {
    ...plan,
    contractText: typeof plan.contractText === 'string' ? plan.contractText : '',
    enableRemind: !!plan.enableRemind,
    showFloat: !!plan.showFloat,
    repeatRule: {
      mode: plan.repeatRule.mode,
      weekDays: plan.repeatRule.weekDays,
      monthDays: plan.repeatRule.monthDays
    }
  }
}

function validateRecord(raw: unknown): ExecutionRecord {
  if (!raw || typeof raw !== 'object') {
    throw new Error('备份中包含无效记录')
  }
  const record = raw as ExecutionRecord
  if (
    typeof record.id !== 'string' ||
    typeof record.planId !== 'string' ||
    typeof record.execDate !== 'string' ||
    typeof record.originTime !== 'string' ||
    !isRecordStatus(record.status) ||
    typeof record.finishAt !== 'number'
  ) {
    throw new Error('备份中的记录结构不正确')
  }
  return {
    ...record,
    remark: typeof record.remark === 'string' ? record.remark : ''
  }
}

function validateBackup(payload: unknown): DatabaseSchema {
  const wrapper = payload as { data?: unknown }
  const data = (wrapper?.data ?? payload) as Partial<DatabaseSchema>
  if (!Array.isArray(data.plans) || !Array.isArray(data.records)) {
    throw new Error('不是有效的静时备份文件')
  }
  const runtime: Record<string, TaskRuntime> = {}
  if (data.runtime && typeof data.runtime === 'object') {
    for (const [key, item] of Object.entries(data.runtime as Record<string, TaskRuntime>)) {
      if (
        item &&
        typeof item.planId === 'string' &&
        typeof item.execDate === 'string' &&
        typeof item.startAt === 'number' &&
        typeof item.endAt === 'number'
      ) {
        runtime[key] = item
      }
    }
  }
  return {
    plans: data.plans.map(validatePlan),
    records: data.records.map(validateRecord),
    settings: sanitizeSettings(data.settings),
    runtime,
    meta: {
      schemaVersion: 1,
      createdAt:
        data.meta && typeof data.meta.createdAt === 'number'
          ? data.meta.createdAt
          : createDefaultDatabase().meta.createdAt
    }
  }
}

function applyAutoLaunch(enabled: boolean): void {
  if (!app.isPackaged) {
    return
  }
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  })
}

export function registerIpcHandlers(context: IpcContext): void {
  const { db, planService, scheduler, windows } = context

  const refresh = (): void => {
    scheduler.refresh()
  }

  ipcMain.handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    dataPath: db.dataPath,
    packaged: app.isPackaged
  }))

  ipcMain.handle(IPC.plansToday, () => planService.getToday())
  ipcMain.handle(IPC.plansWeek, () => planService.getWeek())
  ipcMain.handle(IPC.planCreate, async (_event, input: PlanInput) => {
    const plan = await planService.create(input)
    refresh()
    return plan
  })
  ipcMain.handle(IPC.planUpdate, async (_event, id: string, input: PlanInput) => {
    const plan = await planService.update(id, input)
    refresh()
    return plan
  })
  ipcMain.handle(IPC.planRemove, async (_event, id: string) => {
    await planService.remove(id)
    refresh()
  })

  ipcMain.handle(IPC.taskStart, async (_event, planId: string, execDate: string) => {
    await planService.start(planId, execDate)
    refresh()
  })
  ipcMain.handle(IPC.taskPause, async (_event, planId: string, execDate: string) => {
    await planService.pause(planId, execDate)
    refresh()
  })
  ipcMain.handle(IPC.taskResume, async (_event, planId: string, execDate: string) => {
    await planService.resume(planId, execDate)
    refresh()
  })
  ipcMain.handle(IPC.taskFinish, async (_event, planId: string, execDate: string) => {
    await planService.finish(planId, execDate)
    refresh()
  })
  ipcMain.handle(IPC.taskSkip, async (_event, planId: string, execDate: string, reason: string) => {
    await planService.skip(planId, execDate, reason)
    refresh()
  })
  ipcMain.handle(IPC.taskDelay, async (_event, planId: string, execDate: string, minutes: number) => {
    await planService.delay(planId, execDate, minutes)
    refresh()
  })

  ipcMain.handle(IPC.currentGet, () => planService.getCurrentTask())

  ipcMain.handle(IPC.recordsQuery, (_event, filters: unknown) => {
    const rows = planService.queryRecords(sanitizeFilters(filters))
    return { rows, total: rows.length }
  })

  ipcMain.handle(IPC.recordsExportCsv, async (_event, filters: unknown) => {
    const rows = planService.queryRecords(sanitizeFilters(filters))
    const result = await dialog.showSaveDialog({
      title: '导出执行记录',
      defaultPath: `jingshi-records-${todayDate()}.csv`,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    await writeFile(result.filePath, exportRecordsToCsv(rows), 'utf8')
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle(IPC.statsGet, (_event, period: unknown) => {
    if (!isStatsPeriod(period)) {
      throw new Error('统计周期不合法')
    }
    return planService.getStats(period)
  })

  ipcMain.handle(IPC.settingsGet, () => db.settings)
  ipcMain.handle(IPC.settingsUpdate, async (_event, patch: Partial<AppSettings>) => {
    const safePatch: Partial<AppSettings> = {}
    for (const key of SETTING_KEYS) {
      if (patch && Object.prototype.hasOwnProperty.call(patch, key)) {
        ;(safePatch as Record<string, unknown>)[key] = patch[key]
      }
    }
    if (safePatch.autoLaunch !== undefined) {
      applyAutoLaunch(!!safePatch.autoLaunch)
    }
    const merged = sanitizeSettings({ ...db.settings, ...safePatch })
    const settings = await db.updateSettings(merged)
    windows.applySettings(settings)
    windows.broadcastSettings(settings)
    return settings
  })

  ipcMain.handle(IPC.dataExportJson, async () => {
    const result = await dialog.showSaveDialog({
      title: '导出静时数据备份',
      defaultPath: `jingshi-backup-${todayDate()}.json`,
      filters: [{ name: 'JSON 备份', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    const backup = {
      app: '静时',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: db.data
    }
    await writeFile(result.filePath, JSON.stringify(backup, null, 2), 'utf8')
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle(IPC.dataImportJson, async () => {
    const result = await dialog.showOpenDialog({
      title: '导入静时数据备份',
      properties: ['openFile'],
      filters: [{ name: 'JSON 备份', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }
    const raw = await readFile(result.filePaths[0], 'utf8')
    const payload = JSON.parse(raw) as unknown
    const schema = validateBackup(payload)
    await db.replaceData(schema)
    windows.closeReminders()
    windows.applySettings(db.settings)
    applyAutoLaunch(db.settings.autoLaunch)
    windows.broadcastSettings(db.settings)
    scheduler.reload()
    return { canceled: false, filePath: result.filePaths[0] }
  })

  ipcMain.handle(IPC.dataClearAll, async () => {
    await db.clearAll()
    windows.closeReminders()
    windows.applySettings(db.settings)
    applyAutoLaunch(false)
    windows.broadcastSettings(db.settings)
    scheduler.reload()
  })

  ipcMain.handle(IPC.reminderGet, (_event, planId: string, execDate: string) => {
    return planService.getReminder(planId, execDate)
  })

  ipcMain.handle(IPC.reminderClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle(IPC.floatDoubleClick, () => {
    windows.handleFloatDoubleClick()
  })

  ipcMain.handle(IPC.windowShowMain, (_event, route?: string) => {
    windows.showMain(typeof route === 'string' ? route : undefined)
  })

  // 开机自启在应用启动时按已保存设置同步一次（仅打包环境）。
  applyAutoLaunch(db.settings.autoLaunch)
}
