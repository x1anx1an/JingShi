<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  NButton,
  NInput,
  NModal,
  NSelect,
  NSlider,
  NSwitch,
  NTabPane,
  NTabs,
  useDialog,
  useMessage
} from 'naive-ui'
import type {
  AppInfo,
  AppSettings,
  FloatDoubleClickAction,
  SoundType
} from '@shared/types'
import { useSettingsStore } from '@renderer/stores/settings'

const settingsStore = useSettingsStore()
const message = useMessage()
const dialog = useDialog()

const appInfo = ref<AppInfo | null>(null)
const opacityDraft = ref(settingsStore.settings.floatOpacity)
const showClearModal = ref(false)
const clearKeyword = ref('')
const clearing = ref(false)

const soundOptions: Array<{ label: string; value: SoundType }> = [
  { label: '清脆铃音 · Chime', value: 'chime' },
  { label: '柔和提示音 · Soft', value: 'soft' },
  { label: '静音（仅弹窗提醒）', value: 'none' }
]

const doubleClickOptions: Array<{ label: string; value: FloatDoubleClickAction }> = [
  { label: '打开主面板', value: 'openMain' },
  { label: '隐藏悬浮窗', value: 'hideFloat' }
]

// 设置被其它窗口（托盘、导入备份）修改时，同步滑块草稿值。
watch(
  () => settingsStore.settings.floatOpacity,
  (value) => {
    opacityDraft.value = value
  }
)

onMounted(async () => {
  try {
    appInfo.value = await window.api.app.getInfo()
  } catch (error) {
    console.error('读取应用信息失败', error)
  }
})

async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  try {
    await settingsStore.update(patch)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存设置失败')
  }
}

async function commitOpacity(): Promise<void> {
  if (Math.abs(opacityDraft.value - settingsStore.settings.floatOpacity) < 0.01) {
    return
  }
  await saveSettings({ floatOpacity: opacityDraft.value })
}

