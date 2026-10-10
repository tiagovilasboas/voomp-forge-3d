import type { ConnectorContext } from '@application/ports/connectors';

/** Injected HTTP GET returning parsed JSON. Tests pass a fake; production uses `defaultFetchJson`. */
export type FetchJson = (url: string, headers: Record<string, string>) => Promise<unknown>;

export const defaultFetchJson: FetchJson = async (url, headers) => {
  const res = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
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
