import fs from 'node:fs/promises';
import sharp from 'sharp';
await fs.mkdir('public/icons', { recursive: true });
for (const size of [192, 512]) await sharp('public/icon.svg').resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
await sharp('public/icon.svg').resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
await sharp('public/icon.svg').resize(384, 384).extend({ top: 64, bottom: 64, left: 64, right: 64, background: '#242922' }).png().toFile('public/icons/maskable-512.png');
