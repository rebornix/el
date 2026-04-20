/**
 * URI utility functions for display and directory navigation.
 *
 * Important: navigation must preserve URI scheme/authority.
 * Display conversion must have no side effects on stored URIs.
 */

/** Strip `file://` prefix for human-readable display. */
export function uriToDisplayPath(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  try {
    const url = new URL(uri);
    return decodeURIComponent(url.pathname) || '/';
  } catch {
    return uri;
  }
}

/** Convert a filesystem path to a file:// URI. */
export function pathToUri(path: string): string {
  return `file://${encodeURI(path)}`;
}

function parseSingleSlashUri(uri: string): { scheme: string; path: string } | null {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/(.*)$/.exec(uri);
  if (!m) return null;
  return { scheme: m[1]!, path: `/${m[2] ?? ''}` };
}

/** Navigate to the parent directory of a URI while preserving scheme/authority. */
export function parentUri(uri: string): string {
  if (uri.includes('://')) {
    try {
      const url = new URL(uri);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length === 0) return url.toString();
      segments.pop();
      url.pathname = `/${segments.join('/')}`;
      if (url.pathname === '') url.pathname = '/';
      return url.toString();
    } catch {
      return uri;
    }
  }

  const parsed = parseSingleSlashUri(uri);
  if (!parsed) return uri;
  const segments = parsed.path.split('/').filter(Boolean);
  if (segments.length === 0) return `${parsed.scheme}:/`;
  segments.pop();
  return `${parsed.scheme}:/${segments.join('/')}`;
}

/** Navigate into a child entry of a URI while preserving scheme/authority. */
export function childUri(uri: string, name: string): string {
  if (uri.includes('://')) {
    try {
      const url = new URL(uri);
      const base = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
      url.pathname = `${base}${encodeURIComponent(name)}`;
      return url.toString();
    } catch {
      return uri;
    }
  }

  const parsed = parseSingleSlashUri(uri);
  if (!parsed) return uri;
  const base = parsed.path.endsWith('/') ? parsed.path : `${parsed.path}/`;
  return `${parsed.scheme}:${base}${encodeURIComponent(name)}`;
}
