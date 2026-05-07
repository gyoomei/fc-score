function clampScore(input: number): number {
  if (Number.isNaN(input)) return 0;
  return Math.max(0, Math.min(1000, Math.round(input)));
}

function tierFromScore(score: number): "Dormant" | "Active" | "Power" | "Whale" {
  if (score >= 850) return "Whale";
  if (score >= 650) return "Power";
  if (score >= 350) return "Active";
  return "Dormant";
}

function nextTierLabel(score: number): string {
  if (score >= 850) return "MAX TIER REACHED";
  if (score >= 650) return `TO WHALE ${850 - score} PTS`;
  if (score >= 350) return `TO POWER ${650 - score} PTS`;
  return `TO ACTIVE ${350 - score} PTS`;
}

function safeText(input: string, fallback: string, maxLen = 32): string {
  const value = (input || "").trim();
  if (!value) return fallback;
  return value.slice(0, maxLen);
}

type RGB = [number, number, number];

const WIDTH = 1200;
const HEIGHT = 800;
const BYTES_PER_PIXEL = 3;

const FONT: Record<string, string[]> = {
  "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  "J": ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "@": ["01110", "10001", "10111", "10101", "10111", "10000", "01111"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function putU32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 255;
  target[offset + 1] = (value >>> 16) & 255;
  target[offset + 2] = (value >>> 8) & 255;
  target[offset + 3] = value & 255;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(type: string, data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < type.length; i += 1) c = CRC_TABLE[(c ^ type.charCodeAt(i)) & 255] ^ (c >>> 8);
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i += 1) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  putU32(out, 0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  putU32(out, 8 + data.length, crc32(type, data));
  return out;
}

function zlibStore(data: Uint8Array): Uint8Array {
  const blocks = Math.ceil(data.length / 65535);
  const out = new Uint8Array(2 + data.length + blocks * 5 + 4);
  let o = 0;
  out[o++] = 0x78;
  out[o++] = 0x01;
  let p = 0;
  for (let b = 0; b < blocks; b += 1) {
    const len = Math.min(65535, data.length - p);
    const finalBlock = b === blocks - 1 ? 1 : 0;
    out[o++] = finalBlock;
    out[o++] = len & 255;
    out[o++] = (len >>> 8) & 255;
    const nlen = (~len) & 0xffff;
    out[o++] = nlen & 255;
    out[o++] = (nlen >>> 8) & 255;
    out.set(data.subarray(p, p + len), o);
    o += len;
    p += len;
  }
  putU32(out, o, adler32(data));
  return out;
}

function setPixel(buf: Uint8Array, x: number, y: number, color: RGB) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * BYTES_PER_PIXEL;
  buf[i] = color[0];
  buf[i + 1] = color[1];
  buf[i + 2] = color[2];
}

function fillRect(buf: Uint8Array, x: number, y: number, w: number, h: number, color: RGB) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(WIDTH, Math.ceil(x + w));
  const y1 = Math.min(HEIGHT, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy += 1) {
    let i = (yy * WIDTH + x0) * BYTES_PER_PIXEL;
    for (let xx = x0; xx < x1; xx += 1) {
      buf[i++] = color[0];
      buf[i++] = color[1];
      buf[i++] = color[2];
    }
  }
}

function fillCircle(buf: Uint8Array, cx: number, cy: number, r: number, color: RGB) {
  const r2 = r * r;
  for (let y = Math.max(0, cy - r); y <= Math.min(HEIGHT - 1, cy + r); y += 1) {
    for (let x = Math.max(0, cx - r); x <= Math.min(WIDTH - 1, cx + r); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(buf, x, y, color);
    }
  }
}

