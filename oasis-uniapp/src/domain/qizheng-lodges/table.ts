/** Original numerical transcription of the inspected Lixiang Kaocheng table XIV figures. */
export const LODGE_TABLE_VERSION = 'lixiang-kaocheng-1684-ecliptic-table-v1' as const
export const LODGE_BASE_YEAR = 1684
export const LODGE_ANNUAL_SHIFT_ARCSECONDS = 51
export const CIRCLE_ARCSECONDS = 360 * 3600
export const LODGE_TABLE_SOURCE = 'https://www.shidianguji.com/book/SK1530/chapter/1la1v7gbjjbjm'
/** [name, palace 0–11 from winter solstice, degree, minute, original table figure]. */
const TRANSCRIPTION = [
  ['斗', 0, 5, 50, '02415'], ['牛', 0, 29, 37, '02416'], ['女', 1, 7, 23, '02416'], ['虚', 1, 19, 1, '02416'],
  ['危', 1, 29, 0, '02417'], ['室', 2, 19, 7, '02417'], ['壁', 3, 4, 48, '02418'], ['奎', 3, 17, 54, '02418'],
  ['娄', 3, 29, 33, '02418'], ['胃', 4, 12, 33, '02419'], ['昴', 4, 24, 48, '02419'], ['毕', 5, 4, 3, '02419'],
  ['参', 5, 18, 1, '02420'], ['觜', 5, 19, 22, '02420'], ['井', 6, 0, 55, '02421'], ['鬼', 7, 1, 20, '02421'],
  ['柳', 7, 5, 56, '02422'], ['星', 7, 22, 56, '02422'], ['张', 8, 1, 19, '02422'], ['翼', 8, 19, 23, '02423'],
  ['轸', 9, 6, 23, '02423'], ['角', 9, 19, 26, '02423'], ['亢', 10, 0, 3, '02423'], ['氐', 10, 10, 41, '02424'],
  ['房', 10, 28, 31, '02424'], ['心', 11, 3, 21, '02425'], ['尾', 11, 10, 54, '02425'], ['箕', 11, 26, 50, '02425'],
] as const
export const LODGE_BASE_TABLE = Object.freeze(TRANSCRIPTION.map(([name, palace, degree, minute, figure]) => Object.freeze({ name, referenceStar: `${name}宿一`, palace, degree, minute, second: 0, startArcseconds: (palace * 30 + degree) * 3600 + minute * 60, figure: `SK1530_figure_${figure}` })))
