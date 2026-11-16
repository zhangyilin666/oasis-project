# 独立黄历日期浏览

实现位置：`oasis-uniapp/src/domain/almanac/`、`oasis-uniapp/src/pages/almanac/index.vue`。保留首页服务端今日黄历；独立页计算全部在本机进行。

## 可用范围与口径

- 支持公历 1900-01-01 至 2099-12-31；日期时间按固定 UTC+08:00 解释，不跟随设备时区或历史夏令时。默认 12:00，可选择时分，前一天／今天／后一天直接浏览。
- 农历包含闰月，农历年干支与生肖以春节 00:00 为界。另列以立春交节时刻为界的节气年干支。
- 节令月以十二节的计算交节时刻为界；日干支以 00:00 为界，不在 23:00 提前换日。
- 二十四节气包含节与中气。当前区间为 `[上一交节时刻, 下一交节时刻)`；按日期整天匹配的库接口不用于判定区间。
- 上一／下一交节显示 UTC+8 计算时刻，保留秒位以便复核；秒位不代表秒级准确。未使用写死的年度节气日期表。
- 传统宜忌单独展示，采用 `getDayYi(1)/getDayJi(1)` 的整日口径：十二节所在日 00:00 起按新月干支查表，与瞬时节令月可不同。不把它归为天文事实，不产生个人择日结论。

计算库沿用锁定依赖 `lunar-typescript 1.8.6`（MIT）；结果包含 `schemaVersion: 1`、`ruleVersion: almanac-v1`、引擎版本、原始输入、UTC 瞬时、各项事实、口径及来源。

## 独立来源

- [香港天文台公历与农历对照表](https://www.hko.gov.hk/sc/gts/time/conversion.htm)：独立农历对照；公开表从 1901 年起，不作为本页 1900 年的独立认证。
- [2023 年文字表](https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2023c.txt)、[2024 年文字表](https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2024c.txt)、[2026 年文字表](https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2026c.txt)：春节、闰二月开始与结束、年末月界等 13 个农历样本。
- [香港天文台 2024 年历](https://www.hko.gov.hk/tc/gts/astron2024/files/HKO_almanac_2024.pdf)：二月日历的 6 个日干支样本。
- [香港天文台节气时刻](https://www.hko.gov.hk/sc/gts/astronomy/Solar_Term.htm)及其 [2024 数据](https://www.hko.gov.hk/tc/gts/astronomy/data/files/24SolarTerms_2024.xml)、[2026 数据](https://www.hko.gov.hk/tc/gts/astronomy/data/files/24SolarTerms_2026.xml)：48 个香港时间（UTC+8）交节时刻，参考分辨率为分钟。测试容差为 60 秒，当前最大差值 31 秒；不能据此宣称秒级准确或整个 200 年范围已逐日验证。
- [太阳黄经与节气](https://www.hko.gov.hk/sc/gts/time/24solarterms.htm)、[库干支口径](https://6tail.cn/calendar/lunar.ganzhi.html)、[库节气计算说明](https://6tail.cn/calendar/lunar.jieqi.html)、[库宜忌资料说明](https://6tail.cn/calendar/lunar.yiji.html)。宜忌来自库整理的传统资料，香港天文台参考不为其背书。

远期朔日或交节接近午夜时，不同历表可能在日期上有差异；现阶段采用锁定库并展示来源，不自动混合不同历表。

## 收藏与导出

`createAlmanacRepository(storage)` 提供 `list/save/remove/exportJSON`。独立存储键 `oasis.almanac.snapshots.v1`，最多 20 条，每条保存完整结果与保存时间；历史读取只校验结构和时刻一致性，不调用历法重新演算。页面显示“原样快照”，只有用户点击“按当前规则重新查看”才重新计算。

已收藏项有明确回看入口，删除需确认。异常 JSON、缺失字段、重复 ID、不兼容规则版本、无效时刻区间和非 HTTPS 来源链接均阻止读取及覆盖；存储读写失败和容量上限显示错误，保留旧数据。支持单日 JSON 与全部收藏 JSON；H5 发起下载，其他端复制 JSON 并提示用户自行粘贴保存。

## 验证

`node --test tests/almanac.test.mjs`：14 项通过，覆盖 13 个独立农历样本、6 个独立日干支样本、48 个独立节气时刻，以及：

- 交节前后与精确等时包含关系；立春／春节不同年界；十二节与中气不同月界。
- 23:00 与 00:00 日界、闰月、跨年节气、两端日期范围、闰日导航、UTC+8 今日跨日。
- 无效日期／时间拒绝，以及 UTC、纽约、东京设备时区下完整结果一致。
- 仓储重建后快照原样读回；同毫秒 ID 唯一、20 条容量限制、定点删除、损坏不覆盖、权限与配额失败。

浏览器交互及多宽度截图由集成流程统一验证；本说明不把单元测试视为浏览器验证。
