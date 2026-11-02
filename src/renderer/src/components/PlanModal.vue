<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  NButton,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSwitch,
  NTimePicker,
  useMessage
} from 'naive-ui'
import { isDateString, isTimeString, parseDate, timeToMinutes, todayDate } from '@shared/date'
import type { Plan, PlanInput, PlanType, RepeatMode } from '@shared/types'

const props = defineProps<{
  show: boolean
  plan?: Plan | null
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  save: [input: PlanInput]
}>()

const message = useMessage()

const isEdit = computed(() => !!props.plan)

const form = reactive({
  name: '',
  type: 'time' as PlanType,
  startTime: '09:00',
  endTime: '10:00',
  repeatMode: 'day' as RepeatMode,
  weekDays: [] as number[],
  monthDays: [] as number[],
  startDate: '',
  endDate: '',
  contractText: '',
  enableRemind: true,
  showFloat: true
})

const repeatOptions: Array<{ value: RepeatMode; label: string }> = [
  { value: 'once', label: '仅一次' },
  { value: 'day', label: '每天' },
  { value: 'week', label: '每周' },
  { value: 'month', label: '每月' }
]

const weekdayOptions = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' }
]

const monthOptions = Array.from({ length: 31 }, (_, index) => ({
  label: `${index + 1} 日`,
  value: index + 1
}))

watch(
  () => props.show,
  (show) => {
    if (show) {
      resetForm()
    }
  }
)

function resetForm(): void {
  const plan = props.plan
  if (plan) {
    form.name = plan.name
    form.type = plan.type
    form.startTime = plan.startTime
    form.endTime = plan.endTime
    form.repeatMode = plan.repeatRule.mode
    form.weekDays = [...(plan.repeatRule.weekDays ?? [])]
    form.monthDays = [...(plan.repeatRule.monthDays ?? [])]
    form.startDate = plan.startDate ?? ''
    form.endDate = plan.endDate ?? ''
    form.contractText = plan.contractText
    form.enableRemind = plan.enableRemind
    form.showFloat = plan.showFloat
    return
  }

  form.name = ''
  form.type = 'time'
  form.startTime = '09:00'
  form.endTime = '10:00'
  form.repeatMode = 'day'
  form.weekDays = []
  form.monthDays = []
  form.startDate = ''
  form.endDate = ''
  form.contractText = ''
  form.enableRemind = true
  form.showFloat = true
}

function close(): void {
  emit('update:show', false)
}

function toggleWeekday(day: number): void {
  form.weekDays = form.weekDays.includes(day)
    ? form.weekDays.filter((item) => item !== day)
    : [...form.weekDays, day]
}

function handleRepeatMode(mode: RepeatMode): void {
  form.repeatMode = mode
  if (mode === 'week' && form.weekDays.length === 0) {
    form.weekDays = [new Date().getDay()]
  }
  if (mode === 'month' && form.monthDays.length === 0) {
    form.monthDays = [new Date().getDate()]
  }
}

function dateValue(dateStr: string): number | null {
  return isDateString(dateStr) ? parseDate(dateStr).getTime() : null
}

function handleDateValue(value: number | null, field: 'startDate' | 'endDate'): void {
  if (!value) {
    form[field] = ''
    return
  }
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  form[field] = `${year}-${month}-${day}`
}

function submit(): void {
  const name = form.name.trim()
  if (!name) {
    message.warning('请填写计划名称')
    return
  }
  if (!isTimeString(form.startTime) || !isTimeString(form.endTime)) {
    message.warning('请填写有效的时间')
    return
  }
  if (timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
    message.warning('结束时间必须晚于开始时间')
    return
  }
  if (form.repeatMode === 'week' && form.weekDays.length === 0) {
    message.warning('请至少选择一个星期')
    return
  }
  if (form.repeatMode === 'month' && form.monthDays.length === 0) {
    message.warning('请至少选择一个日期')
    return
  }
  if (form.startDate && form.endDate && form.startDate > form.endDate) {
    message.warning('生效结束日期不能早于开始日期')
    return
  }

  let startDate = form.startDate || undefined
  if (form.repeatMode === 'once' && !startDate) {
    startDate = todayDate()
  }

  const input: PlanInput = {
    name,
    type: form.type,
    startTime: form.startTime,
    endTime: form.endTime,
    repeatRule: {
      mode: form.repeatMode,
      weekDays: form.repeatMode === 'week' ? [...form.weekDays] : undefined,
      monthDays: form.repeatMode === 'month' ? [...form.monthDays] : undefined
    },
    startDate,
    endDate: form.endDate || undefined,
    contractText: form.contractText.trim(),
    enableRemind: form.enableRemind,
    showFloat: form.showFloat
  }
  emit('save', input)
}
</script>

