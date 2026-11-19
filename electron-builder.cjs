// Publish targets. electron-builder uploads to every provider that supports it
// (s3 does, generic does not) and embeds the list in app-update.yml for the
// auto-updater to read. We upload via the R2 S3 endpoint (needs AWS_* creds) but
// have the shipped app DOWNLOAD updates from a public, credential-free URL — so
// the bucket must be publicly readable and R2_RELEASES_PUBLIC_URL must point at it
// (e.g. a custom domain or the bucket's pub-*.r2.dev URL). The generic entry is
// listed first so the updater prefers the public URL over the S3 endpoint.
const publish = [
  {
    provider: 's3',
    bucket: process.env.R2_RELEASES_BUCKET,
    endpoint: `https://${process.env.R2_RELEASES_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
    acl: null,
  },
]
if (process.env.R2_RELEASES_PUBLIC_URL) {
  publish.unshift({ provider: 'generic', url: process.env.R2_RELEASES_PUBLIC_URL })
}

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.novagitx.app',
  productName: 'NovaGitX',
  asar: true,
  compression: 'maximum',
  afterPack: 'scripts/afterPack.cjs',
  afterSign: 'scripts/notarize.cjs',

  // electron-vite bundles main, preload and renderer into out/, so nothing in
  // node_modules is needed at runtime (main/preload import only Node builtins +
  // electron). Ship only the bundle, the runtime icon, and package.json — this
  // keeps the entire source tree, docs, configs and ~80 MB of redundant
  // node_modules out of app.asar.
  files: [
    'out/**',
    'resources/**',
    'package.json',
    '!node_modules/**',
    '!**/*.map',
  ],

  mac: {
    electronLanguages: ['en', 'en_US'],
    category: 'public.app-category.developer-tools',
    icon: 'build/icon.icns',
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    gatekeeperAssess: false,
    artifactName: '${productName}-${version}-${arch}-mac.${ext}',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    extendInfo: {
      NSServices: [
        {
          NSMenuItem: { default: 'Open in NovaGitX' },
          NSMessage: 'openFile',
          NSPortName: 'NovaGitX',
          NSRequiredContext: { NSTextContent: 'FilePath' },
          NSSendTypes: ['NSFilenamesPboardType', 'public.file-url'],
        },
      ],
    },
  },

  dmg: {
    icon: 'build/icon.icns',
    iconSize: 100,
    contents: [
      { x: 130, y: 220, type: 'file' },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
    window: { width: 540, height: 380 },
  },

  win: {
    icon: 'build/icon.ico',
    artifactName: '${productName}-${version}-${arch}-win.${ext}',
    target: [{ target: 'nsis', arch: ['x64', 'arm64'] }],
    // Authenticode signing. Stays inert (unsigned build, no error) until a cert is
    // supplied via env — set CSC_LINK (path/base64 of a .pfx) and
    // CSC_KEY_PASSWORD in CI to produce signed EXEs and avoid SmartScreen
    // warnings. An EV cert gives instant reputation. electron-builder reads
    // CSC_LINK / CSC_KEY_PASSWORD itself (path, URL or base64), so the cert is
    // not repeated here — certificateFile expects a path and would break on a
    // base64 value.
    signtoolOptions: process.env.CSC_LINK
      ? {
          signingHashAlgorithms: ['sha256'],
          rfc3161TimeStampServer: 'http://timestamp.digicert.com',
        }
      : undefined,
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    include: 'build/installer.nsh',
  },

  linux: {
    icon: 'build/icons',
    category: 'Development',
    target: ['AppImage', 'deb'],
  },

  publish,

  directories: {
    output: 'dist',
    buildResources: 'build',
  },
}
