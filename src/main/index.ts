import { app, dialog, Menu } from 'electron'
import { AppDatabase } from './db/database'
import { registerIpcHandlers } from './ipc'
import { PlanService } from './services/plan-service'
import { ReminderScheduler } from './services/scheduler'
import { TrayController } from './tray'
import { WindowManager } from './windows/window-manager'

let db: AppDatabase | null = null
let windows: WindowManager | null = null
let scheduler: ReminderScheduler | null = null
let tray: TrayController | null = null

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.setAppUserModelId('com.jingshi.desktop')

  app.on('second-instance', () => {
    windows?.showMain()
  })

  app.whenReady().then(async () => {
    try {
      Menu.setApplicationMenu(null)

      db = new AppDatabase()
      await db.init()

      const planService = new PlanService(db)
      windows = new WindowManager(db)
      scheduler = new ReminderScheduler(db, planService, windows)
      tray = new TrayController(planService, scheduler, windows)

      registerIpcHandlers({
        db,
        planService,
        scheduler,
        windows
      })

      windows.createMainWindow()
      windows.createFloatWindow()
      tray.create()
      scheduler.start()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      dialog.showErrorBox('静时启动失败', `无法读取本地数据：${message}`)
      app.quit()
    }
  })

  app.on('before-quit', () => {
    scheduler?.stop()
    windows?.prepareQuit()
    tray?.destroy()
  })

  // 关闭主窗口只隐藏到托盘，窗口全部关闭也不退出主进程。
  app.on('window-all-closed', () => {
    // 保持托盘与调度器常驻。
  })

  app.on('activate', () => {
    windows?.showMain()
  })
}
