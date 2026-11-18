// electron-builder afterPack hook: prune locales and drop app.asar.unpacked
// to shrink the final package.

const fs = require('node:fs')
const path = require('node:path')

const KEEP_PAK = new Set(['en-US.pak', 'en.pak'])
const KEEP_LPROJ = new Set(['en.lproj', 'en_US.lproj', 'Base.lproj'])

function pruneDir(dir, keep) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir)) {
    if (!keep(entry)) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true })
    }
  }
}

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context
  const isMac = electronPlatformName === 'darwin' || electronPlatformName === 'mas'
  const productName = packager.appInfo.productFilename

  let resourcesDir
  if (isMac) {
    const appPath = path.join(appOutDir, `${productName}.app`)
    resourcesDir = path.join(appPath, 'Contents/Resources')
    // Strip non-English .lproj bundles (Electron Framework + app bundle).
    pruneDir(resourcesDir, (n) => !n.endsWith('.lproj') || KEEP_LPROJ.has(n))
    pruneDir(
      path.join(
        appPath,
        'Contents/Frameworks/Electron Framework.framework/Versions/A/Resources'
      ),
      (n) => !n.endsWith('.lproj') || KEEP_LPROJ.has(n)
    )
    // Do NOT delete ffmpeg.dll / libffmpeg.dylib: Chromium loads it at renderer
    // startup and the renderer crashes without it (verified on Windows).
  } else {
    resourcesDir = path.join(appOutDir, 'resources')
    pruneDir(path.join(appOutDir, 'locales'), (n) => KEEP_PAK.has(n))
  }

  // Drop app.asar.unpacked — we don't ship native modules that need it.
  const unpacked = path.join(resourcesDir, 'app.asar.unpacked')
  if (fs.existsSync(unpacked)) {
    fs.rmSync(unpacked, { recursive: true, force: true })
  }
}
