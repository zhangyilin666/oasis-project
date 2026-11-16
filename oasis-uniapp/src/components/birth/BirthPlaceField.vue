<template>
 <view class="birth-place-field">
  <view class="place-mode"><AppButton :class="{ selected: !manual }" :aria-pressed="!manual" :aria-label="labelPrefix + '选择国内地区'" @click="setManual(false)">选择地区</AppButton><AppButton :class="{ selected: manual }" :aria-pressed="manual" :aria-label="labelPrefix + '手动填写地区'" @click="setManual(true)">海外／手动填写</AppButton></view>
  <view v-if="!manual" class="place-fields"><BirthSelect :model-value="province" :options="provinces" :label="labelPrefix + '省份或地区'" placeholder="选择省份／地区" :invalid="invalid" @update:model-value="changeProvince" /><BirthSelect :model-value="city" :options="cities" :label="labelPrefix + '城市'" placeholder="选择城市" :disabled="!province" :invalid="invalid" @update:model-value="changeCity" /><BirthSelect v-if="districts.length" :model-value="district" :options="districts" :label="labelPrefix + '区县'" placeholder="区／县（选填）" :disabled="!city" @update:model-value="changeDistrict" /></view>
  <view v-else>
   <!-- #ifndef MP-WEIXIN -->
   <input v-input-label="labelPrefix + '地点'" :value="modelValue" class="manual-place" :aria-label="labelPrefix + '地点'" :aria-invalid="invalid || undefined" maxlength="60" placeholder="例如：英国 · 伦敦" @input="manualInput" />
   <!-- #endif -->
   <!-- #ifdef MP-WEIXIN -->
   <input :value="modelValue" class="manual-place" :aria-label="labelPrefix + '地点'" :aria-invalid="invalid || undefined" maxlength="60" placeholder="例如：英国 · 伦敦" @input="manualInput" />
   <!-- #endif -->
  </view>
  <text class="place-hint">{{ manual ? '填写出生城市即可，不必写详细住址。' : '先选省份，再选城市；区县可不填。' }}</text>
  <AppButton class="source-toggle" :aria-expanded="showSources" @click="showSources = !showSources">地区数据说明 {{ showSources ? '−' : '＋' }}</AppButton>
  <view v-if="showSources" class="source-note"><text>地区名称来自 Vant（MIT）；城市参考坐标来自 GeoNames（CC BY 4.0）。坐标按城市中心近似，区县选择只细化名称，不代表具体出生地址。</text><AppButton class="source-toggle" @click="openSources">查看来源与许可 ↗</AppButton></view>
 </view>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import BirthSelect from './BirthSelect.vue'
import { getBirthProvinces, getBirthCities, getBirthDistricts, resolveBirthPlace } from '@/domain/birth-input/places'
type SelectedPlace = { name: string; latitude?: number; longitude?: number; timeZone?: string; coordinateLabel?: string }
const props = withDefaults(defineProps<{ modelValue: string; labelPrefix?: string; invalid?: boolean }>(), { labelPrefix: '出生' })
const emit = defineEmits<{ 'update:modelValue': [value: string]; select: [value: SelectedPlace | null] }>()
const manual = ref(false), province = ref(''), city = ref(''), district = ref(''), showSources = ref(false)
const provinces = getBirthProvinces(), cities = computed(() => getBirthCities(province.value)), districts = computed(() => getBirthDistricts(city.value))
let lastEmitted: string | undefined
watch(() => props.modelValue, value => { if (value !== lastEmitted) restore(value); lastEmitted = undefined }, { immediate: true })
function restore(value: string) {
 province.value = ''; city.value = ''; district.value = ''; manual.value = !!value
 if (!value) return
 // Restore our own saved names without emitting selection metadata over an
 // archive's deliberately edited coordinates or historical timezone.
 for (const region of provinces) for (const candidate of getBirthCities(region.value)) {
  const base = resolveBirthPlace(region.value, candidate.value)
  if (!base || !value.startsWith(base.name)) continue
  const county = value === base.name ? '' : getBirthDistricts(candidate.value).find(option => resolveBirthPlace(region.value, candidate.value, option.value)?.name === value)?.value
  if (county === undefined) continue
  province.value = region.value; city.value = candidate.value; district.value = county; manual.value = false; return
 }
}
function update(value: string, selection: SelectedPlace | null) { lastEmitted = value; emit('update:modelValue', value); emit('select', selection) }
function setManual(value: boolean) { if (manual.value === value) return; manual.value = value; province.value = ''; city.value = ''; district.value = ''; update('', null) }
function publishSelection() { const place = resolveBirthPlace(province.value, city.value, district.value || undefined); update(place?.name || '', place) }
function changeProvince(value: string) { province.value = value; city.value = ''; district.value = ''; update('', null) }
function changeCity(value: string) { city.value = value; district.value = ''; publishSelection() }
function changeDistrict(value: string) { district.value = value; publishSelection() }
function manualInput(event: unknown) { const value = (event as { detail: { value: string } }).detail.value; if (typeof value === 'string') update(value, null) }
function openSources() {
 // #ifdef H5
 window.open('/static/data-licenses/birth-places.txt', '_blank', 'noopener,noreferrer')
 // #endif
 // #ifndef H5
 uni.setClipboardData({ data: '地区： https://github.com/youzan/vant/tree/main/packages/vant-area-data (MIT)\n坐标： https://www.geonames.org/ (CC BY 4.0)\n许可： https://creativecommons.org/licenses/by/4.0/' })
 // #endif
}
</script>
<style scoped>
.birth-place-field{min-width:0;width:100%;}.place-mode{display:flex;gap:4px;padding:4px;background:#f1ebf6;border-radius:12px;margin-bottom:10px;}.place-mode>button{flex:1;min-width:0;min-height:44px;padding:8px 3px;background:transparent;color:#8c7799;border-radius:9px;font-size:12px;line-height:1.7;white-space:normal;}.place-mode>button.selected{background:#fff;color:#705384;box-shadow:0 2px 7px #7053840d;}.place-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;}.place-fields>:last-child:nth-child(3){grid-column:1/-1;}.manual-place{box-sizing:border-box;width:100%;min-width:0;height:48px;padding:0 12px;border:1px solid #e6dced;border-radius:12px;background:#faf7fc;color:#614c71;font-size:14px;}.place-hint{display:block;margin-top:8px;color:#8d7c97;font-size:11px;line-height:1.8;}
.source-toggle{display:block;min-height:44px;width:100%;padding:8px 0;text-align:left;background:transparent;color:#95859e;font-size:10px;line-height:1.8;}.source-note{display:block;color:#8d7c97;font-size:11px;line-height:1.9;}
</style>