<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    preset="card"
    class="plan-modal"
    :style="{ width: '640px', maxWidth: '92vw' }"
    :bordered="false"
    @update:show="emit('update:show', $event)"
  >
    <template #header>
      <div class="modal-head">
        <div class="modal-icon"><Icon icon="ph:calendar-plus" width="20" /></div>
        <div>
          <div class="eyebrow">{{ isEdit ? 'EDIT PLAN' : 'NEW PLAN' }}</div>
          <h2>{{ isEdit ? '编辑计划' : '新建自律计划' }}</h2>
        </div>
      </div>
    </template>

    <div class="modal-body-scroll">
      <n-form label-placement="top" :show-require-mark="false" size="large">
      <n-form-item label="计划名称" required>
        <n-input
          v-model:value="form.name"
          placeholder="例如：读完 20 页书"
          maxlength="60"
          show-count
          autofocus
        />
      </n-form-item>

      <div class="form-label">计划类型</div>
      <div class="type-options">
        <button
          type="button"
          class="type-card"
          :class="{ 'is-selected': form.type === 'time' }"
          @click="form.type = 'time'"
        >
          <Icon icon="ph:clock" width="20" />
          <span class="type-title">固定时段任务</span>
          <span class="type-desc">在设定时间进入一段专注</span>
        </button>
        <button
          type="button"
          class="type-card"
          :class="{ 'is-selected': form.type === 'count' }"
          @click="form.type = 'count'"
        >
          <Icon icon="ph:hash" width="20" />
          <span class="type-title">计数目标任务</span>
          <span class="type-desc">每次执行完成即计数一次</span>
        </button>
      </div>

      <div class="time-grid">
        <n-form-item label="开始时间" required>
          <n-time-picker
            v-model:formatted-value="form.startTime"
            format="HH:mm"
            value-format="HH:mm"
            :clearable="false"
            placeholder="09:00"
          />
        </n-form-item>
        <div class="time-arrow">
          <Icon icon="ph:arrow-right" width="16" />
        </div>
        <n-form-item label="结束时间" required>
          <n-time-picker
            v-model:formatted-value="form.endTime"
            format="HH:mm"
            value-format="HH:mm"
            :clearable="false"
            placeholder="10:00"
          />
        </n-form-item>
      </div>

      <div class="form-label">重复规则</div>
      <div class="repeat-options">
        <button
          v-for="option in repeatOptions"
          :key="option.value"
          type="button"
          class="repeat-chip"
          :class="{ 'is-selected': form.repeatMode === option.value }"
          @click="handleRepeatMode(option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <div v-if="form.repeatMode === 'week'" class="weekday-row">
        <button
          v-for="day in weekdayOptions"
          :key="day.value"
          type="button"
          class="day-chip"
          :class="{ 'is-selected': form.weekDays.includes(day.value) }"
          @click="toggleWeekday(day.value)"
        >
          {{ day.label }}
        </button>
        <span class="field-hint">选择每周执行的星期</span>
      </div>

      <n-form-item v-if="form.repeatMode === 'month'" label="每月日期">
        <n-select
          v-model:value="form.monthDays"
          multiple
          :options="monthOptions"
          placeholder="选择每月执行的日期"
          :max-tag-count="8"
        />
      </n-form-item>

      <div class="date-grid">
        <n-form-item :label="form.repeatMode === 'once' ? '执行日期' : '生效开始日期'">
          <n-date-picker
            :value="dateValue(form.startDate)"
            type="date"
            clearable
            placeholder="可选"
            @update:value="(value: number | null) => handleDateValue(value, 'startDate')"
          />
          <div class="field-hint">
            {{ form.repeatMode === 'once' ? '留空则执行今天' : '留空即生效' }}
          </div>
        </n-form-item>
        <n-form-item label="生效结束日期">
          <n-date-picker
            :value="dateValue(form.endDate)"
            type="date"
            clearable
            placeholder="可选"
            @update:value="(value: number | null) => handleDateValue(value, 'endDate')"
          />
          <div class="field-hint">留空长期有效</div>
        </n-form-item>
      </div>

      <n-form-item label="自律契约备注">
        <n-input
          v-model:value="form.contractText"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          maxlength="200"
          show-count
          placeholder="写给自己的提醒，会展示在到点提醒弹窗中"
        />
      </n-form-item>

      <div class="switch-panel">
        <div class="switch-row">
          <div class="switch-icon"><Icon icon="ph:bell-ringing" width="17" /></div>
          <div class="switch-copy">
            <span class="switch-title">开启提醒</span>
            <span class="switch-desc">到点通过系统通知与提醒弹窗提示</span>
          </div>
          <n-switch v-model:value="form.enableRemind" />
        </div>
        <div class="switch-row">
          <div class="switch-icon"><Icon icon="ph:app-window" width="17" /></div>
          <div class="switch-copy">
            <span class="switch-title">在悬浮窗展示</span>
            <span class="switch-desc">任务进行时显示在桌面悬浮小组件</span>
          </div>
          <n-switch v-model:value="form.showFloat" />
        </div>
      </div>
    </n-form>
    </div>

    <template #footer>
      <div class="modal-footer">
        <n-button quaternary @click="close">取消</n-button>
        <n-button type="primary" :loading="saving" @click="submit">
          {{ isEdit ? '保存修改' : '创建计划' }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  color: var(--accent);
  background: var(--accent-soft);
}

