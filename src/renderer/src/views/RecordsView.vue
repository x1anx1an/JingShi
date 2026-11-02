<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { NButton, NDataTable, NDatePicker, NSelect, NSpin, useMessage, type DataTableColumns } from 'naive-ui'
import { formatDate } from '@shared/date'
import type { RecordFilters, RecordFilterStatus, RecordRow, RecordStatus } from '@shared/types'

const message = useMessage()
const loading = ref(false)
const exporting = ref(false)
const rows = ref<RecordRow[]>([])
const statusFilter = ref<RecordFilterStatus>('all')
const dateRange = ref<[number, number] | null>(null)

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '已完成', value: 'finish' },
  { label: '已跳过', value: 'skip' },
  { label: '已延期', value: 'delay' }
]

const statusMeta: Record<RecordStatus, { label: string; className: string }> = {
  finish: { label: '已完成', className: 'status-badge--finished' },
  skip: { label: '已跳过', className: 'status-badge--skipped' },
  delay: { label: '已延期', className: 'status-badge--delayed' }
}

const columns: DataTableColumns<RecordRow> = [
  {
    title: '计划名称',
    key: 'planName',
    minWidth: 150,
    render: (row) => h('span', { class: 'record-name' }, row.planName)
  },
  {
    title: '执行日期',
    key: 'execDate',
    width: 130,
    render: (row) => h('span', { class: 'record-date mono' }, `${row.execDate} · ${row.originTime}`)
  },
  {
    title: '状态',
    key: 'status',
    width: 94,
    render: (row) =>
      h('span', { class: `status-badge ${statusMeta[row.status].className}` }, statusMeta[row.status].label)
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 160,
    render: (row) =>
      row.remark
        ? h('span', { class: 'record-remark', title: row.remark }, row.remark)
        : h('span', { class: 'record-empty' }, '—')
  },
  {
    title: '操作时间',
    key: 'finishAt',
    width: 150,
    render: (row) => {
      const date = new Date(row.finishAt)
      return h(
        'span',
        { class: 'record-date mono' },
        `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      )
    }
  }
]

/** Naive UI 的 row-key 仅接受函数形式 */
function getRowKey(row: RecordRow): string {
  return row.id
}

const activeFilter = computed<RecordFilters>(() => {
  const filters: RecordFilters = { status: statusFilter.value }
  if (dateRange.value) {
    filters.startDate = formatDate(new Date(dateRange.value[0]))
    filters.endDate = formatDate(new Date(dateRange.value[1]))
  }
  return filters
})

onMounted(() => {
  void loadRecords()
})

watch([statusFilter, dateRange], () => {
  void loadRecords(false)
})

async function loadRecords(withLoading = true): Promise<void> {
  if (withLoading) {
    loading.value = true
  }
  try {
    const result = await window.api.records.query(activeFilter.value)
    rows.value = result.rows
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载执行记录失败')
  } finally {
    loading.value = false
  }
}

async function exportCsv(): Promise<void> {
  exporting.value = true
  try {
    const result = await window.api.records.exportCsv(activeFilter.value)
    if (!result.canceled && result.filePath) {
      message.success(`已导出 ${rows.value.length} 条记录`)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导出 CSV 失败')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="page records-page">
    <div class="record-panel panel">
      <div class="record-toolbar">
        <div class="filter-group">
          <div class="filter-item">
            <span class="filter-label">状态</span>
            <n-select
              v-model:value="statusFilter"
              :options="statusOptions"
              size="small"
              class="filter-select"
            />
          </div>
          <div class="filter-item">
            <span class="filter-label">时间范围</span>
            <n-date-picker
              v-model:value="dateRange"
              type="daterange"
              size="small"
              clearable
              class="filter-date"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
            />
          </div>
        </div>
        <div class="toolbar-actions">
          <span class="record-count">
            <Icon icon="ph:list-bullets" width="14" />
            共 {{ rows.length }} 条
          </span>
          <n-button
            size="small"
            secondary
            type="primary"
            :loading="exporting"
            :disabled="rows.length === 0"
            @click="exportCsv"
          >
            <template #icon><Icon icon="ph:download-simple" /></template>
            导出 CSV
          </n-button>
        </div>
      </div>

      <div class="record-hint">
        每一次完成、跳过与延期都会留下记录。跳过理由将保留在此，供之后复盘。
      </div>

      <n-spin :show="loading">
        <div v-if="rows.length" class="record-table-wrap">
          <n-data-table
            :columns="columns"
            :data="rows"
            :bordered="false"
            :single-line="false"
            :pagination="false"
            size="small"
            :row-key="getRowKey"
          />
        </div>
        <div v-else class="empty-state record-empty-state">
          <div class="empty-state__icon"><Icon icon="ph:scroll" /></div>
          <div class="empty-state__title">还没有执行记录</div>
          <p class="empty-state__desc">完成一次计划后，这里会出现一条真实的记录。</p>
        </div>
      </n-spin>
    </div>
  </div>
</template>

<style scoped>
.record-panel {
  padding: 18px;
}

.record-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 7px;
}

.filter-label {
  color: var(--muted);
  font-size: 10px;
}

.filter-select {
  width: 116px;
}

.filter-date {
  width: 238px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.record-count {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 10px;
}

.record-hint {
  padding: 10px 12px;
  margin: 14px 0 6px;
  border-left: 2px solid var(--accent);
  border-radius: 0 7px 7px 0;
  color: var(--text-soft);
  background: var(--accent-wash);
  font-size: 10px;
  line-height: 1.6;
}

.record-table-wrap {
  margin-top: 4px;
}

.record-empty-state {
  min-height: 340px;
}
</style>

<style>
.record-name {
  color: var(--text);
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
}

.record-date {
  color: var(--text-soft);
  font-size: 10px;
}

.record-remark {
  display: block;
  max-width: 300px;
  overflow: hidden;
  color: var(--text-soft);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-empty {
  color: var(--muted);
}
</style>
