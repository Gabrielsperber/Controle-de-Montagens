const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const RES = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

// Mesmo desenho do ícone do desktop: quadrado charcoal (#1c2128) com "CM" em branco
const SVG_QUADRADO = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect x="14" y="14" width="484" height="484" rx="104" fill="#1c2128"/>
  <text x="256" y="300" font-family="Segoe UI, Arial, sans-serif" font-weight="700"
        font-size="188" fill="#ffffff" text-anchor="middle">CM</text>
</svg>`.trim();

// Foreground do ícone adaptativo: mesmo conteúdo, mas com bastante margem
// (o Android recorta esse desenho em formatos variados - círculo, quadrado arredondado, etc.)
const SVG_FOREGROUND = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <text x="256" y="290" font-family="Segoe UI, Arial, sans-serif" font-weight="700"
        font-size="140" fill="#ffffff" text-anchor="middle">CM</text>
</svg>`.trim();

const DENSIDADES_LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const DENSIDADES_FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

async function main() {
  for (const [dpi, size] of Object.entries(DENSIDADES_LEGACY)) {
    const dir = path.join(RES, `mipmap-${dpi}`);
    await sharp(Buffer.from(SVG_QUADRADO)).resize(size, size).png().toFile(path.join(dir, 'ic_launcher.png'));

    // versão redonda (máscara circular aplicada na própria imagem)
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    await sharp(Buffer.from(SVG_QUADRADO))
      .resize(size, size)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));
  }

  for (const [dpi, size] of Object.entries(DENSIDADES_FOREGROUND)) {
    const dir = path.join(RES, `mipmap-${dpi}`);
    await sharp(Buffer.from(SVG_FOREGROUND)).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
  }

  // Cor de fundo do ícone adaptativo = mesmo charcoal da marca
  const colorsPath = path.join(RES, 'values', 'ic_launcher_background.xml');
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1c2128</color>\n</resources>\n`;
  fs.writeFileSync(colorsPath, xml);

  console.log('Ícones Android gerados com sucesso.');
}

main().catch((err) => { console.error(err); process.exit(1); });