.modal-head h2 {
  margin-top: 3px;
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 600;
}

.modal-body-scroll {
  max-height: 62vh;
  padding-right: 4px;
  overflow-y: auto;
}

.form-label {
  margin: 4px 0 8px;
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 600;
}

.type-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}

.type-card {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 2px 8px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text-soft);
  background: var(--surface);
  cursor: pointer;
  text-align: left;
  transition: all 0.16s ease;
}

.type-card svg {
  grid-row: 1 / 3;
  color: var(--muted);
  align-self: center;
}

.type-card.is-selected {
  border-color: var(--accent);
  color: var(--text);
  background: var(--accent-wash);
}

.type-card.is-selected svg {
  color: var(--accent);
}

.type-title {
  font-size: 12px;
  font-weight: 600;
}

.type-desc {
  color: var(--muted);
  font-size: 10px;
}

.time-grid {
  display: grid;
  grid-template-columns: 1fr 24px 1fr;
  align-items: start;
}

.time-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  margin-top: 26px;
  color: var(--muted);
}

.repeat-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.repeat-chip,
.day-chip {
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-soft);
  background: var(--surface);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.16s ease;
}

.repeat-chip {
  padding: 0 16px;
}

.day-chip {
  width: 32px;
  padding: 0;
}

.repeat-chip:hover,
.day-chip:hover {
  border-color: var(--border-strong);
  color: var(--text);
}

.repeat-chip.is-selected,
.day-chip.is-selected {
  border-color: var(--accent);
  color: var(--accent-strong);
  background: var(--accent-soft);
  font-weight: 600;
}

.weekday-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: -2px 0 14px;
}

.field-hint {
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
  margin-top: 4px;
}

.date-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.switch-panel {
  overflow: hidden;
  margin-top: 4px;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 14px;
  background: var(--surface);
}

.switch-row + .switch-row {
  border-top: 1px solid var(--border);
}

.switch-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: var(--accent);
  background: var(--accent-wash);
}

.switch-copy {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 2px;
}

.switch-title {
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}

.switch-desc {
  color: var(--muted);
  font-size: 10px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
