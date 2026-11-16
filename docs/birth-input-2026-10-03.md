# 出生信息输入改进（2026-10-03）

本次将出生日期、公历／农历转换、时间及出生地区选择整理为可复用输入组件；页面继续保存公历日期及已有出生信息字段。已完成六页集成、移动端验收及生产发布。

## 输入与数据边界

- 日期逻辑使用项目已有的 `lunar-typescript`：公历与农历双向转换；闰月为独立选项并明确标注“闰”；缺项、无效日期及换月后失效的日期均报错，不自动补全或截断。最终公历日期下限为 `1900-01-01`，上限由页面传入当日本地日期；1900 年初对应的农历 1899 年可参与转换。见 [日期逻辑](../oasis-uniapp/src/domain/birth-input/date.ts)。
- 地区支持省、市及可选区县；直辖市名称去除相邻重复。海外地点、历史地名或精确出生位置保留手动录入路径。解析器验证选项类型、编码和上下级关系，错误组合返回空结果。见 [地区解析器](../oasis-uniapp/src/domain/birth-input/places.ts)。
- 地区表含 **34 个省级分组、369 个市级分组、3478 个县区条目**，包括香港、澳门、台湾及源表的直辖县、开发区等选择项；不是逐项审定的历史行政区划。
- 其中 **246 个城市**提供 GeoNames 的 WGS84 城市行政中心地名参考点，另 **123 个市级分组不自动填入坐标**。自动坐标始终标注“城市中心（近似）”；选择区县仅细化地点名称，不改变坐标精度。缺失或歧义不使用省会、邻市或区县中心代替。
- 大陆默认 `Asia/Shanghai`（北京时间），香港、澳门、台湾分别默认 `Asia/Hong_Kong`、`Asia/Macau`、`Asia/Taipei`。地区选择不能确定历史出生记录采用的时钟，用户仍需按实际记录核对时区与经纬度。

## 来源与许可

名称提取自 [@vant/area-data 2.2.0](https://registry.npmjs.org/@vant/area-data/-/area-data-2.2.0.tgz)，按 MIT 许可保留原版权声明。城市参考点提取自 [GeoNames cities15000](https://download.geonames.org/export/dump/cities15000.zip) 的 2026-10-03 快照，遵循 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。只纳入行政中心类型的居住地记录，以精确中文名称／别名匹配，并核对地区、省级归属及大陆非直辖市的地级编码；多个候选或不符合条件时不纳入。未作坐标系转换。

[来源清单](../oasis-uniapp/src/domain/birth-input/data/provenance.json) 保存下载地址、快照时间、源文件及生成文件 SHA-256、筛选规则和未纳入条目；[城市坐标表](../oasis-uniapp/src/domain/birth-input/data/city-centers.json) 保留每个点的 GeoNames ID 与源记录信息。名称 JSON 为 86,792 字节、坐标 JSON 为 57,433 字节，两者 gzip 合计约 36 KB。

[公开中文说明](../oasis-uniapp/src/static/data-licenses/birth-places.txt)、[原 MIT 许可](../oasis-uniapp/src/static/data-licenses/vant-area-data-MIT.txt)、[GeoNames 格式和许可声明](../oasis-uniapp/src/static/data-licenses/geonames-readme.txt)、[CC BY 4.0 全文](../oasis-uniapp/src/static/data-licenses/CC-BY-4.0-legalcode.txt) 及 [英文署名](../oasis-uniapp/src/static/data-licenses/birth-place-attribution.txt) 均置于 `src/static/data-licenses/`，供 H5 和小程序随静态资源分发。

## 已完成验证

`node --test tests/birth-input-places.test.mjs`：**8 项通过**。覆盖已知省市区、北京及杭州独立坐标样例、区县不提高精度、缺失坐标不猜测、港澳台与新疆的时区默认值、错误类型／编码／上下级关系、返回值隔离、数据哈希及原始许可文件。见 [地区专项测试](../oasis-uniapp/tests/birth-input-places.test.mjs)。地区相关文件的 `git diff --check` 通过。

另有日期工具及既有时区／档案、西占、印度占星、七政回归 **92 项通过**（其中新日期工具 7 项），合计 **100 项**相关测试通过。最终 `npm run typecheck`、正式 H5 构建与微信小程序构建均通过；两份产物均包含五份地区数据署名和许可文件。构建仍有原有 Sass legacy-js-api 弃用提示，没有新增构建错误。

## 页面与交互验收

覆盖八字 AI 解读、三盘同参、八字紫微运限、印度占星、西方占星（含 A/B 两份资料）和七政天文对照。出生日期与时间各自占整行；普通填写使用年月日、小时分钟和省市区选项，时区和手动经纬度可在高级设置调整。七政采样与运限观察日期保留 2099 年上限；观察日期使用公历。

使用正式 H5 产物及隔离的真实 API 验收，未使用真实 AI 服务、未消耗线上 AI 次数。浏览器验证包括：

- 390 和 320 像素手机宽度下，无页面横向溢出；320 像素下也能分别选择年、月、日。
- 公历 `2000-02-29` 切换农历后仍对应同一日期；改为 2001 年时清除失效的 29 日，保留年与月，要求重新选日。
- 农历 2025 年闰六月初一转换为公历 `2025-07-25`；闰月在选项中单列。
- 午夜 `00:00` 与年月日、省市区一起写入草稿，刷新后仍完整回填。省市区以结构化选择回填，旧版任意地点文本仍可手动显示；回填不自动覆盖保存的坐标和时区。
- 杭州自动填入 `Asia/Shanghai` 和 WGS84 城市参考点 `30.29365, 120.16142`；界面注明城市中心近似。三盘计算成功并在隔离环境保存；印度占星、西占、运限和七政都能读取同一档案，西占与七政生成结果成功。
- 印度占星从杭州改为手动海外地点后清除旧坐标与时区；未重新填写时区时，计算显示需要补充时区的错误，不沿用旧值。西占 A/B 控件分别标注，A 的回填不填入 B。

## 生产发布

2026-10-03 发布 `h5-birth-input-20261003-140751`，128 个静态文件。部署前备份原站点、配置及数据库，随后发布静态文件并最后替换入口；后端、数据库及网关容器的 ID、镜像和启动时间均未改变。

- [服务器发布回执](verification/h5-birth-input-20261003-140751-server.json)：健康检查通过，容器状态保持一致。
- [公网逐文件校验](verification/h5-birth-input-20261003-140751-public.json)：128 个文件的 SHA-256、大小和缓存头一致；正常 TLS 校验通过；匿名访问个人信息、报告与问卦记录均返回 401。
- [线上手机表单截图](verification/birth-input-production-mobile-20261003.png)：正式网站 390 像素视口，截图中的出生资料仅为界面验收示例，没有提交或保存。

回滚备份位于服务器 `/root/oasis-backups/h5-birth-input-20261003-140751`。本次没有数据库迁移或账号变更。
