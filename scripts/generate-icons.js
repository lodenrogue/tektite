const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const source = path.join(root, "tektive-icon.webp");
const iconDir = path.join(root, "assets", "icons");
const iconsetDir = path.join(iconDir, "tektite.iconset");

const iconsetEntries = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024]
];

const icnsEntries = [
  ["icp4", "icon_16x16.png"],
  ["icp5", "icon_32x32.png"],
  ["icp6", "icon_32x32@2x.png"],
  ["ic07", "icon_128x128.png"],
  ["ic08", "icon_256x256.png"],
  ["ic09", "icon_512x512.png"],
  ["ic10", "icon_512x512@2x.png"]
];

async function main() {
  await fs.mkdir(iconDir, { recursive: true });
  await fs.rm(iconsetDir, { recursive: true, force: true });
  await fs.mkdir(iconsetDir, { recursive: true });

  await sharp(source)
    .resize(1024, 1024)
    .ensureAlpha()
    .png()
    .toFile(path.join(iconDir, "tektite-icon.png"));

  for (const [name, size] of iconsetEntries) {
    await sharp(source)
      .resize(size, size)
      .ensureAlpha()
      .png()
      .toFile(path.join(iconsetDir, name));
  }

  const chunks = [];
  for (const [type, fileName] of icnsEntries) {
    const data = await fs.readFile(path.join(iconsetDir, fileName));
    const header = Buffer.alloc(8);
    header.write(type, 0, "ascii");
    header.writeUInt32BE(data.length + 8, 4);
    chunks.push(Buffer.concat([header, data]));
  }

  const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(totalLength, 4);

  await fs.writeFile(path.join(iconDir, "tektite-icon.icns"), Buffer.concat([header, ...chunks]));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
