import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './public/wedding-images';

const images = [
  { name: 'banner-bg.png', prompt: 'Soft warm floral wedding background, delicate white and champagne roses, subtle bokeh lights, cream and gold tones, wide panoramic banner, elegant romantic atmosphere, soft focus, high quality photography', size: '1440x720' },
  { name: 'hero-portrait.png', prompt: 'Elegant Asian couple in modern wedding attire, romantic portrait, soft golden hour natural lighting, gentle smile, blurred garden floral background, cinematic photography, shallow depth of field, high quality', size: '1440x720' },
  { name: 'tea-ceremony.png', prompt: 'Traditional Chinese tea ceremony scene, elegant red and gold tea set on silk cloth, delicate tea cups, warm ambient lighting, soft focus floral decorations, close-up still life photography, cultural elegance', size: '864x1152' },
  { name: 'ceremony-venue.png', prompt: 'Elegant wedding ceremony venue interior, white flower arch with greenery, rows of chairs, soft natural light through windows, romantic and serene atmosphere, professional event photography', size: '1344x768' },
  { name: 'celebration-venue.png', prompt: 'Beautiful wedding reception venue, elegantly decorated tables with candles and flowers, warm fairy lights, champagne glasses, festive romantic celebration atmosphere, professional event photography', size: '1344x768' },
  { name: 'story-hero.png', prompt: 'Romantic couple silhouette against golden sunset sky, dreamy warm atmosphere, wide panoramic composition, cinematic color grading, elegant and timeless, high quality photography', size: '1440x720' },
  { name: 'milestone-early-years.png', prompt: 'Vintage photograph style, two children playing together in a sunlit garden, warm nostalgic tones, candid childhood memory, soft film grain, tender moment, photography', size: '1024x1024' },
  { name: 'milestone-college.png', prompt: 'Young couple in university graduation gowns, campus building background, bright daylight, joyful celebration, professional portrait photography, candid happy moment', size: '1024x1024' },
  { name: 'milestone-summer.png', prompt: 'Young couple at a sunny beach, golden hour light, waves in background, casual summer clothing, candid joyful laughter, warm tones, lifestyle photography', size: '1024x1024' },
  { name: 'milestone-began.png', prompt: 'Romantic couple at an outdoor cafe at dusk, candlelit table, first date moment, warm intimate atmosphere, soft bokeh city lights in background, candid photography', size: '1024x1024' },
  { name: 'milestone-academic.png', prompt: 'Couple celebrating together with diplomas, modern university campus, confetti, bright joyful daylight, achievement moment, professional candid photography', size: '1024x1024' },
  { name: 'milestone-adventure.png', prompt: 'Couple hiking together on a mountain trail, panoramic scenic view, backpacks, golden hour sunlight, adventure and togetherness, landscape photography with people', size: '1024x1024' },
  { name: 'milestone-social.png', prompt: 'Group of diverse friends laughing together at a dinner party, warm indoor lighting, clinking glasses, happy social gathering, candid group photography', size: '1024x1024' },
  { name: 'timeline-proposal.png', prompt: 'Romantic marriage proposal moment, man kneeling with ring box, candlelit path, evening garden setting, dreamy soft lighting, emotional intimate atmosphere, cinematic photography', size: '1344x768' },
  { name: 'timeline-wedding.png', prompt: 'Beautiful wedding ceremony moment, couple exchanging vows under floral arch, emotional, soft natural light, guests blurred in background, cinematic wedding photography', size: '1344x768' },
  { name: 'gallery-1.png', prompt: 'Candid photo of couple laughing together at a restaurant, warm ambient lighting, genuine happiness, lifestyle photography, intimate moment', size: '1024x1024' },
  { name: 'gallery-2.png', prompt: 'Couple walking hand in hand through autumn park, golden leaves falling, warm sunlight filtering through trees, romantic stroll, nature photography', size: '1024x1024' },
  { name: 'gallery-3.png', prompt: 'Couple cooking together in modern kitchen, flour on hands, laughing, warm domestic scene, candid lifestyle photography, natural window light', size: '1024x1024' },
  { name: 'gallery-4.png', prompt: 'Beautiful couple portrait at scenic overlook, mountain landscape behind, golden hour backlight, wind in hair, romantic adventure photography', size: '1024x1024' },
  { name: 'gallery-5.png', prompt: 'Couple at a night market, colorful lanterns, trying street food together, vibrant Asian street scene, candid joyful moment, night photography', size: '1024x1024' },
  { name: 'gallery-6.png', prompt: 'Couple relaxing on a picnic blanket in a field of wildflowers, lazy afternoon, soft dappled sunlight, serene romantic moment, lifestyle photography', size: '1024x1024' },
  { name: 'gallery-7.png', prompt: 'Elegant couple at a formal event, the woman in a beautiful evening gown, the man in a suit, clinking champagne glasses, celebration, professional portrait photography', size: '1024x1024' },
];

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const zai = await ZAI.create();
  const results = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const outputPath = path.join(OUTPUT_DIR, img.name);

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
      console.log(`✓ [${i + 1}/${images.length}] SKIP (exists): ${img.name}`);
      results.push({ name: img.name, status: 'skipped' });
      continue;
    }

    try {
      console.log(`⏳ [${i + 1}/${images.length}] Generating: ${img.name}...`);
      const response = await zai.images.generations.create({
        prompt: img.prompt,
        size: img.size,
      });

      const buffer = Buffer.from(response.data[0].base64, 'base64');
      fs.writeFileSync(outputPath, buffer);
      console.log(`✓ [${i + 1}/${images.length}] DONE: ${img.name} (${(buffer.length / 1024).toFixed(0)}KB)`);
      results.push({ name: img.name, status: 'ok', size: buffer.length });
    } catch (err) {
      console.error(`✗ [${i + 1}/${images.length}] FAIL: ${img.name} — ${err.message}`);
      results.push({ name: img.name, status: 'error', error: err.message });
    }
  }

  const ok = results.filter(r => r.status === 'ok' || r.status === 'skipped').length;
  console.log(`\nDone: ${ok}/${images.length} images ready`);
}

main().catch(console.error);
