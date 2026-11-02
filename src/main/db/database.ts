import { app } from 'electron'
import { join } from 'node:path'
import { JSONFilePreset } from 'lowdb/node'
import type { Low } from 'lowdb'
import {
  createDefaultDatabase,
  DEFAULT_SETTINGS,
  type AppSettings,
  type DatabaseSchema,
  type ExecutionRecord,
  type Plan,
  type TaskRuntime
} from '@shared/types'

const DB_FILE_NAME = 'jingshi-data.json'

/**
 * lowdb 数据库封装。
 * 数据文件位于 Electron userData 目录，卸载 / 重装不会上传到任何网络。
 */
export class AppDatabase {
  private db: Low<DatabaseSchema> | null = null
  private readonly filePath: string

  constructor() {
    this.filePath = join(app.getPath('userData'), DB_FILE_NAME)
  }

  async init(): Promise<void> {
    this.db = await JSONFilePreset<DatabaseSchema>(this.filePath, createDefaultDatabase())
    // 兼容旧版本文件中缺失的字段，保证升级后不会因 undefined 崩溃。
    this.db.data.plans ??= []
    this.db.data.records ??= []
    this.db.data.runtime ??= {}
    this.db.data.settings = {
      ...DEFAULT_SETTINGS,
      ...(this.db.data.settings ?? {})
    }
    this.db.data.meta ??= {
      schemaVersion: 1,
      createdAt: Date.now()
    }
    await this.db.write()
  }

  get dataPath(): string {
    return this.filePath
  }

  get data(): DatabaseSchema {
    if (!this.db) {
      throw new Error('数据库尚未初始化')
    }
    return this.db.data
  }

  async save(): Promise<void> {
    if (!this.db) {
      return
    }
    await this.db.write()
  }

  listPlans(): Plan[] {
    return this.data.plans
  }

  getPlan(id: string): Plan | undefined {
    return this.data.plans.find((plan) => plan.id === id)
  }

  async addPlan(plan: Plan): Promise<void> {
    this.data.plans.push(plan)
    await this.save()
  }

  async updatePlan(plan: Plan): Promise<void> {
    const index = this.data.plans.findIndex((item) => item.id === plan.id)
    if (index < 0) {
      throw new Error('计划不存在')
    }
    this.data.plans[index] = plan
    await this.save()
  }

  async removePlan(id: string): Promise<void> {
    this.data.plans = this.data.plans.filter((plan) => plan.id !== id)
    for (const [key, runtime] of Object.entries(this.data.runtime)) {
      if (runtime.planId === id) {
        delete this.data.runtime[key]
      }
    }
    await this.save()
  }

  listRecords(): ExecutionRecord[] {
    return this.data.records
  }

  async addRecord(record: ExecutionRecord): Promise<void> {
    this.data.records.push(record)
    await this.save()
  }

  getRuntime(key: string): TaskRuntime | undefined {
    return this.data.runtime[key]
  }

  async saveRuntime(runtime: TaskRuntime): Promise<void> {
    this.data.runtime[`${runtime.planId}|${runtime.execDate}`] = runtime
    await this.save()
  }

  async removeRuntime(key: string): Promise<void> {
    delete this.data.runtime[key]
    await this.save()
  }

  get settings(): AppSettings {
    return this.data.settings
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    this.data.settings = {
      ...this.data.settings,
      ...patch
    }
    await this.save()
    return this.data.settings
  }

  /** 导入备份时整体替换数据 */
  async replaceData(schema: DatabaseSchema): Promise<void> {
    this.data.plans = schema.plans
    this.data.records = schema.records
    this.data.runtime = schema.runtime
    this.data.settings = {
      ...DEFAULT_SETTINGS,
      ...schema.settings
    }
    this.data.meta = schema.meta
    await this.save()
  }

  /** 清空全部业务数据并恢复默认设置 */
  async clearAll(): Promise<void> {
    if (!this.db) {
      return
    }
    this.db.data = createDefaultDatabase()
    await this.db.write()
  }
}
