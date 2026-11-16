// Regenerate after changing any chart engine dependency; output is bundled as a static asset.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const packages = ['lunar-typescript', 'iztro', 'astronomy-engine', 'lunar-lite', 'dayjs', 'i18next', '@babel/runtime']
const sections = ['Third-party notices for 猫来运转 · 五术探索\nGenerated from the installed packages and the versioned name-data license.\n']
for (const name of packages) {
  const directory = path.join(root, 'node_modules', name)
  const metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
  let license
  if (name === 'astronomy-engine') {
    // Its npm distribution embeds the full MIT license in the source header.
    const source = await readFile(path.join(directory, 'astronomy.js'), 'utf8')
    license = source.slice(0, source.indexOf('*/') + 2)
    if (!license.includes('MIT License') || !license.includes('THE SOFTWARE IS PROVIDED')) throw new Error('Astronomy Engine license header missing')
  } else {
    license = await readFile(path.join(directory, 'LICENSE'), 'utf8')
  }
  sections.push(`${name} ${metadata.version}\n${'='.repeat(60)}\n${license.trim()}\n`)
}
const unicodeLicense = await readFile(path.join(root, 'src', 'static', 'licenses', 'UNICODE-LICENSE.txt'), 'utf8')
sections.push(`Unicode Unihan 17.0.0 subset (116 characters)\nSource: https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip\n${'='.repeat(60)}\n${unicodeLicense.trim()}\n`)
const output = path.join(root, 'src', 'static', 'licenses', 'metaphysics.txt')
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, sections.join('\n'), 'utf8')
console.log('Generated src/static/licenses/metaphysics.txt')
