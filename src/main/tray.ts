import { app, dialog, Menu, nativeImage, Tray } from 'electron'
import { existsSync } from 'node:fs'
import type { PlanService } from './services/plan-service'
import type { ReminderScheduler } from './services/scheduler'
import type { WindowManager } from './windows/window-manager'

/**
 * 右下角常驻托盘。所有菜单项都直接操作主进程能力。
 */
export class TrayController {
  private tray: Tray | null = null

  constructor(
    private readonly planService: PlanService,
    private readonly scheduler: ReminderScheduler,
    private readonly windows: WindowManager
  ) {}

  create(): void {
    if (this.tray) {
      return
    }
    const iconPath = this.windows.getResourcePath('icon.png')
    const icon = existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty()

    this.tray = new Tray(icon)
    this.tray.setToolTip('静时 · 自律督促')
    this.tray.on('double-click', () => this.windows.showMain())
    this.rebuildMenu()
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }

  private rebuildMenu(): void {
    if (!this.tray) {
      return
    }
    const menu = Menu.buildFromTemplate([
      {
        label: '打开主面板',
        click: () => this.windows.showMain()
      },
      {
        label: '显示 / 隐藏悬浮窗',
        click: () => this.windows.toggleFloat()
      },
      {
        label: '暂停所有提醒',
        type: 'checkbox',
        checked: this.scheduler.isPaused,
        click: (menuItem) => {
          this.scheduler.setPaused(menuItem.checked)
          this.rebuildMenu()
        }
      },
      {
        label: '今日统计',
        click: () => {
          const snapshot = this.planService.getToday()
          void dialog
            .showMessageBox({
              type: 'info',
              title: '静时 · 今日统计',
              message: `${snapshot.date} 的自律进度`,
              detail: [
                `总计划：${snapshot.stats.total}`,
                `已完成：${snapshot.stats.finished}`,
                `进行中：${snapshot.stats.inProgress}`,
                `已跳过：${snapshot.stats.skipped}`,
                `完成率：${snapshot.stats.completionRate}%`
              ].join('\n'),
              buttons: ['查看统计', '关闭'],
              defaultId: 0,
              cancelId: 1,
              noLink: true
            })
            .then(({ response }) => {
              if (response === 0) {
                this.windows.showMain('/stats')
              }
            })
        }
      },
      {
        label: '设置',
        click: () => this.windows.showMain('/settings')
      },
      { type: 'separator' },
      {
        label: '退出软件',
        click: () => {
          this.scheduler.stop()
          this.windows.prepareQuit()
          app.quit()
        }
      }
    ])
    this.tray.setContextMenu(menu)
  }
}
