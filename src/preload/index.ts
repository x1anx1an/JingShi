import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { WindowApi } from '@shared/api'
import type { AppSettings, RecordFilters, StatsPeriod } from '@shared/types'

/**
 * 唯一允许暴露给渲染进程的能力面。
 * 不暴露 ipcRenderer、require、process 等原始对象，避免任意 IPC 调用。
 */
const api: WindowApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC.appInfo)
  },
  plans: {
    today: () => ipcRenderer.invoke(IPC.plansToday),
    week: () => ipcRenderer.invoke(IPC.plansWeek),
    create: (input) => ipcRenderer.invoke(IPC.planCreate, input),
    update: (id, input) => ipcRenderer.invoke(IPC.planUpdate, id, input),
    remove: (id) => ipcRenderer.invoke(IPC.planRemove, id),
    start: (planId, execDate) => ipcRenderer.invoke(IPC.taskStart, planId, execDate),
    pause: (planId, execDate) => ipcRenderer.invoke(IPC.taskPause, planId, execDate),
    resume: (planId, execDate) => ipcRenderer.invoke(IPC.taskResume, planId, execDate),
    finish: (planId, execDate) => ipcRenderer.invoke(IPC.taskFinish, planId, execDate),
    skip: (planId, execDate, reason) => ipcRenderer.invoke(IPC.taskSkip, planId, execDate, reason),
    delay: (planId, execDate, minutes) => ipcRenderer.invoke(IPC.taskDelay, planId, execDate, minutes)
  },
  current: {
    get: () => ipcRenderer.invoke(IPC.currentGet)
  },
  records: {
    query: (filters: RecordFilters) => ipcRenderer.invoke(IPC.recordsQuery, filters),
    exportCsv: (filters: RecordFilters) => ipcRenderer.invoke(IPC.recordsExportCsv, filters)
  },
  stats: {
    get: (period: StatsPeriod) => ipcRenderer.invoke(IPC.statsGet, period)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  data: {
    exportJson: () => ipcRenderer.invoke(IPC.dataExportJson),
    importJson: () => ipcRenderer.invoke(IPC.dataImportJson),
    clearAll: () => ipcRenderer.invoke(IPC.dataClearAll)
  },
  reminder: {
    get: (planId, execDate) => ipcRenderer.invoke(IPC.reminderGet, planId, execDate),
    close: () => ipcRenderer.invoke(IPC.reminderClose)
  },
  float: {
    doubleClick: () => ipcRenderer.invoke(IPC.floatDoubleClick)
  },
  windows: {
    showMain: (route) => ipcRenderer.invoke(IPC.windowShowMain, route)
  },
  events: {
    onDataChanged: (callback) => {
      const listener = (): void => callback()
      ipcRenderer.on(IPC.eventDataChanged, listener)
      return () => ipcRenderer.removeListener(IPC.eventDataChanged, listener)
    },
    onSettingsChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings): void => {
        callback(settings)
      }
      ipcRenderer.on(IPC.eventSettingsChanged, listener)
      return () => ipcRenderer.removeListener(IPC.eventSettingsChanged, listener)
    },
    onNavigate: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, route: string): void => {
        callback(route)
      }
      ipcRenderer.on(IPC.eventNavigate, listener)
      return () => ipcRenderer.removeListener(IPC.eventNavigate, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
