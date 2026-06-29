import sharp from 'sharp';
import path from 'node:path';

const pub = path.resolve('public');

async function render(svg, out, size) {
  await sharp(path.join(pub, svg))
    .resize(size, size)
    .png()
    .toFile(path.join(pub, out));
  console.log(`Wrote ${out} (${size}x${size})`);
}

await render('favicon.svg', 'icon-192.png', 192);
await render('favicon.svg', 'icon-512.png', 512);
await render('favicon.svg', 'apple-touch-icon.png', 180);
await render('icon-maskable.svg', 'icon-maskable-512.png', 512);

console.log('Done generating PWA icons.');
