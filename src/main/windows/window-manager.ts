import { app, BrowserWindow, screen } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AppDatabase } from '../db/database'
import { IPC } from '@shared/ipc'
import type { AppSettings } from '@shared/types'

interface ReminderRequest {
  planId: string
  execDate: string
  second: boolean
}

const MAIN_WIDTH = 1200
const MAIN_HEIGHT = 820
const FLOAT_WIDTH = 360
const FLOAT_HEIGHT = 160
const REMINDER_WIDTH = 460
const REMINDER_HEIGHT = 560

/**
 * 窗口生命周期管理：主窗口、悬浮小组件、独立提醒窗口，以及跨窗口事件广播。
 */
export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private floatWindow: BrowserWindow | null = null
  private reminderWindow: BrowserWindow | null = null
  private reminderQueue: ReminderRequest[] = []
  private activeReminder: ReminderRequest | null = null
  private quitting = false
  private pendingRoute: string | null = null

  constructor(private readonly db: AppDatabase) {}

  get main(): BrowserWindow | null {
    return this.mainWindow
  }

  get floatVisible(): boolean {
    return !!this.floatWindow && !this.floatWindow.isDestroyed() && this.floatWindow.isVisible()
  }

  get isQuitting(): boolean {
    return this.quitting
  }

  getPreloadPath(): string {
    return join(__dirname, '../preload/index.js')
  }

  getResourcePath(fileName: string): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'resources', fileName)
      : join(__dirname, '../../resources', fileName)
  }

  createMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.showMain()
      return
    }

    const iconPath = this.getResourcePath('icon.png')
    this.mainWindow = new BrowserWindow({
      width: MAIN_WIDTH,
      height: MAIN_HEIGHT,
      minWidth: 1000,
      minHeight: 700,
      title: '静时',
      icon: existsSync(iconPath) ? iconPath : undefined,
      backgroundColor: '#f4f1ea',
      autoHideMenuBar: true,
      show: false,
      webPreferences: this.secureWebPreferences()
    })

    this.secureWindowNavigation(this.mainWindow)
    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show()
      if (this.pendingRoute) {
        const route = this.pendingRoute
        this.pendingRoute = null
        this.navigateMain(route)
      }
    })

    // 关闭主窗口 ≠ 退出程序：只隐藏到托盘。
    this.mainWindow.on('close', (event) => {
      if (this.quitting) {
        return
      }
      event.preventDefault()
      this.mainWindow?.hide()
    })

    this.mainWindow.on('minimize', () => {
      if (this.quitting || !this.db.settings.minimizeToTray) {
        return
      }
      this.mainWindow?.hide()
    })

    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })

    this.loadRoute(this.mainWindow, '/')
  }

  createFloatWindow(): void {
    if (this.floatWindow && !this.floatWindow.isDestroyed()) {
      this.floatWindow.showInactive()
      return
    }
    const iconPath = this.getResourcePath('icon.png')
    const settings = this.db.settings
    this.floatWindow = new BrowserWindow({
      width: FLOAT_WIDTH,
      height: FLOAT_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: settings.floatAlwaysOnTop,
      hasShadow: false,
      backgroundColor: '#00000000',
      show: false,
      title: '静时 · 悬浮窗',
      icon: existsSync(iconPath) ? iconPath : undefined,
      webPreferences: this.secureWebPreferences()
    })

    this.secureWindowNavigation(this.floatWindow)
    this.positionFloatWindow()
    this.floatWindow.setOpacity(this.normalizeOpacity(settings.floatOpacity))
    if (settings.floatAlwaysOnTop) {
      this.floatWindow.setAlwaysOnTop(true, 'floating')
    }

    this.floatWindow.once('ready-to-show', () => {
      this.floatWindow?.showInactive()
    })
    this.floatWindow.on('closed', () => {
      this.floatWindow = null
    })

    this.loadRoute(this.floatWindow, '/float')
  }

  toggleFloat(): void {
    if (!this.floatWindow || this.floatWindow.isDestroyed()) {
      this.createFloatWindow()
      return
    }
    if (this.floatWindow.isVisible()) {
      this.floatWindow.hide()
    } else {
      this.floatWindow.showInactive()
    }
  }

  hideFloat(): void {
    this.floatWindow?.hide()
  }

  showMain(route?: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      this.pendingRoute = route ?? null
      this.createMainWindow()
      return
    }
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore()
    }
    this.mainWindow.show()
    this.mainWindow.focus()
    if (route) {
      this.navigateMain(route)
    }
  }

  navigateMain(route: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      this.pendingRoute = route
      return
    }
    if (this.mainWindow.webContents.isLoading()) {
      this.mainWindow.webContents.once('did-finish-load', () => {
        this.mainWindow?.webContents.send(IPC.eventNavigate, route)
      })
      return
    }
    this.mainWindow.webContents.send(IPC.eventNavigate, route)
  }

  showReminder(planId: string, execDate: string, second = false): void {
    const existsInQueue =
      this.reminderQueue.some((item) => item.planId === planId && item.execDate === execDate) ||
      (this.activeReminder?.planId === planId && this.activeReminder.execDate === execDate)
    if (existsInQueue) {
      return
    }
    this.reminderQueue.push({ planId, execDate, second })
    this.openNextReminder()
  }

  closeReminders(): void {
    this.reminderQueue = []
    this.activeReminder = null
    if (this.reminderWindow && !this.reminderWindow.isDestroyed()) {
      this.reminderWindow.destroy()
    }
    this.reminderWindow = null
  }

  handleFloatDoubleClick(): void {
    if (this.db.settings.floatDoubleClickAction === 'hideFloat') {
      this.hideFloat()
      return
    }
    this.showMain()
  }

  applySettings(settings: AppSettings): void {
    if (this.floatWindow && !this.floatWindow.isDestroyed()) {
      this.floatWindow.setOpacity(this.normalizeOpacity(settings.floatOpacity))
      if (settings.floatAlwaysOnTop) {
        this.floatWindow.setAlwaysOnTop(true, 'floating')
      } else {
        this.floatWindow.setAlwaysOnTop(false)
      }
    }
    if (this.reminderWindow && !this.reminderWindow.isDestroyed()) {
      if (settings.reminderAlwaysOnTop) {
        this.reminderWindow.setAlwaysOnTop(true, 'screen-saver')
      } else {
        this.reminderWindow.setAlwaysOnTop(false)
      }
    }
  }

  broadcastDataChanged(): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.eventDataChanged)
      }
    }
  }

  broadcastSettings(settings: AppSettings): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.eventSettingsChanged, settings)
      }
    }
  }

  prepareQuit(): void {
    this.quitting = true
    this.closeReminders()
  }

  private openNextReminder(): void {
    if (this.reminderWindow && !this.reminderWindow.isDestroyed()) {
      return
    }
    const next = this.reminderQueue.shift()
    if (!next) {
      return
    }
    this.activeReminder = next

    const settings = this.db.settings
    this.reminderWindow = new BrowserWindow({
      width: REMINDER_WIDTH,
      height: REMINDER_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: settings.reminderAlwaysOnTop,
      hasShadow: false,
      backgroundColor: '#00000000',
      show: false,
      title: '静时 · 自律提醒',
      webPreferences: this.secureWebPreferences()
    })
    this.secureWindowNavigation(this.reminderWindow)
    this.reminderWindow.center()
    if (settings.reminderAlwaysOnTop) {
      this.reminderWindow.setAlwaysOnTop(true, 'screen-saver')
    }

    this.reminderWindow.once('ready-to-show', () => {
      this.reminderWindow?.show()
      this.reminderWindow?.focus()
    })
    this.reminderWindow.on('closed', () => {
      this.reminderWindow = null
      this.activeReminder = null
      // 稍作延迟，确保本次关闭流程结束后再打开下一条提醒。
      setTimeout(() => this.openNextReminder(), 200)
    })

    const query = new URLSearchParams({
      planId: next.planId,
      execDate: next.execDate,
      second: next.second ? '1' : '0'
    }).toString()
    this.loadRoute(this.reminderWindow, `/reminder?${query}`)
  }

  private positionFloatWindow(): void {
    if (!this.floatWindow) {
      return
    }
    const workArea = screen.getPrimaryDisplay().workArea
    const x = workArea.x + workArea.width - FLOAT_WIDTH - 24
    const y = workArea.y + workArea.height - FLOAT_HEIGHT - 24
    this.floatWindow.setPosition(x, y)
  }

  private normalizeOpacity(value: number): number {
    if (!Number.isFinite(value)) {
      return 0.94
    }
    return Math.min(1, Math.max(0.3, value))
  }

  private secureWebPreferences(): Electron.WebPreferences {
    return {
      preload: this.getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false
    }
  }

  private secureWindowNavigation(window: BrowserWindow): void {
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event, url) => {
      const devUrl = process.env['ELECTRON_RENDERER_URL']
      const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('file://')
      if (!allowed) {
        event.preventDefault()
      }
    })
  }

  private loadRoute(window: BrowserWindow, route: string): void {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl) {
      window.loadURL(`${devUrl}#${route}`)
    } else {
      window.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
    }
  }
}
