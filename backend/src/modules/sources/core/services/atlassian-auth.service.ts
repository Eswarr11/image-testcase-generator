/**
 * Atlassian Cloud auth helpers.
 * Supports classic site tokens and scoped tokens (api.atlassian.com gateway).
 */

const UPSTREAM_TIMEOUT_MS = 30_000;

export interface AtlassianAuth {
  siteUrl: string;
  email: string;
  token: string;
}

export interface AtlassianResolvedAuth extends AtlassianAuth {
  /** Base for Confluence REST, e.g. https://site.atlassian.net/wiki or gateway */
  confluenceBase: string;
  /** Base for Jira REST, e.g. https://site.atlassian.net or gateway */
  jiraBase: string;
  mode: 'classic' | 'scoped';
  cloudId?: string;
}

export async function fetchWithTimeout(
  url: string,
  init: {
    headers?: Record<string, string>
    method?: string
    body?: string
  } = {},
  timeoutMs = UPSTREAM_TIMEOUT_MS
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Strip paths like /wiki, trailing slashes, and accidental quotes from site URL. */
export function normalizeSiteUrl(raw: string): string {
  let value = raw.trim().replace(/^["']|["']$/g, '');
  try {
    const url = new URL(value);
    // Keep only origin: https://xxx.atlassian.net
    value = url.origin;
  } catch {
    value = value.replace(/\/+$/, '').replace(/\/wiki(\/.*)?$/i, '');
  }
  return value.replace(/\/+$/, '');
}

/** Clean pasted API tokens (newlines, zero-width chars, accidental Bearer prefix). */
export function normalizeApiToken(raw: string): string {
  return raw
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '');
}

export function basicAuthHeader(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}:${token}`, 'utf8').toString('base64')}`;
}

export function authHeaders(email: string, token: string): Record<string, string> {
  return {
    Authorization: basicAuthHeader(email, token),
    Accept: 'application/json',
  };
}

async function readErrorSnippet(res: globalThis.Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const json = JSON.parse(text) as { message?: string; errorMessages?: string[] };
      if (json.message) return json.message;
      if (json.errorMessages?.length) return json.errorMessages.join('; ');
    } catch {
      // plain text
    }
    return text.slice(0, 200);
  } catch {
    return '';
  }
}

export async function fetchCloudId(siteUrl: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${siteUrl}/_edge/tenant_info`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { cloudId?: string };
    return data.cloudId || null;
  } catch {
    return null;
  }
}

interface ProbeResult {
  ok: boolean;
  status: number;
  displayName?: string;
  snippet: string;
  url: string;
}

async function probe(url: string, email: string, token: string): Promise<ProbeResult> {
  const res = await fetchWithTimeout(url, { headers: authHeaders(email, token) });
  if (res.ok) {
    const data = await res.json() as { displayName?: string; publicName?: string };
    const displayName = data.displayName || data.publicName;
    return {
      ok: true,
      status: res.status,
      ...(displayName ? { displayName } : {}),
      snippet: '',
      url,
    };
  }
  return {
    ok: false,
    status: res.status,
    snippet: await readErrorSnippet(res),
    url,
  };
}

/**
 * Resolve working Atlassian API bases for this credential set.
 * Tries classic site URLs first, then scoped gateway if classic returns 401.
 */
export async function resolveAtlassianAuth(
  auth: AtlassianAuth
): Promise<{ resolved: AtlassianResolvedAuth; displayName?: string } | { error: string }> {
  const siteUrl = normalizeSiteUrl(auth.siteUrl);
  const email = auth.email.trim();
  const token = normalizeApiToken(auth.token);

  if (!siteUrl.startsWith('https://')) {
    return { error: 'Site URL must start with https:// (e.g. https://your-site.atlassian.net)' };
  }

  const classicJiraMyself = `${siteUrl}/rest/api/3/myself`;
  const classicConfUser = `${siteUrl}/wiki/rest/api/user/current`;

  // Prefer Jira myself — most reliable for API tokens
  const jiraClassic = await probe(classicJiraMyself, email, token);
  if (jiraClassic.ok) {
    // Also confirm Confluence if possible (optional)
    return {
      resolved: {
        siteUrl,
        email,
        token,
        jiraBase: siteUrl,
        confluenceBase: `${siteUrl}/wiki`,
        mode: 'classic',
      },
      ...(jiraClassic.displayName ? { displayName: jiraClassic.displayName } : {}),
    };
  }

  const confClassic = await probe(classicConfUser, email, token);
  if (confClassic.ok) {
    return {
      resolved: {
        siteUrl,
        email,
        token,
        jiraBase: siteUrl,
        confluenceBase: `${siteUrl}/wiki`,
        mode: 'classic',
      },
      ...(confClassic.displayName ? { displayName: confClassic.displayName } : {}),
    };
  }

  // Scoped token path: need cloudId + api.atlassian.com
  if (jiraClassic.status === 401 || confClassic.status === 401) {
    const cloudId = await fetchCloudId(siteUrl);
    if (cloudId) {
      const scopedJira = await probe(
        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`,
        email,
        token
      );
      if (scopedJira.ok) {
        return {
          resolved: {
            siteUrl,
            email,
            token,
            cloudId,
            jiraBase: `https://api.atlassian.com/ex/jira/${cloudId}`,
            confluenceBase: `https://api.atlassian.com/ex/confluence/${cloudId}/wiki`,
            mode: 'scoped',
          },
          ...(scopedJira.displayName ? { displayName: scopedJira.displayName } : {}),
        };
      }

      const scopedConf = await probe(
        `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api/user/current`,
        email,
        token
      );
      if (scopedConf.ok) {
        return {
          resolved: {
            siteUrl,
            email,
            token,
            cloudId,
            jiraBase: `https://api.atlassian.com/ex/jira/${cloudId}`,
            confluenceBase: `https://api.atlassian.com/ex/confluence/${cloudId}/wiki`,
            mode: 'scoped',
          },
          ...(scopedConf.displayName ? { displayName: scopedConf.displayName } : {}),
        };
      }

      return {
        error:
          `Atlassian returned 401 for both site and scoped gateway (cloudId ${cloudId}). ` +
          `Jira site=${jiraClassic.status}${jiraClassic.snippet ? ` (${jiraClassic.snippet})` : ''}; ` +
          `scoped=${scopedJira.status}${scopedJira.snippet ? ` (${scopedJira.snippet})` : ''}. ` +
          'Use the Atlassian account email (not username), create a Classic API token ' +
          '(or a scoped token with Confluence read scopes), and ensure the site URL is https://your-site.atlassian.net only.',
      };
    }
  }

  return {
    error:
      `Atlassian credentials were rejected. ` +
      `Jira ${jiraClassic.status}${jiraClassic.snippet ? `: ${jiraClassic.snippet}` : ''}; ` +
      `Confluence ${confClassic.status}${confClassic.snippet ? `: ${confClassic.snippet}` : ''}. ` +
      'Check: (1) email is your Atlassian login email, (2) API token is Classic (not expired), ' +
      '(3) site URL is exactly https://your-site.atlassian.net with no /wiki path.',
  };
}

export async function atlassianGet(
  resolved: AtlassianResolvedAuth,
  kind: 'jira' | 'confluence',
  path: string
): Promise<globalThis.Response> {
  const base = kind === 'jira' ? resolved.jiraBase : resolved.confluenceBase;
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return fetchWithTimeout(url, { headers: authHeaders(resolved.email, resolved.token) });
}
