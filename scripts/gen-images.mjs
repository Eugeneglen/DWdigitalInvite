import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const DIR = './public/wedding-images';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const images = [
  { name: 'ceremony-venue.png', prompt: 'Elegant wedding ceremony venue interior, white flower arch with greenery, rows of chairs, soft natural light through windows, romantic and serene atmosphere, professional event photography', size: '1344x768' },
  { name: 'celebration-venue.png', prompt: 'Beautiful wedding reception venue, elegantly decorated tables with candles and flowers, warm fairy lights, champagne glasses, festive romantic celebration atmosphere, professional event photography', size: '1344x768' },
  { name: 'story-hero.png', prompt: 'Romantic couple silhouette against golden sunset sky, dreamy warm atmosphere, wide panoramic composition, cinematic color grading, elegant and timeless, high quality photography', size: '1344x768' },
  { name: 'milestone-early-years.png', prompt: 'Vintage photograph style, two children playing together in a sunlit garden, warm nostalgic tones, candid childhood memory, soft film grain, tender moment, photography', size: '1024x1024' },
  { name: 'milestone-college.png', prompt: 'Young couple in university graduation gowns, campus building background, bright daylight, joyful celebration, professional portrait photography, candid happy moment', size: '1024x1024' },
  { name: 'milestone-summer.png', prompt: 'Young couple at a sunny beach, golden hour light, waves in background, casual summer clothing, candid joyful laughter, warm tones, lifestyle photography', size: '1024x1024' },
  { name: 'milestone-began.png', prompt: 'Romantic couple at an outdoor cafe at dusk, candlelit table, first date moment, warm intimate atmosphere, soft bokeh city lights in background, candid photography', size: '1024x1024' },
  { name: 'milestone-academic.png', prompt: 'Couple celebrating together with diplomas, modern university campus, confetti, bright joyful daylight, achievement moment, professional candid photography', size: '1024x1024' },
  { name: 'milestone-adventure.png', prompt: 'Couple hiking together on a mountain trail, panoramic scenic view, backpacks, golden hour sunlight, adventure and togetherness, landscape photography with people', size: '1024x1024' },
  { name: 'milestone-social.png', prompt: 'Group of diverse friends laughing together at a dinner party, warm indoor lighting, clinking glasses, happy social gathering, candid group photography', size: '1024x1024' },
  { name: 'timeline-proposal.png', prompt: 'Romantic marriage proposal moment, person kneeling with ring box, candlelit path, evening garden setting, dreamy soft lighting, emotional intimate atmosphere, cinematic photography', size: '1344x768' },
  { name: 'timeline-wedding.png', prompt: 'Beautiful wedding ceremony moment, couple exchanging vows under floral arch, emotional, soft natural light, guests blurred in background, cinematic wedding photography', size: '1344x768' },
  { name: 'gallery-1.png', prompt: 'Candid photo of couple laughing together at a restaurant, warm ambient lighting, genuine happiness, lifestyle photography, intimate moment', size: '1024x1024' },
  { name: 'gallery-2.png', prompt: 'Couple walking hand in hand through autumn park, golden leaves falling, warm sunlight filtering through trees, romantic stroll, nature photography', size: '1024x1024' },
  { name: 'gallery-3.png', prompt: 'Couple cooking together in modern kitchen, flour on hands, laughing, warm domestic scene, candid lifestyle photography, natural window light', size: '1024x1024' },
  { name: 'gallery-4.png', prompt: 'Beautiful couple portrait at scenic overlook, mountain landscape behind, golden hour backlight, wind in hair, romantic adventure photography', size: '1024x1024' },
  { name: 'gallery-5.png', prompt: 'Couple at a night market, colorful lanterns, trying street food together, vibrant street scene, candid joyful moment, night photography', size: '1024x1024' },
  { name: 'gallery-6.png', prompt: 'Couple relaxing on a picnic blanket in a field of wildflowers, lazy afternoon, soft dappled sunlight, serene romantic moment, lifestyle photography', size: '1024x1024' },
  { name: 'gallery-7.png', prompt: 'Elegant couple at a formal event, woman in beautiful evening gown, man in suit, clinking champagne glasses, celebration, professional portrait photography', size: '1024x1024' },
];

const zai = await ZAI.create();
let ok = 0, skip = 0, fail = 0;

for (let i = 0; i < images.length; i++) {
  const img = images[i];
  const p = path.join(DIR, img.name);
  
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) {
    console.log(`[${i+1}/${images.length}] SKIP: ${img.name}`);
    skip++; continue;
  }

  // Rate limit: wait 15s between requests
  if (i > 0) {
    console.log(`  ...waiting 15s for rate limit...`);
    await new Promise(r => setTimeout(r, 15000));
  }

  try {
    const r = await zai.images.generations.create({ prompt: img.prompt, size: img.size });
    fs.writeFileSync(p, Buffer.from(r.data[0].base64, 'base64'));
    console.log(`[${i+1}/${images.length}] OK: ${img.name} (${(fs.statSync(p).size/1024).toFixed(0)}KB)`);
    ok++;
  } catch (err) {
    console.error(`[${i+1}/${images.length}] FAIL: ${img.name} — ${err.message}`);
    fail++;
  }
}

console.log(`\nDone: ${ok} generated, ${skip} skipped, ${fail} failed (total: ${images.length})`);
