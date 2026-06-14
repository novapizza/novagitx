// GitHub OAuth App configuration.
//
// Device Flow requires a registered OAuth App's client_id. There is NO client
// secret for Device Flow, so this is safe to ship in the binary.
//
// SETUP (one-time, by a maintainer):
//   1. github.com → Settings → Developer settings → OAuth Apps → New OAuth App
//   2. Enable "Device Flow" on the app.
//   3. Put the resulting Client ID below, or set GITHUB_CLIENT_ID at build time.
//
// Until a real client_id is set, the sign-in flow will fail with a clear error.
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? 'Ov23liaJ2UquPLj4UABk'

export const GITHUB_SCOPES = ['repo', 'read:org', 'workflow'].join(' ')

export const DEVICE_CODE_URL = 'https://github.com/login/device/code'
export const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'
