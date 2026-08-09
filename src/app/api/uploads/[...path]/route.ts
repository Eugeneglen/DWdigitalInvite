import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getFilePathFromUrl, IS_VOLUME_STORAGE } from '@/lib/file-storage';

const LOCAL_UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');

/** 1×1 transparent PNG — returned instead of 404 so browsers cache the
 *  "missing" response and stop hammering the network on every page load. */
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
  'Nl7BcQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * GET /api/uploads/[...path]
 *
 * Serves uploaded files. Works for both volume storage (Railway) and local public/ storage.
 *
 * IMPORTANT: When a file is not found, returns 200 with a 1×1 transparent PNG
 * (with a short cache header) instead of 404. This prevents browsers from
 * retrying broken URLs on every navigation/remount, which was causing a
 * persistent 404 storm in network logs for images lost after Railway deploys.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments } = await params;

  let filePath: string;

  if (IS_VOLUME_STORAGE) {
    const urlPath = '/uploads/weddings/' + pathSegments.join('/');
    filePath = getFilePathFromUrl(urlPath) || '';
  } else {
    filePath = path.join(LOCAL_UPLOADS_ROOT, ...pathSegments);
  }

  if (!filePath) {
    return transparentResponse();
  }

  const resolvedPath = path.resolve(filePath);
  const allowedRoot = path.resolve(IS_VOLUME_STORAGE ? (process.env.RAILWAY_VOLUME_MOUNT_PATH || '') : LOCAL_UPLOADS_ROOT);
  if (!resolvedPath.startsWith(allowedRoot + path.sep) && resolvedPath !== allowedRoot) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    let data: Buffer;
    let servedPath = resolvedPath;
    try {
      data = await fs.readFile(resolvedPath);
    } catch {
      // Fallback: handle double extensions from legacy uploads
      // e.g. "hero-image.png.png" → try "hero-image.png"
      const ext = path.extname(resolvedPath).toLowerCase();
      const secondExt = path.extname(resolvedPath.slice(0, -ext.length)).toLowerCase();
      if (secondExt && secondExt === ext) {
        const fallbackPath = resolvedPath.slice(0, -ext.length);
        data = await fs.readFile(fallbackPath);
        servedPath = fallbackPath;
      } else {
        return transparentResponse();
      }
    }

    const finalExt = path.extname(servedPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/m4a',
    };
    const contentType = contentTypes[finalExt] || 'application/octet-stream';

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return transparentResponse();
  }
}

/** Return a cached transparent 1×1 PNG instead of 404. */
function transparentResponse(): NextResponse {
  return new NextResponse(new Uint8Array(TRANSPARENT_PNG), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=86400',
    },
  });
}
