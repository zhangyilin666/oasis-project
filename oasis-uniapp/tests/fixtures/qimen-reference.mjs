// Written before implementation. Published cells are transcribed; boundary cells
// were hand-derived from HKO calendar + public-domain rules, never engine output.
// Palace order is numeric 1..9. Fields: earth, heaven, star, gate, god, earthGuest, heavenGuest.
export const qimenReferences = [
  {
    id: 'published-yang-one', date: '2024-01-01', time: '12:00:00',
    source: 'https://www.askqimen.com/zh-CN/knowledge/qimen-dunjia-charting-steps',
    sourceType: 'published-full-chart', term: '冬至', dun: 'yang', ju: 1, yuan: '上元', day: '甲子', hour: '庚午', chief: '天蓬', chiefPalace: 3, gate: '休门', gatePalace: 7,
    cells: [
      ['戊','丁','天柱','伤门','九地','',''], ['己','辛','天辅','开门','六合','壬',''],
      ['庚','戊','天蓬','景门','值符','',''], ['辛','丙','天任','死门','腾蛇','',''],
      ['壬','','','','','',''], ['癸','己','天芮、天禽','生门','玄武','','壬'],
      ['丁','乙','天英','休门','白虎','',''], ['丙','癸','天心','杜门','九天','',''],
      ['乙','庚','天冲','惊门','太阴','',''],
    ],
  },
  {
    id: 'published-yin-center-chief', date: '2004-11-19', time: '09:58:00',
    source: 'https://xuanlinyi.com/article_detail?id=299569',
    sourceType: 'published-full-chart', term: '立冬', dun: 'yin', ju: 9, yuan: '中元', day: '壬寅', hour: '乙巳', chief: '天禽', chiefPalace: 1, gate: '死门', gatePalace: 4,
    cells: [
      ['乙','丙','天芮、天禽','伤门','值符','','壬'], ['丙','丁','天冲','开门','六合','壬',''],
      ['丁','辛','天心','景门','九地','',''], ['癸','乙','天蓬','死门','玄武','',''],
      ['壬','','','','','',''], ['辛','戊','天英','生门','腾蛇','',''],
      ['庚','癸','天辅','休门','太阴','',''], ['己','庚','天柱','杜门','九天','',''],
      ['戊','己','天任','惊门','白虎','',''],
    ],
  },
  {
    id: 'hko-solstice-before-manual', date: '2024-06-21', time: '04:50:00',
    source: 'https://www.hko.gov.hk/tc/gts/astron2024/files/HKO_almanac_2024.pdf',
    sourceType: 'external-calendar-and-manual-rule-derivation', term: '芒种', dun: 'yang', ju: 3, yuan: '中元', day: '丙辰', hour: '庚寅', chief: '天禽', chiefPalace: 2, gate: '死门', gatePalace: 2,
    cells: [
      ['丙','丙','天蓬','休门','六合','',''], ['乙','乙','天芮、天禽','死门','值符','庚','庚'],
      ['戊','戊','天冲','伤门','玄武','',''], ['己','己','天辅','杜门','九地','',''],
      ['庚','','','','','',''], ['辛','辛','天心','开门','太阴','',''],
      ['壬','壬','天柱','惊门','腾蛇','',''], ['癸','癸','天任','生门','白虎','',''],
      ['丁','丁','天英','景门','九天','',''],
    ],
  },
  {
    id: 'hko-solstice-after-manual', date: '2024-06-21', time: '04:52:00',
    source: 'https://www.hko.gov.hk/tc/gts/astron2024/files/HKO_almanac_2024.pdf',
    sourceType: 'external-calendar-and-manual-rule-derivation', term: '夏至', dun: 'yin', ju: 3, yuan: '中元', day: '丙辰', hour: '庚寅', chief: '天蓬', chiefPalace: 1, gate: '休门', gatePalace: 4,
    cells: [
      ['庚','庚','天蓬','死门','值符','',''], ['己','己','天芮、天禽','伤门','六合','丙','丙'],
      ['戊','戊','天冲','开门','九地','',''], ['乙','乙','天辅','休门','玄武','',''],
      ['丙','','','','','',''], ['丁','丁','天心','景门','腾蛇','',''],
      ['癸','癸','天柱','杜门','太阴','',''], ['壬','壬','天任','惊门','九天','',''],
      ['辛','辛','天英','生门','白虎','',''],
    ],
  },
]
