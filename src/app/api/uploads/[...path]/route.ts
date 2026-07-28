import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getFilePathFromUrl, IS_VOLUME_STORAGE } from '@/lib/file-storage';

/**
 * GET /api/uploads/[...path]
 *
 * Serves uploaded files from the persistent volume mount on Railway.
 * Locally, files are in public/uploads/ and served directly by Next.js,
 * so this route is only used when IS_VOLUME_STORAGE is true.
 *
 * This route handles URLs like:
 *   /api/uploads/weddings/{weddingId}/{category}/{filename}
 *
 * But the stored URLs are like:
 *   /uploads/weddings/{weddingId}/{category}/{filename}
 *
 * So we reconstruct the full URL from the path segments and look up the file.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  // If we're not using volume storage, this route shouldn't handle requests
  // (files are served from public/ directly). Return 404.
  if (!IS_VOLUME_STORAGE) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { path: pathSegments } = await params;
  // Reconstruct the URL path: /uploads/weddings/{weddingId}/{category}/{filename}
  const urlPath = '/uploads/weddings/' + pathSegments.join('/');
  const filePath = getFilePathFromUrl(urlPath);

  if (!filePath) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Security: ensure the resolved path is within the uploads root
  // (prevent directory traversal attacks)
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH || ''))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const data = await fs.readFile(resolvedPath);

    // Determine content type from file extension
    const ext = path.extname(resolvedPath).toLowerCase();
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
    const contentType = contentTypes[ext] || 'application/octet-stream';

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
