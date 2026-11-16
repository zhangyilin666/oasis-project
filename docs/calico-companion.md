# 猫来运转 · 三花小先生

采用用户确认的三花猫、蓝布衣、柔紫与奶白界面方向。常态圆眼温柔，点击互动时偶尔眯眼偷藏鱼干。图案固定为左杏右灰的头部花纹、白色鼻梁、一立一折的耳朵与三花尾巴。

软件品牌名为「猫来运转」。应用名称、首页、账号、协议、后端展示名和安装说明保持一致。应用图标由已确认的小猫素材与新品牌文字组合，运行 `node scripts/generate-icons.mjs --app-only` 可单独重建，保留现有导航图标。

## 素材与组件

- 运行素材：`oasis-uniapp/src/static/ui/cat-calico-sprite.webp`，1536 × 1024，透明 alpha，247,016 字节（约 241 KiB）。
- 来源：内置 imagegen，根据本任务已确认的六表情样例编辑生成；随后用 sharp 编码为 WebP，保留透明通道，未手工重绘角色。
- 展示组件：`oasis-uniapp/src/components/CatCompanion.vue`。3 列 × 2 行，每格 512 × 512；通过容器裁切原图，整套表情只请求一个本地文件。
- 默认 160 × 160；`small` 为 72 × 72；首页按屏宽使用 148 或 124 像素。每个姿势提供对应的无障碍描述。

| mood | 位置 | 使用场景 |
| --- | --- | --- |
| welcome | 第一行第一格 | 首页欢迎 |
| thinking | 第一行第二格 | 今日内容加载、报告等待/首次加载 |
| playful | 第一行第三格 | 首页点击彩蛋 |
| complete | 第二行第一格 | 完成的报告封面 |
| comfort | 第二行第二格 | 表单、空状态、错误、报告末尾 |
| resting | 第二行第三格 | 个人页 |

首页回应轮流展示，不请求服务器、不保存用户行为。4.5 秒后自动恢复，离开页面或卸载时清除计时器。减少动态效果时不旋转小猫。其他页面的小猫为静态状态图，不循环晃动，不遮挡报告。

## 验证与边界

- TypeScript 检查和现有 5 项请求/账号回归测试通过。
- H5 生产构建通过。
- 浏览器验证 390px 首页、320px 首页和报告详情无横向溢出；点击和 Enter 可切换回应，离开页面恢复默认状态。
- 用隔离本地示例 API 检查等待、完成、失败、空报告页面；没有调用付费模型或修改真实报告。真实后端本轮未运行。
- 微信小程序构建被既有的 `v-input-label` 自定义指令阻塞（出生资料页）；本轮交付验证范围为 H5，未做微信或 iOS/Android 真机验收。

## 草木小先生（第二角色）

橘白虎斑、淡青布衣、药钵、草药与小药囊，作为三花小先生的搭档。中医草本元素用于角色造型，首页和个人页只展示吃饭、休息等日常关怀文案。

- 素材：`oasis-uniapp/src/static/ui/cat-herbal.webp`，1254 × 1254，透明 alpha，163,984 字节（约 160 KiB）。
- 来源：内置 imagegen，以已有三花形象为画风参考生成，随后编码为 WebP。
- 复用 `CatCompanion`，传入 `character="herbal"`；默认仍是三花猫，已有六种表情继续使用。新角色当前为一张静态图片。
- 首页关怀卡显示 96px，个人页显示 72px。

生成提示词：

```text
Use case: stylized-concept. Design ONE new companion kitten for the Chinese app 猫来运转, matching the supplied existing calico mascot sheet in illustration style, proportions and warmth. The supplied image is ONLY a style and character-family reference, not an edit target. Create a DISTINCT second character with traditional Chinese herbal medicine elements, adorable and comforting, a gentle little herbal apprentice. Single full-body seated kitten centered on a square 1024x1024 canvas, genuinely TRANSPARENT alpha background, no text, no title, no borders, no checkerboard, no gradients or floor shadows behind the subject. Light apricot ginger TABBY kitten with creamy muzzle belly and paws, three simple soft cinnamon forehead stripes, both little ears upright, large round warm brown eyes, tiny pink nose, kind closed-mouth smile, pink cheeks, compact round head, very short round body and a curled striped tail. Wear soft muted SAGE-GREEN traditional Chinese cotton cloth tunic, cream crossover collar and sleeve trim, two simple cloth frog fastenings. One tiny pale medicinal-leaf embroidery on lower hem. Sit with a small pale celadon ceramic herb mortar in its lap, one CAT paw gently holding the short wooden pestle, other cat paw holding a small bunch of broad fresh herb leaves. A little beige drawstring herbal sachet attached at the waist, clear but secondary. Traditional Chinese herbal-apothecary identity readable through green cloth tunic, medicinal herbs and mortar; no doctor white coat, no red cross, no stethoscope, no needles, no written prescription. Clean rounded dark purple-brown outlines, large simple flat pastel color shapes, only a few fur tufts, very minimal soft shading, no photorealistic fur or cloth grain. Same visual family as the original blue-robed calico cat, but green-robed ginger tabby must be clearly a DIFFERENT kitten, not a recolor of the calico. Full silhouette including tail, paws, herb leaves and ears fully inside frame with at least 80px transparent margin on every side, large enough for 88-160px mobile UI use. Exactly one character, no duplicate poses, no extra props, no lettering, no watermark. Warm, trustworthy, slightly curious personality.
```

## 三花小先生素材生成提示词

内置 imagegen 编辑模式，以本任务用户确认的六表情图为参考，最终提示词如下：

```text
Use case: precise-object-edit. Convert the approved six-pose Xiaoyi calico cat sheet in the supplied reference into a production TRANSPARENT PNG SPRITE SHEET for app UI. Preserve the exact lovable character design, all six poses in the same order, head markings, indigo blue Chinese tunic, cream paws, pink cheeks and dark purple outline. Remove ALL text, labels, title, background, floor shadows and purple decorations. Actual transparent alpha background, NOT a white background or checkerboard pattern. A 3-column by 2-row regular grid on a 1536 x 1024 landscape canvas, six exactly square equal 512 x 512 invisible cells. No visible cell lines. Center each entire character WITH all props within its own cell, leave clear transparent padding at least 36px on every side of every cell. Characters should take approximately 82 percent of their cell width/height, all with same head size except sleeping pose naturally horizontal. Top left: welcoming waving cat. Top center: thinking cat reading a small purple book with one paw at cheek. Top right: mischievous half-lidded eyes hiding a little dried fish in its sleeve. Bottom left: delighted smiling cat holding finished paper scroll with purple bow. Bottom center: comforting cat gently extending paw. Bottom right: peaceful sleeping curled up cat. Only these six isolated characters. No text at all, no shadows outside silhouettes, no sparks, no Z letters. Simplify excessive fur strands and paper grain to clean flat pastel fills, retain soft subtle shading and smooth clear outline for 72px to 180px use in mobile interface. Most important: truly transparent background and absolutely no content crossing each fixed equal grid cell boundary. This sprite sheet will be displayed through CSS cropping in the app, so exact equal cell placement is essential.
```
