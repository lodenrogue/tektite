const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const source = process.argv[2];
const output = process.argv[3] || "AppIcon.icns";

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
  ["icp4", 16],
  ["icp5", 32],
  ["icp6", 64],
  ["ic07", 128],
  ["ic08", 256],
  ["ic09", 512],
  ["ic10", 1024]
];

async function main() {
  if (!source) {
    throw new Error("Usage: make-rounded-icon.js source.png [output.icns]");
  }

  const workDir = await fs.mkdtemp(path.join("/tmp", "tektite-icon-"));

  try {
    const rounded1024 = await makeRoundedPng(1024);

    for (const [name, size] of iconsetEntries) {
      await sharp(rounded1024)
        .resize(size, size)
        .png()
        .toFile(path.join(workDir, name));
    }

    const chunks = [];
    for (const [type, size] of icnsEntries) {
      const png = await sharp(rounded1024)
        .resize(size, size)
        .png()
        .toBuffer();
      const header = Buffer.alloc(8);
      header.write(type, 0, "ascii");
      header.writeUInt32BE(png.length + 8, 4);
      chunks.push(Buffer.concat([header, png]));
    }

    const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const header = Buffer.alloc(8);
    header.write("icns", 0, "ascii");
    header.writeUInt32BE(totalLength, 4);

    await fs.writeFile(output, Buffer.concat([header, ...chunks]));
    console.log(`Done! Rounded ${output} created.`);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function makeRoundedPng(size) {
  const radius = 180;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`
  );
  const image = await sharp(source)
    .rotate()
    .resize({
      width: 860,
      height: 860,
      fit: "inside",
      withoutEnlargement: false
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: image, gravity: "center" },
      { input: mask, blend: "dest-in" }
    ])
    .png()
    .toBuffer();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
