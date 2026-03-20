import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';

const STORAGE_BASE_URL =
  process.env.ARCHIVE_STORAGE_BASE_URL ??
  'https://blackpirateapps.github.io/archive-storage';

type ManifestEntry =
  | string
  | {
      hash: string;
      size?: number;
      content_type?: string;
    };

interface SnapshotManifest {
  version?: string;
  root?: string;
  files?: Record<string, ManifestEntry>;
}

type RouteParams = {
  snapshotId: string;
  path?: string[];
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  const { snapshotId, path: routePath } = await context.params;

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(snapshotId)) {
    return NextResponse.json({ error: 'Invalid snapshot id' }, { status: 400 });
  }

  const requestedPath = normalizeRequestedPath(routePath);
  if (!requestedPath) {
    return NextResponse.json({ error: 'Invalid archive path' }, { status: 400 });
  }

  const manifestUrl = `${STORAGE_BASE_URL}/snapshots/${snapshotId}/manifest.json`;
  const manifestRes = await fetch(manifestUrl, { cache: 'no-store' });
  if (!manifestRes.ok) {
    return NextResponse.json({ error: 'Snapshot manifest not found' }, { status: 404 });
  }

  const manifest = (await manifestRes.json()) as SnapshotManifest;
  if (!manifest.files) {
    return NextResponse.json({ error: 'Snapshot manifest is invalid' }, { status: 500 });
  }

  const manifestPath = resolveManifestPath(manifest, requestedPath);
  const entry = manifest.files[manifestPath];

  if (!entry) {
    return NextResponse.json({ error: 'File not found in snapshot' }, { status: 404 });
  }

  const hash = typeof entry === 'string' ? entry : entry.hash;
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return NextResponse.json({ error: 'Invalid object hash in manifest' }, { status: 500 });
  }

  const objectUrl = `${STORAGE_BASE_URL}/objects/${hash.slice(0, 2)}/${hash}`;
  const objectRes = await fetch(objectUrl, { cache: 'force-cache' });

  if (!objectRes.ok || !objectRes.body) {
    return NextResponse.json({ error: 'Archive object not found' }, { status: 404 });
  }

  const contentType =
    (typeof entry === 'object' && entry.content_type) ||
    mimeFromPath(manifestPath) ||
    objectRes.headers.get('content-type') ||
    'application/octet-stream';

  if (isHtmlContent(contentType, manifestPath)) {
    const html = await objectRes.text();
    const rewritten = rewriteRootRelativeUrls(html, snapshotId);
    return new NextResponse(rewritten, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  }

  return new NextResponse(objectRes.body, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

function normalizeRequestedPath(routePath?: string[]): string | null {
  let decoded: string[];
  try {
    decoded = (routePath ?? []).map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  const raw = decoded.join('/').replace(/\\+/g, '/').replace(/^\/+/, '');
  const withDefault = raw.length > 0 ? raw : 'index.html';
  const withIndex = withDefault.endsWith('/') ? `${withDefault}index.html` : withDefault;
  const normalized = path.posix.normalize(withIndex).replace(/^\/+/, '');

  if (normalized === '' || normalized === '.' || normalized === '..') {
    return null;
  }

  if (normalized.startsWith('../') || normalized.includes('/../')) {
    return null;
  }

  return normalized;
}

function resolveManifestPath(manifest: SnapshotManifest, requestedPath: string): string {
  if (!manifest.files) return requestedPath;

  if (manifest.files[requestedPath]) return requestedPath;

  if (!requestedPath.endsWith('.html')) {
    const fallbackHtml = `${requestedPath}.html`;
    if (manifest.files[fallbackHtml]) return fallbackHtml;

    const fallbackIndex = `${requestedPath}/index.html`;
    if (manifest.files[fallbackIndex]) return fallbackIndex;
  }

  if (manifest.root && requestedPath === 'index.html' && manifest.files[manifest.root]) {
    return manifest.root;
  }

  return requestedPath;
}

function rewriteRootRelativeUrls(html: string, snapshotId: string): string {
  const prefix = `/archive/${snapshotId}/`;
  return html.replace(
    /(href|src|action|poster)=(['"])\/(?!\/|archive\/)([^'"#?]*)([^'"]*)\2/g,
    (_match, attr, quote, basePath, rest) => {
      const cleanPath = basePath.replace(/^\/+/, '');
      return `${attr}=${quote}${prefix}${cleanPath}${rest}${quote}`;
    }
  );
}

function isHtmlContent(contentType: string, filePath: string): boolean {
  return contentType.includes('text/html') || filePath.endsWith('.html');
}

function mimeFromPath(filePath: string): string | null {
  const ext = filePath.toLowerCase().split('.').pop();
  if (!ext) return null;

  const map: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pdf: 'application/pdf',
  };

  return map[ext] ?? null;
}
