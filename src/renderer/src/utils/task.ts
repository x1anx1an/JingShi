import type { Plan, RepeatRule, TaskStatus } from '@shared/types'

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; className: string; icon: string }
> = {
  pending: { label: '待开始', className: 'status-badge--pending', icon: 'ph:clock' },
  running: { label: '进行中', className: 'status-badge--running', icon: 'ph:play-circle' },
  finished: { label: '已完成', className: 'status-badge--finished', icon: 'ph:check-circle' },
  skipped: { label: '已跳过', className: 'status-badge--skipped', icon: 'ph:skip-forward' },
  delayed: { label: '已延期', className: 'status-badge--delayed', icon: 'ph:hourglass' }
}

export function planTypeLabel(type: Plan['type']): string {
  return type === 'count' ? '计数目标' : '固定时段'
}

export function describeRepeat(rule: RepeatRule): string {
  if (rule.mode === 'once') {
    return '仅一次'
  }
  if (rule.mode === 'day') {
    return '每天'
  }
  if (rule.mode === 'week') {
    const labels = ['日', '一', '二', '三', '四', '五', '六']
    const days = (rule.weekDays ?? []).map((day) => labels[day]).join('、')
    return `每周${days}`
  }
  const days = (rule.monthDays ?? []).join('、')
  return `每月 ${days} 日`
}

export function describePlanRepeat(plan: Plan): string {
  const repeat = describeRepeat(plan.repeatRule)
  if (plan.repeatRule.mode === 'once' && plan.startDate) {
    const [, month, day] = plan.startDate.split('-')
    return `${repeat} · ${Number(month)}月${Number(day)}日`
  }
  return repeat
}

export function plusMinutesLabel(minutes: number): string {
  return minutes > 0 ? `已顺延 ${minutes} 分钟` : ''
}
