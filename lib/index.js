/**
 * dsh-deepseek-balance — host half.
 *
 * Resolves the DEEPSEEK_API_KEY credential, queries the official
 * DeepSeek /user/balance endpoint through curl (the web seam cannot carry
 * an Authorization header), and exposes the result as a JSON route on the
 * DSH web server for the client half to poll.
 */

export const name = 'dsh-deepseek-balance'

const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const CURL_FALLBACK_WINDOWS = 'C:\\Windows\\System32\\curl.exe'

/** One balance query. Never throws; always returns a JSON-safe envelope. */
async function queryBalance(ctx) {
  const credentials = ctx.get('credentials')
  const subprocess = ctx.get('subprocess')
  if (!credentials || !subprocess) {
    return { ok: false, error: 'credentials/subprocess 服务不可用' }
  }

  let cred
  try {
    cred = await credentials.resolve('DEEPSEEK_API_KEY')
  } catch (e) {
    cred = undefined
  }
  if (!cred || !cred.value) {
    return { ok: false, error: '未配置 DEEPSEEK_API_KEY（写入 ~/.dsh/.credentials.yaml 或环境变量）' }
  }

  let curlPath = 'curl'
  try {
    curlPath = await subprocess.resolveExecutable('curl')
  } catch (e) {
    try {
      curlPath = await subprocess.resolveExecutable(CURL_FALLBACK_WINDOWS)
    } catch (e2) {
      return { ok: false, error: '无法定位 curl 可执行文件' }
    }
  }

  const policy = ctx.get('sandboxPolicy')
  const cwd = policy && typeof policy.workspaceRoot === 'string' && policy.workspaceRoot
    ? policy.workspaceRoot
    : 'C:\\'

  let handle
  try {
    handle = subprocess.spawn({
      argv: [
        curlPath,
        '-s', '-L', '--max-time', '15',
        '-X', 'GET', BALANCE_URL,
        '-H', 'Accept: application/json',
        '-H', 'Authorization: Bearer ' + cred.value,
      ],
      cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 65536 },
        stderr: { maxBytes: 8192 },
      },
      graceMs: 2000,
    })
    const outcome = await handle.done
    const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0) : { text: '' }
    const err = handle.collected.stderr ? handle.collected.stderr.readFrom(0) : { text: '' }
    if (outcome.exitCode !== 0) {
      const detail = err.text ? err.text.trim().slice(0, 300) : ''
      return { ok: false, error: 'curl 退出码 ' + outcome.exitCode + (detail ? '：' + detail : '') }
    }
    const parsed = JSON.parse(out.text)
    let model = 'deepseek-v4-flash'
    try {
      const defaultModel = ctx.get('agentDefaultModel')
      if (defaultModel && typeof defaultModel.currentSelection === 'function') {
        const selection = defaultModel.currentSelection()
        if (selection && typeof selection.model === 'string' && selection.model) {
          model = selection.model
        }
      }
    } catch (e) { /* model is best-effort */ }
    return { ok: true, data: parsed, model, at: Date.now() }
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) }
  }
}

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/deepseek-balance',
    handler: async (req, res) => {
      const result = await queryBalance(ctx)
      const body = JSON.stringify(result)
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end(body)
    },
  }))
}
