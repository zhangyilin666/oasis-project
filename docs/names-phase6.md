# 姓名文化 · 字形与出处

2026-10-03。入口：五术探索 → 命 → 姓名文化。规则 `name-culture-v1`，字库 `unihan-17.0.0-subset-v1`，116 字有限子集；页面明确显示覆盖数量，未收录字可以留笔记，不生成资料。

## 数据与许可

- 固定 [Unicode 17.0.0 Unihan.zip](https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip)，源文件 SHA-256 `f7a48b2b545acfaa77b2d607ae28747404ce02baefee16396c5d2d7a8ef34b5e`。
- 保存 `kDefinition` 英文摘要、`kMandarin` 常用普通话原值、`kTotalStrokes` 原值、简繁候选码位；读法/笔画可能含多个值，不自行选定。
- 属性定义固定 [UAX #38 rev.39](https://www.unicode.org/reports/tr38/tr38-39.html)，不引用会变化的最新版属性说明作为版本依据。
- Unicode License V3 全文随产品附带：`oasis-uniapp/src/static/licenses/UNICODE-LICENSE.txt`，并纳入通用 `metaphysics.txt`。未引入额外字体。
- 可复现生成器 `scripts/build-name-data.py --archive <原始ZIP>`；测试参考文本直接从官方 ZIP 提取，与运行时 JSON 分离。

## 输入、记录与边界

逐字保留简繁和 Unicode 码位；不切分复姓，不自动替换异体字，不赋予分隔符笔画。不将字库总笔画等同康熙笔画或姓名数理，不推断姓名所有者的人格或命运。人名读音由用户单独确认。

姓名限制 40 个 Unicode 字符，确认读音 120 字符，笔记 2000 字符；非法标量、控制字符、空白或纯分隔符拒绝。罕用字缺设备字体时仍显示码位，字库字段缺失与整个词条未收录分别说明。

独立本机键 `oasis.name-culture.records.v1`，最多 50 条不可变快照。查询或编辑不自动保存，原样回看不重新查字库。版本不支持、数据损坏或存储失败时保留原始存储并显示错误；无账号或后端写入。

## 验收

- 9 项领域测试：官方原始字段、简繁/多值、补充平面、未收录/分隔符、输入边界、隔离快照、容量、损坏/版本/存储错误与导出。
- H5 实际界面：输入 `歐陽明·𠮷龘`，保留原字与码位、缺字段不补造；保存 → 刷新 → 原样回看成功。另查 `林清和·A`，A 明确未收录。
- 320px 窗口正文宽度/滚动宽度均 305px，无横向溢出；390px 截图见 `phase6-names-mobile.jpg`。
- 生产序列化数据实际 UTF-8 落盘后逐字节与 JSON 字段读回一致，见 `verification/exports/name-culture-records.json` 和清单。此证据不等同浏览器下载或手机真机验收。

整批编译、设备与其他模块状态见持续交付清单。
