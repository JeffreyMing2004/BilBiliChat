import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const nodeProcess = globalThis.process

function fail(message) {
  throw new Error(message)
}

function readJsonFromEnv(name) {
  const raw = nodeProcess.env[name]
  if (!raw) {
    fail(`Missing required env: ${name}`)
  }

  return JSON.parse(raw)
}

async function readJsonInput(name, fileEnvName) {
  const filePath = nodeProcess.env[fileEnvName]
  if (filePath) {
    return JSON.parse(await readFile(path.resolve(filePath), 'utf8'))
  }

  return readJsonFromEnv(name)
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function pickAsset(assets, matcher) {
  return assets.find((asset) => matcher(asset.name))
}

function createPlatformEntry(asset, signatureAsset) {
  if (!asset || !signatureAsset) {
    return null
  }

  return {
    url: asset.browser_download_url,
    signature: signatureAsset.content.trim(),
  }
}

function inferTargetKey(assetName, fallback) {
  const normalized = assetName.toLowerCase()

  if (normalized.includes('aarch64') || normalized.includes('arm64')) {
    return [fallback.replace('x86_64', 'aarch64')]
  }

  if (normalized.includes('universal')) {
    return [
      fallback.replace('x86_64', 'x86_64'),
      fallback.replace('x86_64', 'aarch64'),
    ]
  }

  return [fallback]
}

async function main() {
  const release = await readJsonInput('RELEASE_JSON', 'RELEASE_JSON_PATH')
  const assets = await readJsonInput('RELEASE_ASSETS_JSON', 'RELEASE_ASSETS_JSON_PATH')
  const version = nodeProcess.env.RELEASE_VERSION || release.tag_name.replace(/^v/, '')
  const outputDir = path.resolve(nodeProcess.env.RELEASE_OUTPUT_DIR || 'dist/release-assets')
  const channel = nodeProcess.env.RELEASE_CHANNEL || (version.includes('beta') ? 'beta' : 'stable')

  const signatureAssets = assets.filter((asset) => asset.name.endsWith('.sig'))
  const signatureContents = await Promise.all(signatureAssets.map(async (asset) => {
    const content = await readFile(asset.local_path, 'utf8')
    return [asset.name, content]
  }))
  const signatures = new Map(signatureContents)

  const macArchive = pickAsset(assets, (name) => name.endsWith('.app.tar.gz'))
  const macSignature = macArchive ? signatures.get(`${macArchive.name}.sig`) : null
  const windowsInstaller = pickAsset(assets, (name) => name.endsWith('-setup.exe'))
  const windowsSignature = windowsInstaller ? signatures.get(`${windowsInstaller.name}.sig`) : null
  const windowsMsi = pickAsset(assets, (name) => name.endsWith('.msi'))
  const windowsMsiSignature = windowsMsi ? signatures.get(`${windowsMsi.name}.sig`) : null

  const platforms = Object.fromEntries([
    ...((macArchive && macSignature)
      ? inferTargetKey(macArchive.name, 'darwin-x86_64').map((target) => [
        target,
        createPlatformEntry(macArchive, { content: macSignature }),
      ])
      : []),
    ...((windowsInstaller && windowsSignature)
      ? inferTargetKey(windowsInstaller.name, 'windows-x86_64').map((target) => [
        target,
        createPlatformEntry(windowsInstaller, { content: windowsSignature }),
      ])
      : []),
    ...((windowsMsi && windowsMsiSignature)
      ? inferTargetKey(windowsMsi.name, 'windows-x86_64').map((target) => [
        `${target}-msi`,
        createPlatformEntry(windowsMsi, { content: windowsMsiSignature }),
      ])
      : []),
  ])

  const latest = {
    version,
    notes: release.body || '',
    pub_date: release.published_at || new Date().toISOString(),
    platforms,
  }

  const checksums = {}
  for (const asset of assets) {
    if (asset.local_path) {
      const buffer = await readFile(asset.local_path)
      checksums[asset.name] = {
        sha256: sha256(buffer),
        size: buffer.byteLength,
        downloadUrl: asset.browser_download_url,
      }
    }
  }

  await mkdir(outputDir, { recursive: true })
  await writeFile(path.join(outputDir, 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`)
  await writeFile(path.join(outputDir, `${channel}.latest.json`), `${JSON.stringify(latest, null, 2)}\n`)
  await writeFile(
    path.join(outputDir, 'checksums.json'),
    `${JSON.stringify({
      version,
      channel,
      generatedAt: new Date().toISOString(),
      releaseName: release.name,
      releaseTag: release.tag_name,
      assets: checksums,
    }, null, 2)}\n`,
  )
}

await main()
