// main.ts — entry runner for the news-image-20261119 competition.
//
// The entry is a newspaper front page for Thursday 19 November 2026.
// Masthead "WORLD NEWS" with the date shown, and four illustrated panels
// covering four verified stories from that day:
//   1. Trump–Xi–Putin trilateral summit in Shenzhen.
//   2. The launch of GTA VI.
//   3. Cyclone Akvan.
//   4. India–Japan 2+2 ministerial talks in Tokyo.
//
// What this program does: it takes the image file sitting next to it
// (entry.png), checks that it is a genuine 1024x1024 PNG or JPEG under
// 1 MiB, and copies it unchanged to $MAKEFUN_OUTPUT_DIR/entry.png
// (default /output). After the copy it reads the output back and proves
// it is byte-for-byte the same file. Any failed check stops the run with
// a non-zero exit code before anything is written.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_WIDTH = 1024;
const REQUIRED_HEIGHT = 1024;
const MAX_FILE_BYTES = 1048576; // 1 MiB

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8];

function die(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function startsWith(bytes: Buffer, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

// Read the width and height out of a PNG's IHDR chunk. In a valid PNG the
// first chunk is always IHDR: 8-byte signature, 4-byte length, the ASCII
// tag "IHDR", then width and height as big-endian 32-bit integers.
function pngDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24) die("PNG file is too short to hold an IHDR chunk");
  if (bytes.toString("ascii", 12, 16) !== "IHDR") {
    die("PNG file has no IHDR chunk where one is expected");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

// Walk a JPEG's marker segments until a Start Of Frame marker is found.
// A frame header holds: 2-byte length, 1-byte precision, then height and
// width as big-endian 16-bit integers. Markers without a length field
// (TEM, restart markers) are stepped over; reaching the scan data (SOS)
// without seeing a frame means the file is malformed.
function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  const FRAME_MARKERS = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2; // past the SOI marker (FF D8)
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) die("malformed JPEG: expected a marker prefix");
    const marker = bytes[offset + 1];
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2; // standalone marker, no length field follows
      continue;
    }
    if (marker === 0xda) die("malformed JPEG: reached scan data without a frame header");
    const segmentLength = bytes.readUInt16BE(offset + 2);
    if (segmentLength < 2) die("malformed JPEG: segment length is invalid");
    if (FRAME_MARKERS.has(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  die("malformed JPEG: no Start Of Frame marker found");
}

const entryDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(entryDir, "entry.png");
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const outputPath = path.join(outputDir, "entry.png");

let source: Buffer;
try {
  source = fs.readFileSync(sourcePath);
} catch (error) {
  die(`cannot read ${sourcePath}: ${(error as Error).message}`);
}

if (source.length === 0) die("entry.png is empty");
if (source.length > MAX_FILE_BYTES) {
  die(`entry.png is ${source.length} bytes, over the 1 MiB limit (${MAX_FILE_BYTES})`);
}

const isPng = startsWith(source, PNG_SIGNATURE);
const isJpeg = startsWith(source, JPEG_SIGNATURE);
if (!isPng && !isJpeg) {
  die("entry.png is neither PNG nor JPEG (magic bytes do not match)");
}

const { width, height } = isPng ? pngDimensions(source) : jpegDimensions(source);
if (width !== REQUIRED_WIDTH || height !== REQUIRED_HEIGHT) {
  die(`entry.png is ${width}x${height}, expected ${REQUIRED_WIDTH}x${REQUIRED_HEIGHT}`);
}

try {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.copyFileSync(sourcePath, outputPath);
} catch (error) {
  die(`cannot write ${outputPath}: ${(error as Error).message}`);
}

let copied: Buffer;
try {
  copied = fs.readFileSync(outputPath);
} catch (error) {
  die(`cannot read back ${outputPath}: ${(error as Error).message}`);
}
if (copied.length === 0) die("output file is empty");
if (copied.length !== source.length) {
  die(`output is ${copied.length} bytes, source is ${source.length} bytes`);
}
if (!copied.equals(source)) die("output bytes differ from source");

console.log(
  `entry.png (${source.length} bytes, ${width}x${height}) copied to ${outputPath} and verified byte-identical.`,
);
