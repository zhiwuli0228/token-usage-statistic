/**
 * Bounded, credential-safe JSON requests for account endpoints.
 *
 * Account queries leave the Host process, so the transport is deliberately
 * conservative: HTTPS only (plain HTTP is allowed for loopback), no embedded
 * URL credentials, no redirect following, a hard timeout, and a response-size
 * cap. Errors carry a coarse code and never echo a response body, header or
 * credential.
 */

const MAX_BYTES = 1024 * 1024

export class AccountError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AccountError'
    this.code = code
  }
}

export type FetchJson = (url: string, init: RequestInit) => Promise<Response>

export interface FetchJsonOptions {
  headers?: Record<string, string>
  timeoutMs?: number
  maxBytes?: number
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === '::1' || hostname === 'localhost'
}

/** Map an HTTP status onto the shared error vocabulary. */
export function statusCodeFor(status: number): string {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate-limited'
  if (status === 404 || status === 405) return 'unsupported'
  if (status >= 500) return 'unavailable'
  return 'invalid-response'
}

/**
 * Fetch one JSON document.
 *
 * @param url absolute endpoint URL.
 * @param options headers, timeout and body cap.
 * @param fetchImpl injectable fetch for tests.
 */
export async function fetchJson(url: string, options: FetchJsonOptions = {}, fetchImpl: FetchJson = fetch): Promise<unknown> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AccountError('invalid-url', 'account endpoint is not a valid URL')
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new AccountError('invalid-url', 'account endpoint must not embed credentials')
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname))) {
    throw new AccountError('insecure-url', 'account endpoint must use HTTPS')
  }

  let response: Response
  try {
    response = await fetchImpl(parsed.href, {
      method: 'GET',
      headers: { accept: 'application/json', ...(options.headers ?? {}) },
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') throw new AccountError('timeout', 'account endpoint timed out')
    throw new AccountError('network', 'account endpoint is unreachable')
  }

  if (response.status >= 300 && response.status < 400) {
    throw new AccountError('redirect', 'account endpoint redirected; refusing to follow')
  }
  if (!response.ok) {
    throw new AccountError(statusCodeFor(response.status), `account endpoint returned HTTP ${response.status}`)
  }

  const text = await response.text()
  if (text.length > (options.maxBytes ?? MAX_BYTES)) {
    throw new AccountError('too-large', 'account response exceeded the size limit')
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new AccountError('invalid-json', 'account endpoint returned invalid JSON')
  }
}
