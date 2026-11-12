/**
 * coolest-art-01 — Generative art for make.fun bounty
 * Generates a deterministic, visually striking abstract composition.
 * Run: node main.js
 * Output: /output/entry.png (1024x1024, <1MiB)
 */

const { createWriteStream } = require('fs');
const zlib = require('zlib');

// ─── minimal PNG encoder (no dependencies) ────────────────────────────────

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcData = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function pngEncode(pixels, width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT
  const rawData = Buffer.alloc(width * height * 4 + height);
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawData[y * (width * 4 + 1) + 1 + x * 4] = pixels[idx];
      rawData[y * (width * 4 + 1) + 2 + x * 4] = pixels[idx + 1];
      rawData[y * (width * 4 + 1) + 3 + x * 4] = pixels[idx + 2];
      rawData[y * (width * 4 + 1) + 4 + x * 4] = pixels[idx + 3];
    }
  }
  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);

  // IEND
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ─── generative art: "Eternal Bloom" ──────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function generateArt(width, height) {
  const pixels = new Uint8Array(width * height * 4);

  const palette = [
    [255, 50, 50],
    [255, 180, 50],
    [50, 200, 255],
    [200, 50, 255],
    [50, 255, 150],
    [255, 100, 180],
  ];

  // Background gradient
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const nx = x / width;
      const ny = y / height;
      const dist = Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 2;
      pixels[i] = lerp(10, 40, dist);
      pixels[i + 1] = lerp(5, 20, dist);
      pixels[i + 2] = lerp(30, 60, dist);
      pixels[i + 3] = 255;
    }
  }

  // Concentric glowing rings
  const cx = 0.5, cy = 0.5;
  for (let ring = 0; ring < 8; ring++) {
    const radius = 0.08 + ring * 0.06;
    const color = palette[ring % palette.length];
    const alphaBase = 0.3 + ring * 0.05;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x / width - cx;
        const dy = y / height - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ringDist = Math.abs(dist - radius);
        if (ringDist < 0.015) {
          const i = (y * width + x) * 4;
          const alpha = alphaBase * (1 - ringDist / 0.015);
          pixels[i] = lerp(pixels[i], color[0], alpha);
          pixels[i + 1] = lerp(pixels[i + 1], color[1], alpha);
          pixels[i + 2] = lerp(pixels[i + 2], color[2], alpha);
        }
      }
    }
  }

  // Galactic spiral arms
  for (let arm = 0; arm < 3; arm++) {
    const offset = (arm / 3) * Math.PI * 2;
    const color = palette[(arm + 2) % palette.length];
    for (let t = 0; t < 2000; t++) {
      const theta = t * 0.02;
const r = 0.02 + theta * 0.04;
      const x = cx + r * Math.cos(theta + offset) * Math.min(width, height) / Math.max(width, height);
      const y = cy + r * Math.sin(theta + offset);
      if (x >= 0 && x < 1 && y >= 0 && y < 1) {
        const px = Math.floor(x * width);
        const py = Math.floor(y * height);
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const i = (py * width + px) * 4;
          const bright = 0.15 + 0.1 * Math.sin(theta * 3);
          pixels[i] = clamp(pixels[i] + color[0] * bright, 0, 255);
          pixels[i + 1] = clamp(pixels[i + 1] + color[1] * bright, 0, 255);
          pixels[i + 2] = clamp(pixels[i + 2] + color[2] * bright, 0, 255);
        }
      }
    }
  }

  // Star field
  const rng = mulberry32(42);
  for (let i = 0; i < 500; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const size = 1 + rng() * 3;
    const brightness = 0.3 + rng() * 0.7;
    const color = palette[Math.floor(rng() * palette.length)];
    for (let dy = -Math.ceil(size); dy <= Math.ceil(size); dy++) {
      for (let dx = -Math.ceil(size); dx <= Math.ceil(size); dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= size) {
          const px = Math.floor(x + dx);
          const py = Math.floor(y + dy);
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const i = (py * width + px) * 4;
            const falloff = 1 - dist / size;
            const alpha = falloff * brightness;
            pixels[i] = clamp(pixels[i] + color[0] * alpha, 0, 255);
            pixels[i + 1] = clamp(pixels[i + 1] + color[1] * alpha, 0, 255);
            pixels[i + 2] = clamp(pixels[i + 2] + color[2] * alpha, 0, 255);
          }
        }
      }
    }
  }

  // Central glow
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x / width - 0.5;
      const dy = y / height - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.15) {
        const i = (y * width + x) * 4;
        const glow = (1 - dist / 0.15) * 0.4;
        pixels[i] = clamp(pixels[i] + 255 * glow, 0, 255);
        pixels[i + 1] = clamp(pixels[i + 1] + 200 * glow, 0, 255);
        pixels[i + 2] = clamp(pixels[i + 2] + 100 * glow, 0, 255);
      }
    }
  }

  return pixels;
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ─── main ──────────────────────────────────────────────────────────────────

const WIDTH = 1024;
const HEIGHT = 1024;
const OUTPUT = '/output/entry.png';

console.log('🎨 Generating "Eternal Bloom"...');
const pixels = generateArt(WIDTH, HEIGHT);
console.log('   Art generated, encoding PNG...');
const png = pngEncode(pixels, WIDTH, HEIGHT);
console.log(`   PNG size: ${(png.length / 1024).toFixed(1)} KB`);

const stream = createWriteStream(OUTPUT);
stream.write(png, (err) => {
  if (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
  console.log(`   ✅ Written to ${OUTPUT}`);
  console.log(`   Image: ${WIDTH}x${HEIGHT}, ${(png.length / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log('🚀 Ready for submission to make.fun!');
});
