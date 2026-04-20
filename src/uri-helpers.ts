/**
 * URI utility functions for file:// URIs used by AHP's resourceList.
 */

/** Strip `file://` prefix for human-readable display. */
export function uriToDisplayPath(uri: string): string {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.slice(7)) || '/';
  }
  return uri;
}

/** Convert a filesystem path to a file:// URI. */
export function pathToUri(path: string): string {
  return `file://${encodeURI(path)}`;
}

/** Navigate to the parent directory of a file:// URI. */
export function parentUri(uri: string): string {
  const path = uriToDisplayPath(uri);
  if (path === '/') return uri;
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return pathToUri('/' + parts.join('/'));
}

/** Navigate into a child entry of a file:// URI. */
export function childUri(uri: string, name: string): string {
  const path = uriToDisplayPath(uri);
  const joined = path.endsWith('/') ? path + name : path + '/' + name;
  return pathToUri(joined);
}
