import areaData from './data/china-areas.json'
import cityCenterData from './data/city-centers.json'

export interface BirthPlaceOption {
  value: string
  label: string
}

export interface ResolvedBirthPlace {
  name: string
  latitude?: number
  longitude?: number
  timeZone?: string
  coordinateLabel?: string
}

interface CityCenter {
  latitude: number
  longitude: number
}

const provinces: Readonly<Record<string, string>> = areaData.province_list
const cities: Readonly<Record<string, string>> = areaData.city_list
const districts: Readonly<Record<string, string>> = areaData.county_list
const cityCenters: Readonly<Record<string, CityCenter>> = cityCenterData
const codeIsValid = (value: unknown): value is string => typeof value === 'string' && /^\d{6}$/.test(value)
const owns = (values: Readonly<Record<string, unknown>>, code: unknown): code is string => codeIsValid(code) && Object.prototype.hasOwnProperty.call(values, code)

function options(values: Readonly<Record<string, string>>, prefix?: string): BirthPlaceOption[] {
  return Object.entries(values)
    .filter(([code]) => prefix === undefined || code.startsWith(prefix))
    .map(([value, label]) => ({ value, label }))
}

/** Current selectable names; the data is an address aid, not a historical boundary database. */
export function getBirthProvinces(): BirthPlaceOption[] {
  return options(provinces)
}

export function getBirthCities(provinceCode: string): BirthPlaceOption[] {
  return owns(provinces, provinceCode) ? options(cities, provinceCode.slice(0, 2)) : []
}

export function getBirthDistricts(cityCode: string): BirthPlaceOption[] {
  return owns(cities, cityCode) ? options(districts, cityCode.slice(0, 4)) : []
}

/**
 * A district refines the display name only. Coordinates, when available, are
 * the verified GeoNames city reference point and never a district centroid.
 * Mainland defaults to Beijing clock time; a place does not establish which
 * local clock the birth record used. Existing manual timezone input remains.
 */
export function resolveBirthPlace(
  provinceCode: string,
  cityCode: string,
  districtCode?: string,
): ResolvedBirthPlace | null {
  if (!owns(provinces, provinceCode) || !owns(cities, cityCode) || !cityCode.startsWith(provinceCode.slice(0, 2))) return null
  const hasDistrict = districtCode !== undefined && districtCode !== ''
  if (hasDistrict && (!owns(districts, districtCode) || !districtCode.startsWith(cityCode.slice(0, 4)))) return null

  const names = [provinces[provinceCode], cities[cityCode]]
  if (hasDistrict) names.push(districts[districtCode!])
  const name = names.filter((part, index) => index === 0 || part !== names[index - 1]).join('')
  const prefix = provinceCode.slice(0, 2)
  const timeZone = prefix === '71' ? 'Asia/Taipei'
    : prefix === '81' ? 'Asia/Hong_Kong'
      : prefix === '82' ? 'Asia/Macau' : 'Asia/Shanghai'
  const center = cityCenters[cityCode]
  return {
    name,
    timeZone,
    ...(center ? {
      latitude: center.latitude,
      longitude: center.longitude,
      coordinateLabel: `${cities[cityCode]}中心（近似）`,
    } : {}),
  }
}
