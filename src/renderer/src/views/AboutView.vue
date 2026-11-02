<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { AppInfo } from '@shared/types'

const appInfo = ref<AppInfo | null>(null)

onMounted(async () => {
  try {
    appInfo.value = await window.api.app.getInfo()
  } catch (error) {
    console.error('读取应用信息失败', error)
  }
})
</script>

<template>
  <div class="page about-page">
    <section class="about-hero panel">
      <div class="about-mark"><Icon icon="ph:leaf" width="26" /></div>
      <div class="about-copy">
        <div class="eyebrow">ABOUT JINGSHI</div>
        <h2 class="about-title">静时</h2>
        <p class="about-tagline">
          一款只做一件事的桌面自律工具：在约定的时间，轻轻提醒你回到当下。
        </p>
        <div class="about-meta">
          <span class="mini-tag">V0.1 MVP</span>
          <span class="mini-tag">版本 {{ appInfo?.version ?? '—' }}</span>
          <span class="mini-tag">{{ appInfo?.packaged ? '安装版' : '开发版' }}</span>
        </div>
      </div>
    </section>

    <section class="about-section">
      <div class="about-section-head">
        <Icon icon="ph:shield-check" width="18" />
        <h3>隐私与数据说明</h3>
      </div>
      <div class="about-card panel">
        <p class="about-lead">
          静时完全离线运行。计划、执行记录、设置与备份文件都只保存在本机，不会上传到任何服务器，也不会进行任何形式的统计或分享。
        </p>
        <ul class="about-list">
          <li>本地数据文件位于应用用户数据目录，可在「设置 → 数据管理」中查看完整路径。</li>
          <li>应用不读取其它软件的使用情况，不修改系统 hosts，不拦截网址，也不监控任何进程。</li>
          <li>系统通知仅用于到点提醒；若通知被 Windows 拦截，静时会在桌面弹出独立提醒窗口作为兜底。</li>
          <li>导出的 CSV 与 JSON 备份由你自行保管，文件不会离开这台电脑。</li>
          <li>卸载应用不会自动删除用户数据目录中的备份；如需彻底清除，请在应用中执行“清空全部数据”或手动删除该目录。</li>
        </ul>
      </div>
    </section>

    <section class="about-section">
      <div class="about-section-head">
        <Icon icon="ph:info" width="18" />
        <h3>免责声明</h3>
      </div>
      <div class="about-card panel">
        <p class="about-lead">
          静时是辅助自律的工具，不是强制约束手段。是否开始、是否完成、是否跳过，始终由你自己决定。因个人选择造成的计划变化或结果，由使用者自行承担。
        </p>
        <p class="about-lead">
          数据安全取决于你的设备与备份习惯。建议定期在数据管理中导出 JSON 备份，避免因系统故障、误删目录或重装系统造成数据丢失。
        </p>
      </div>
    </section>

    <section class="about-foot">
      <span class="mono">{{ appInfo?.dataPath ?? '' }}</span>
      <span>静时 · 让时间安静地发生</span>
    </section>
  </div>
</template>

<style scoped>
.about-page {
  max-width: 820px;
}

.about-hero {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 26px 28px;
  background:
    radial-gradient(circle at 100% 0, var(--accent-wash), transparent 55%),
    var(--surface);
}

.about-mark {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 16px;
  color: var(--accent);
  background: var(--accent-soft);
}

.about-title {
  margin: 4px 0 6px;
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.about-tagline {
  max-width: 480px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.8;
}

.about-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.about-section {
  margin-top: 22px;
}

.about-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: var(--accent);
}

.about-section-head h3 {
  color: var(--text);
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 600;
}

.about-card {
  padding: 20px 24px;
}

.about-lead {
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.9;
}

.about-lead + .about-lead {
  margin-top: 10px;
}

.about-list {
  margin: 14px 0 0;
  padding-left: 18px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.9;
}

.about-list li::marker {
  color: var(--accent);
}

.about-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 26px 4px 0;
  color: var(--muted);
  font-size: 10px;
}

.about-foot .mono {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
