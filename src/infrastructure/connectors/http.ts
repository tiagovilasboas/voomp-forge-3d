import type { ConnectorContext } from '@application/ports/connectors';

/** Injected HTTP GET returning parsed JSON. Tests pass a fake; production uses `defaultFetchJson`. */
export type FetchJson = (url: string, headers: Record<string, string>) => Promise<unknown>;

export const defaultFetchJson: FetchJson = async (url, headers) => {
  // redirect:'error' — never forward the Authorization header to another origin.
  const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, redirect: 'error' });
  // Never include headers (credentials) in errors.
  if (!res.ok) throw new Error(`Falha ao consultar ${new URL(url).origin}${new URL(url).pathname}: HTTP ${res.status}`);
  return res.json();
};

/** Basic auth header from two secrets; throws a clear error naming (not revealing) what is missing. */
export function basicAuthHeaders(ctx: ConnectorContext, userSecret: string, tokenSecret: string, fallback?: [string, string]): Record<string, string> {
  const user = ctx.secret(userSecret) ?? (fallback ? ctx.secret(fallback[0]) : undefined);
  const token = ctx.secret(tokenSecret) ?? (fallback ? ctx.secret(fallback[1]) : undefined);
  if (!user || !token) throw new Error(`Defina as variáveis ${userSecret} e ${tokenSecret}.`);
  return { Authorization: `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}` };
}

export const trimSlash = (url: string) => url.replace(/\/+$/, '');

/** Hard cap on pages per paginated query: a hostile or buggy server cannot keep the loop alive forever. */
export const MAX_PAGES = 1000;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * Authenticated connectors send credentials to `baseUrl`: require https (http only for localhost mocks)
 * and no userinfo. Messages never echo the URL, so a secret embedded in it cannot leak.
 */
export function assertSafeBaseUrl(connector: string, baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`${connector}: "baseUrl" não é uma URL válida.`);
  }
  if (url.username || url.password) throw new Error(`${connector}: "baseUrl" não pode conter usuário/senha; use variáveis de ambiente.`);
  const localHttp = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) {
    throw new Error(`${connector}: "baseUrl" deve usar https:// (http só é aceito em localhost/127.0.0.1).`);
  }
}
