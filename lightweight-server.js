const http = require('http');
const fs = require('fs');
const path = require('path');

// Lazy-load Prisma only when API is called
let prisma = null;
async function getDB() {
  if (!prisma) {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
  }
  return prisma;
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webp': 'image/webp'
};

const NEXT_STATIC = '/home/z/my-project/.next/static';
const NEXT_SERVER = '/home/z/my-project/.next/server';
const PUBLIC = '/home/z/my-project/public';

http.createServer(async (req, res) => {
  try {
    // API: /api/wedding/public
    if (req.url.startsWith('/api/wedding/public') || req.url === '/api/wedding/public?') {
      const db = await getDB();
      const wedding = await db.weddingAccount.findFirst({
        where: { status: 'ACTIVE' },
        include: {
          features: { where: { isEnabled: true } },
          schedules: { orderBy: { sortOrder: 'asc' } },
          faqs: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
          stories: { orderBy: { sortOrder: 'asc' } },
          media: { orderBy: { sortOrder: 'asc' }, take: 50 },
          content: true,
          contacts: { take: 20, orderBy: { createdAt: 'desc' } },
        }
      });
      if (!wedding) { res.writeHead(404); res.end(JSON.stringify({error:"Wedding not found"})); return; }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ wedding }));
      return;
    }

    // API: /api/site-settings
    if (req.url.startsWith('/api/site-settings') || req.url === '/api/site-settings?') {
      const db = await getDB();
      const features = await db.weddingFeature.findMany({
        where: { isEnabled: true },
        orderBy: { featureKey: 'asc' }
      });
      const sectionMap = {
        'home': { id: 'home', label: 'Home', section: 'home', enabled: true },
        'schedule': { id: 'schedule', label: 'Schedule', section: 'schedule' },
        'rsvp': { id: 'rsvp', label: 'RSVP', section: 'rsvp' },
        'getting-there': { id: 'getting-there', label: 'Getting There', section: 'getting-there' },
        'story': { id: 'story', label: 'Our Story', section: 'story' },
        'wishes': { id: 'wishes', label: 'Wishes', section: 'wishes' },
        'qa': { id: 'qa', label: 'FAQ', section: 'qa' },
        'moments': { id: 'moments', label: 'Moments', section: 'moments' },
        'gallery': { id: 'gallery', label: 'Gallery', section: 'gallery' },
        'countdown': { id: 'countdown', label: 'Countdown', section: 'countdown' },
        'music': { id: 'music', label: 'Music', section: 'music' },
      };
      const navTabs = features
        .filter(f => sectionMap[f.featureKey])
        .map(f => ({ ...sectionMap[f.featureKey], enabled: true }));
      // Always include home first
      if (!navTabs.find(t => t.id === 'home')) navTabs.unshift(sectionMap.home);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ navTabs }));
      return;
    }

    // API: /api/auth/session (return empty session for guest)
    if (req.url.startsWith('/api/auth/session')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({}));
      return;
    }

    // API: /api/wishes (GET)
    if (req.url.startsWith('/api/wishes') || req.url === '/api/wishes?') {
      const db = await getDB();
      const wedding = await db.weddingAccount.findFirst({ where: { status: 'ACTIVE' } });
      const wishes = wedding ? await db.wish.findMany({
        where: { weddingId: wedding.id },
        orderBy: { createdAt: 'desc' },
        take: 50
      }) : [];
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ wishes }));
      return;
    }

    // API: /api/notifications (return empty)
    if (req.url.startsWith('/api/notifications')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ notifications: [] }));
      return;
    }

    // Static files
    let filePath;
    if (req.url === '/' || req.url === '') {
      filePath = path.join(NEXT_SERVER, 'app/index.html');
    } else if (req.url.startsWith('/_next/static/')) {
      filePath = path.join(NEXT_STATIC, req.url.slice('/_next/static/'.length));
    } else if (req.url.startsWith('/_next/')) {
      filePath = path.join(NEXT_SERVER, req.url);
    } else {
      filePath = path.join(PUBLIC, req.url);
    }

    const ext = path.extname(filePath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found: ' + req.url);
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
      res.end(data);
    });
  } catch (err) {
    console.error('Error:', err);
    res.writeHead(500);
    res.end('Internal error');
  }
}).listen(3000, '0.0.0.0', () => console.log('Lightweight server on 3000'));
