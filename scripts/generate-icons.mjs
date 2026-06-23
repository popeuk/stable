import sharp from "sharp";
import { mkdir } from "node:fs/promises";

await mkdir("public", { recursive: true });

// A sober horseshoe-inspired mark on the brand earth background.
const icon = (size, maskable = false) => {
  const inset = maskable ? size * 0.14 : size * 0.22;
  const stroke = size * 0.07;
  const cx = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.22}" fill="#0E0F0C"/>
  <g fill="none" stroke="#D4793D" stroke-width="${stroke}" stroke-linecap="round">
    <path d="M ${cx - (size / 2 - inset) * 0.62} ${inset}
             A ${size / 2 - inset} ${size / 2 - inset} 0 1 0
             ${cx + (size / 2 - inset) * 0.62} ${inset}" />
  </g>
  <g fill="#D4793D">
    <circle cx="${cx - (size / 2 - inset) * 0.62}" cy="${inset}" r="${stroke * 0.55}"/>
    <circle cx="${cx + (size / 2 - inset) * 0.62}" cy="${inset}" r="${stroke * 0.55}"/>
  </g>
</svg>`;
};

const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-maskable.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: false },
];

for (const t of targets) {
  await sharp(Buffer.from(icon(t.size, t.maskable)))
    .png()
    .toFile(`public/${t.name}`);
  console.log(`✓ public/${t.name}`);
}