function drawText(buf: Uint8Array, text: string, x: number, y: number, scale: number, color: RGB, maxChars = 80) {
  let cursor = x;
  const normalized = text.toUpperCase().replace(/[^A-Z0-9@.\-:/ ]/g, " ").slice(0, maxChars);
  for (const ch of normalized) {
    const glyph = FONT[ch] || FONT[" "];
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        if (glyph[row][col] === "1") fillRect(buf, cursor + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

async function deflateData(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return zlibStore(data);

  const body = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const stream = new Blob([body]).stream().pipeThrough(new CompressionStream("deflate"));
  const compressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(compressed);
}

async function makePng(score: number, tier: string, handle: string, tx: number, activeDays: number, volume: number): Promise<Uint8Array> {
  const pixels = new Uint8Array(WIDTH * HEIGHT * BYTES_PER_PIXEL);
  fillRect(pixels, 0, 0, WIDTH, HEIGHT, [8, 10, 22]);
  fillCircle(pixels, 180, 135, 250, [35, 23, 82]);
  fillCircle(pixels, 980, 100, 230, [10, 79, 82]);
  fillCircle(pixels, 1030, 680, 260, [77, 31, 95]);
  fillRect(pixels, 54, 54, 1092, 692, [18, 22, 42]);
  fillRect(pixels, 62, 62, 1076, 676, [26, 31, 55]);
  fillRect(pixels, 92, 92, 1016, 616, [18, 22, 42]);
  fillRect(pixels, 96, 96, 1008, 608, [30, 36, 64]);

  const tierColor: RGB = tier === "Whale" ? [45, 212, 191] : tier === "Power" ? [168, 85, 247] : tier === "Active" ? [96, 165, 250] : [203, 213, 225];
  drawText(pixels, "BASE WALLET SCORE", 120, 130, 7, [196, 181, 253]);
  drawText(pixels, String(score), 120, 205, 25, [248, 250, 252]);
  fillRect(pixels, 122, 405, 260, 56, tierColor);
  drawText(pixels, `TIER ${tier}`, 148, 420, 5, [8, 10, 22]);
  fillRect(pixels, 420, 405, 220, 56, [16, 185, 129]);
  drawText(pixels, "LIVE BASE", 448, 420, 5, [8, 10, 22]);

  const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
  drawText(pixels, cleanHandle, 720, 134, 7, [248, 250, 252], 18);
  drawText(pixels, nextTierLabel(score), 120, 500, 5, [209, 250, 229]);

  const statsY = 590;
  const boxes = [
    { label: "TX COUNT", value: String(Math.round(tx)), x: 120 },
    { label: "ACTIVE 30D", value: String(Math.round(activeDays)), x: 430 },
    { label: "VOLUME ETH", value: String(Math.round(volume * 100) / 100), x: 740 },
  ];
  for (const box of boxes) {
    fillRect(pixels, box.x, statsY, 260, 98, [37, 45, 78]);
    drawText(pixels, box.label, box.x + 24, statsY + 20, 4, [209, 213, 219]);
    drawText(pixels, box.value, box.x + 24, statsY + 54, 6, [255, 255, 255], 12);
  }
  drawText(pixels, "FARCASTER MINI APP", 720, 684, 4, [167, 139, 250]);

  const scanline = WIDTH * BYTES_PER_PIXEL + 1;
  const raw = new Uint8Array(scanline * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    raw[y * scanline] = 0;
    raw.set(pixels.subarray(y * WIDTH * BYTES_PER_PIXEL, (y + 1) * WIDTH * BYTES_PER_PIXEL), y * scanline + 1);
  }

  const ihdr = new Uint8Array(13);
  putU32(ihdr, 0, WIDTH);
  putU32(ihdr, 4, HEIGHT);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", await deflateData(raw)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const score = clampScore(Number(searchParams.get("score") || 0));
  const tier = tierFromScore(score);
  const handle = safeText(searchParams.get("handle") || searchParams.get("username") || "", "@base-user", 32);
  const tx = Math.max(0, Number(searchParams.get("tx") || 0));
  const activeDays = Math.max(0, Number(searchParams.get("active") || 0));
  const volume = Math.max(0, Number(searchParams.get("volume") || 0));

  const png = await makePng(score, tier, handle, tx, activeDays, volume);

  const body = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Content-Length": String(png.byteLength),
    },
  });
}
