/** Static, fictional content for the Android interface preview. No network calls. */
const exampleBirth = '示例人物 1998-05-12 08:30 浙江杭州'
const createdAt = '2026-06-01T08:00:00Z'

const exampleReport = {
  id: 1,
  user_id: 1,
  status: 'completed',
  error_message: null,
  can_retry: false,
  birth_info: exampleBirth,
  calendar_data: {
    full_bazi: true,
    year: { gan_zhi: '戊寅', gan: '戊', zhi: '寅', wu_xing: '土木' },
    month: { gan_zhi: '丁巳', gan: '丁', zhi: '巳', wu_xing: '火火' },
    day: { gan_zhi: '己未', gan: '己', zhi: '未', wu_xing: '土土' },
    hour: { gan_zhi: '戊辰', gan: '戊', zhi: '辰', wu_xing: '土土' },
    suggestion: '这是一份界面示例。正式版会根据实际资料生成内容。',
    references: [],
    verification: { version: 1, status: 'not_checked', scope: '示例数据', reference_ids: [] },
    yun: {
      start_year_num: 4,
      start_month_num: 2,
      start_day_num: 0,
      start_solar_date: '2002-07-12',
      is_forward: true,
      da_yun: [{
        index: 0, gan_zhi: '戊午', start_age: 5, end_age: 14,
        start_year: 2002, end_year: 2011, liu_nian: [],
      }],
    },
  },
  ai_analysis: '【界面示例】\n\n这里展示正式报告的阅读排版。所有内容均为虚构示例，不是对你输入资料的分析。',
  is_premium: false,
  analysis_logs_count: 0,
  analysis_logs: [],
  created_at: createdAt,
  updated_at: createdAt,
}

let demoStick: {
  number: number
  grade: string
  title: string
  poem: string
  line: string
  plain: string
  cat: string
  date: string
  already_drawn: boolean
  disclaimer: string
} | null = null

export function offlineResponse(url: string, method: string): { code: number; message: string; data: any } {
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
  const today = new Date().toISOString().slice(0, 10)
  let data: any
  if (path.endsWith('/anonymous-login') || path.endsWith('/refresh')) {
    data = { token: 'offline-preview', user_id: 1 }
  } else if (path.endsWith('/oasis/reports')) {
    data = { reports: [{
      id: 1, birth_info: exampleBirth, status: 'completed',
      ai_analysis_preview: '界面示例', created_at: createdAt, updated_at: createdAt,
    }], total: 1, skip: 0, limit: 20 }
  } else if (path.endsWith('/oasis/report/1')) {
    data = exampleReport
  } else if (path.endsWith('/oasis/daily-fortune')) {
    data = {
      report_id: 1, birth_info: exampleBirth, date: today,
      day_gan_zhi: '示例', day_relation: '界面体验', clash_info: '',
      fortune_text: '今天先看看这只小猫和页面布局。正式版会显示与你相关的内容。',
      lucky_color: '暖紫', lucky_direction: '示例', warning: '本页展示的是虚构示例。', is_cached: true,
    }
  } else if (path.endsWith('/oasis/fortune-stick')) {
    const todayStick = new Date().toISOString().slice(0, 10)
    if (method === 'POST' && !demoStick) {
      demoStick = {
        number: 1,
        grade: '上上',
        title: '宋太祖黄袍加身',
        poem: '天开地辟结良缘，日吉时良万事全\n若得此签非小可，人行中正帝王宣',
        line: '天开地辟结良缘',
        plain: '这支签说的是开头顺利。事情可以往前走，仍要自己把步骤做完。',
        cat: '喵，你默念的那件事，可以轻轻试一下，小猫在旁边看着。',
        date: todayStick,
        already_drawn: false,
        disclaimer: '仅供娱乐参考',
      }
    } else if (demoStick) {
      demoStick = { ...demoStick, already_drawn: true }
    }
    data = demoStick
  } else if (path.endsWith('/oasis/almanac')) {
    data = {
      solar_date: today, lunar_date: today, day_gan_zhi: '示例', animal: '示例',
      yi: ['休息', '散步', '读书'], ji: ['熬夜'], ji_shen: [], xiong_sha: [],
      chong_sheng_xiao: '', lunar_year_cn: '示例', lunar_month_cn: '示例',
      lunar_day_cn: '示例', year_gan_zhi: '示例',
    }
  } else if (path.endsWith('/oasis/analyze') && method === 'POST') {
    data = { report_id: 1, status: 'completed' }
  } else {
    throw new Error('此功能未包含在离线界面体验版中')
  }
  return { code: 200, message: 'ok', data }
}
