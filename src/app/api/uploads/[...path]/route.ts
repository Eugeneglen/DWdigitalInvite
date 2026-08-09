import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getFilePathFromUrl, IS_VOLUME_STORAGE } from '@/lib/file-storage';

const LOCAL_UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');

/**
 * GET /api/uploads/[...path]
 *
 * Serves uploaded files. Works for both volume storage (Railway) and local public/ storage.
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
    return new NextResponse('Not found', { status: 404 });
  }

  const resolvedPath = path.resolve(filePath);
  const allowedRoot = path.resolve(IS_VOLUME_STORAGE ? (process.env.RAILWAY_VOLUME_MOUNT_PATH || '') : LOCAL_UPLOADS_ROOT);
  if (!resolvedPath.startsWith(allowedRoot + path.sep) && resolvedPath !== allowedRoot) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    let data: Buffer;
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
      } else {
        throw new Error('not found');
      }
    }

    const finalExt = path.extname(resolvedPath).toLowerCase();
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

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('File not found', { status: 404 });
  }
}
