const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

const ICON_SRC = path.join(__dirname, '../assets/icon.png');
const FOREGROUND_SRC = path.join(__dirname, '../assets/android-icon-foreground.png');
const SPLASH_SRC = path.join(__dirname, '../assets/icon.png');

const DENSITIES = [
  { folder: 'mipmap-mdpi', size: 48, fgSize: 108 },
  { folder: 'mipmap-hdpi', size: 72, fgSize: 162 },
  { folder: 'mipmap-xhdpi', size: 96, fgSize: 216 },
  { folder: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
  { folder: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
];

const SPLASH_DENSITIES = [
  { folder: 'drawable', w: 480, h: 320 },
  { folder: 'drawable-port-mdpi', w: 320, h: 480 },
  { folder: 'drawable-port-hdpi', w: 480, h: 800 },
  { folder: 'drawable-port-xhdpi', w: 720, h: 1280 },
  { folder: 'drawable-port-xxhdpi', w: 960, h: 1600 },
  { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  { folder: 'drawable-land-mdpi', w: 480, h: 320 },
  { folder: 'drawable-land-hdpi', w: 800, h: 480 },
  { folder: 'drawable-land-xhdpi', w: 1280, h: 720 },
  { folder: 'drawable-land-xxhdpi', w: 1600, h: 960 },
  { folder: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
];

async function main() {
  console.log('Generating Android Launcher Icons from', ICON_SRC);
  
  const iconImg = await Jimp.read(ICON_SRC);
  const fgImg = await Jimp.read(FOREGROUND_SRC);
  
  // 1. Generate Mipmap Icons
  for (const d of DENSITIES) {
    const dir = path.join(__dirname, '../android/app/src/main/res', d.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // ic_launcher.png (Square icon with solid black #000000 background)
    const squareCanvas = new Jimp({ width: d.size, height: d.size, color: 0x000000ff });
    const sqLogoSize = Math.round(d.size * 0.72);
    const sqLogo = iconImg.clone();
    sqLogo.resize({ w: sqLogoSize, h: sqLogoSize });
    const sqX = Math.round((d.size - sqLogoSize) / 2);
    const sqY = Math.round((d.size - sqLogoSize) / 2);
    squareCanvas.composite(sqLogo, sqX, sqY);
    await squareCanvas.write(path.join(dir, 'ic_launcher.png'));

    // ic_launcher_round.png (Circular mask or solid black background)
    const roundCanvas = new Jimp({ width: d.size, height: d.size, color: 0x000000ff });
    roundCanvas.composite(sqLogo, sqX, sqY);
    // Apply round circle mask
    const radius = d.size / 2;
    for (let y = 0; y < d.size; y++) {
      for (let x = 0; x < d.size; x++) {
        const dx = x - radius + 0.5;
        const dy = y - radius + 0.5;
        if (dx * dx + dy * dy > radius * radius) {
          roundCanvas.setPixelColor(0x00000000, x, y);
        }
      }
    }
    await roundCanvas.write(path.join(dir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png (Adaptive icon foreground, transparent with centered logo)
    const fgClone = fgImg.clone();
    fgClone.resize({ w: d.fgSize, h: d.fgSize });
    await fgClone.write(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`Generated icons for ${d.folder} (${d.size}x${d.size})`);
  }

  // 2. Set background color to #000000 in values/ic_launcher_background.xml
  const bgXmlPath = path.join(__dirname, '../android/app/src/main/res/values/ic_launcher_background.xml');
  fs.writeFileSync(bgXmlPath, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n`);
  console.log('Updated ic_launcher_background.xml to #000000');

  // 3. Generate Splash screens (Black background with centered Blink logo)
  const splashLogo = await Jimp.read(SPLASH_SRC);
  for (const s of SPLASH_DENSITIES) {
    const dir = path.join(__dirname, '../android/app/src/main/res', s.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const canvas = new Jimp({ width: s.w, height: s.h, color: 0x07080Bff });
    
    // Logo size: min dimension * 0.35
    const logoSize = Math.round(Math.min(s.w, s.h) * 0.35);
    const logoResized = splashLogo.clone();
    logoResized.resize({ w: logoSize, h: logoSize });

    const x = Math.round((s.w - logoSize) / 2);
    const y = Math.round((s.h - logoSize) / 2);

    canvas.composite(logoResized, x, y);
    await canvas.write(path.join(dir, 'splash.png'));
    console.log(`Generated splash for ${s.folder} (${s.w}x${s.h})`);
  }

  console.log('All Android Launcher & Splash Assets successfully generated!');
}

main().catch(console.error);
