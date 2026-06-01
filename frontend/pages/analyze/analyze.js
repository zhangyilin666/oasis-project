// 八字分析页 — 出生信息表单 → 提交 → 跳转报告详情
const oasisService = require('../../services/oasis.service')
const ui = require('../../utils/ui')

Page({
  data: {
    form: {
      name: '',
      birth_date: '',
      birth_time: '',
      gender: '',
      location: '',
      is_solar_time: true
    },
    errors: {},
    genders: ['男', '女'],
    genderIndex: -1,
    today: ''  // picker 日期上限（在 onLoad 中计算）
  },

  onLoad() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    this.setData({ today: `${y}-${m}-${d}` })
  },

  // 输入绑定
  onInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`form.${field}`]: e.detail.value,
      [`errors.${field}`]: ''
    })
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      'form.birth_date': e.detail.value,
      'errors.birth_date': ''
    })
  },

  // 时间选择
  onTimeChange(e) {
    this.setData({
      'form.birth_time': e.detail.value,
      'errors.birth_time': ''
    })
  },

  // 性别选择
  onGenderChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      genderIndex: index,
      'form.gender': this.data.genders[index],
      'errors.gender': ''
    })
  },

  // 时间类型切换（公历/农历）
  onSolarToggle() {
    this.setData({ 'form.is_solar_time': !this.data.form.is_solar_time })
  },

  // 表单校验
  validate() {
    const errors = {}
    const f = this.data.form

    if (!f.name.trim()) errors.name = '请输入姓名'
    if (!f.birth_date) errors.birth_date = '请选择出生日期'
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(f.birth_date)) errors.birth_date = '日期格式不正确'
    if (!f.birth_time) errors.birth_time = '请选择出生时间'
    else if (!/^\d{2}:\d{2}$/.test(f.birth_time)) errors.birth_time = '时间格式不正确'
    if (!f.gender) errors.gender = '请选择性别'
    if (!f.location.trim()) errors.location = '请输入出生地点'

    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  // 提交
  async handleSubmit() {
    if (!this.validate()) {
      ui.showToast('请完善表单信息')
      return
    }

    try {
      const result = await oasisService.analyze(this.data.form)
      // 成功后跳转到报告详情页
      wx.redirectTo({
        url: `/pages/report-detail/report-detail?id=${result.report_id}`
      })
    } catch (err) {
      ui.showToast(err.message || '分析失败，请重试')
    }
  }
})