async function exportBackup(): Promise<void> {
  try {
    const result = await window.api.data.exportJson()
    if (!result.canceled) {
      message.success(`备份已导出到 ${result.filePath}`)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导出备份失败')
  }
}

async function importBackup(): Promise<void> {
  try {
    const result = await window.api.data.importJson()
    if (result.canceled) {
      return
    }
    await settingsStore.load()
    message.success('备份已导入，计划与记录已恢复')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导入备份失败')
  }
}

/** 第一次风险确认 */
function requestClear(): void {
  dialog.error({
    title: '清空全部数据',
    content: '此操作会删除所有计划、执行记录与设置，且无法撤销。强烈建议先导出备份。',
    positiveText: '我了解风险，继续',
    negativeText: '取消',
    onPositiveClick: () => {
      clearKeyword.value = ''
      showClearModal.value = true
    }
  })
}

/** 第二次强确认：必须手动输入“清空” */
async function confirmClear(): Promise<void> {
  if (clearKeyword.value.trim() !== '清空') {
    return
  }
  clearing.value = true
  try {
    await window.api.data.clearAll()
    await settingsStore.load()
    showClearModal.value = false
    message.success('全部本地数据已清空')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '清空数据失败')
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <div class="page settings-page">
    <div class="settings-intro">
      <div class="eyebrow">PREFERENCES</div>
      <h2 class="settings-title">把静时调成你喜欢的样子。</h2>
      <p class="settings-sub">所有设置与数据都只保存在这台电脑上，不会同步或上传。</p>
    </div>

    <n-tabs class="settings-tabs" type="line" animated>
      <n-tab-pane name="general" tab="通用设置">
        <div class="settings-card panel">
          <div class="setting-row">
            <div class="setting-icon"><Icon icon="ph:power" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">开机自启</div>
              <div class="setting-desc">
                登录 Windows 后自动在托盘运行静时。
                <span v-if="appInfo && !appInfo.packaged" class="setting-hint">
                  开发环境不会写入系统启动项。
                </span>
              </div>
            </div>
            <n-switch
              :value="settingsStore.settings.autoLaunch"
              @update:value="saveSettings({ autoLaunch: $event })"
            />
          </div>

          <div class="setting-row">
            <div class="setting-icon"><Icon icon="ph:arrows-in-line-vertical" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">最小化收进托盘</div>
              <div class="setting-desc">最小化主窗口时隐藏到右下角托盘，而不是停留在任务栏。</div>
            </div>
            <n-switch
              :value="settingsStore.settings.minimizeToTray"
              @update:value="saveSettings({ minimizeToTray: $event })"
            />
          </div>
        </div>
      </n-tab-pane>

      <n-tab-pane name="reminder" tab="提醒设置">
        <div class="settings-card panel">
          <div class="setting-row">
            <div class="setting-icon"><Icon icon="ph:bell-ringing" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">提示音</div>
              <div class="setting-desc">到点提醒时播放。系统通知被拦截时，独立弹窗仍会出现。</div>
            </div>
            <n-select
              class="setting-select"
              :value="settingsStore.settings.sound"
              :options="soundOptions"
              @update:value="saveSettings({ sound: $event })"
            />
          </div>

          <div class="setting-row">
            <div class="setting-icon"><Icon icon="ph:alarm" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">超时二次提醒</div>
              <div class="setting-desc">任务开始 5 分钟后仍未开始，再提醒一次。</div>
            </div>
            <n-switch
              :value="settingsStore.settings.timeoutRemind"
              @update:value="saveSettings({ timeoutRemind: $event })"
            />
          </div>

          <div class="setting-row">
            <div class="setting-icon"><Icon icon="ph:push-pin" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">提醒弹窗置顶</div>
              <div class="setting-desc">提醒窗口始终显示在其它窗口之上，避免被忽略。</div>
            </div>
            <n-switch
              :value="settingsStore.settings.reminderAlwaysOnTop"
              @update:value="saveSettings({ reminderAlwaysOnTop: $event })"
            />
          </div>
        </div>
      </n-tab-pane>

      <n-tab-pane name="float" tab="悬浮窗设置">
        <div class="settings-card panel">
          <div class="setting-row">
            <div class="setting-icon"><Icon icon="ph:circle-half" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">悬浮窗透明度</div>
              <div class="setting-desc">越低越淡化，拖动滑块后松手生效。</div>
            </div>
            <div class="opacity-control">
              <n-slider
                v-model:value="opacityDraft"
                :min="0.3"
                :max="1"
                :step="0.01"
                :format-tooltip="(value: number) => `${Math.round(value * 100)}%`"
                @change="commitOpacity"
              />
              <span class="opacity-value">{{ Math.round(opacityDraft * 100) }}%</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-icon"><Icon icon="ph:stack" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">悬浮窗置顶</div>
              <div class="setting-desc">让悬浮小组件保持在其他应用上方。</div>
            </div>
            <n-switch
              :value="settingsStore.settings.floatAlwaysOnTop"
              @update:value="saveSettings({ floatAlwaysOnTop: $event })"
            />
          </div>

          <div class="setting-row">
            <div class="setting-icon"><Icon icon="ph:cursor-click" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">双击悬浮窗动作</div>
              <div class="setting-desc">双击悬浮窗空白区域时执行的操作。</div>
            </div>
            <n-select
              class="setting-select"
              :value="settingsStore.settings.floatDoubleClickAction"
              :options="doubleClickOptions"
              @update:value="saveSettings({ floatDoubleClickAction: $event })"
            />
          </div>
        </div>
      </n-tab-pane>

      <n-tab-pane name="data" tab="数据管理">
        <div class="settings-card panel">
          <div class="data-path">
            <div class="setting-icon"><Icon icon="ph:database" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">本地数据位置</div>
              <div class="setting-desc mono">{{ appInfo?.dataPath ?? '读取中…' }}</div>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-icon"><Icon icon="ph:export" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">导出 JSON 备份</div>
              <div class="setting-desc">包含全部计划、执行记录、运行时状态与设置。</div>
            </div>
            <n-button secondary type="primary" @click="exportBackup">导出备份</n-button>
          </div>

          <div class="setting-row">
            <div class="setting-icon"><Icon icon="ph:download-simple" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">导入备份</div>
              <div class="setting-desc">导入会覆盖当前全部数据，建议先导出当前备份。</div>
            </div>
            <n-button secondary @click="importBackup">选择文件</n-button>
          </div>

          <div class="setting-row danger-row">
            <div class="setting-icon setting-icon--danger"><Icon icon="ph:trash" width="18" /></div>
            <div class="setting-copy">
              <div class="setting-label">清空全部数据</div>
              <div class="setting-desc">删除所有计划、记录和设置，此操作不可撤销。</div>
            </div>
            <n-button type="error" secondary @click="requestClear">清空数据</n-button>
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>

    <n-modal
      v-model:show="showClearModal"
      preset="card"
      class="clear-modal"
      title="最后确认"
      :bordered="false"
      :style="{ width: '420px' }"
    >
      <p class="clear-text">
        请输入 <strong>清空</strong> 两个字，确认删除全部本地数据。
      </p>
      <n-input
        v-model:value="clearKeyword"
        placeholder="请输入：清空"
        :maxlength="8"
        @keyup.enter="confirmClear"
      />
      <template #footer>
        <div class="clear-footer">
          <n-button @click="showClearModal = false">取消</n-button>
          <n-button
            type="error"
            :disabled="clearKeyword.trim() !== '清空'"
            :loading="clearing"
            @click="confirmClear"
          >
            确认清空
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 880px;
}

.settings-intro {
  margin-bottom: 18px;
}

.settings-title {
  margin: 5px 0 6px;
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 600;
}

.settings-sub {
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.7;
}

.settings-tabs :deep(.n-tabs-nav-scroll-content) {
  gap: 4px;
}

.settings-card {
  margin-top: 8px;
  padding: 4px 20px;
}

.setting-row,
.data-path {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}

.setting-row:last-child,
.data-path {
  border-bottom: 0;
}

.setting-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--accent);
  background: var(--accent-soft);
}

.setting-icon--danger {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}

.setting-copy {
  flex: 1;
  min-width: 0;
}

.setting-label {
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.setting-desc {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.setting-hint {
  color: var(--warning);
}

.setting-select {
  flex-shrink: 0;
  width: 190px;
}

.opacity-control {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  width: 240px;
}

.opacity-value {
  width: 40px;
  color: var(--text-soft);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.clear-text {
  margin-bottom: 12px;
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.7;
}

.clear-text strong {
  color: var(--danger);
}

.clear-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
