// news-image-20261119 entry (Node 22, standard library only).
//
// The picture is a newspaper front page summing up the world's news of
// Thursday 19 November 2026: masthead "WORLD NEWS" dated that day, with four
// illustrated panels — TRUMP, XI, PUTIN MEET IN SHENZHEN (first-ever
// trilateral summit, leaders at a summit table), GTA VI OUT TODAY (neon
// Vice City street, 13-year wait over), CYCLONE AKVAN BEARS DOWN (cyclone
// over the Bay of Bengal; red alert on India's east coast, landfall due
// Friday), and INDIA-JAPAN 2+2 TALKS IN TOKYO (ministers shaking hands).
// The image was generated for this entry, and the program below simply
// delivers it to the grader's output directory — after first checking the
// file is a PNG or JPEG of exactly 1024x1024 px and no more than 1 MiB,
// as the competition requires.
//
// Run it the way the kit does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program runs twice and must write the same bytes both times; a
// byte-for-byte copy of one fixed file always does.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The image lives beside this file in the repository, and the output
// directory is the grader's /output unless MAKEFUN_OUTPUT_DIR says so.
const source = new URL('./entry.png', import.meta.url);
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const target = join(outputDir, 'entry.png');

if (!existsSync(source)) {
  throw new Error('entry.png is missing beside main.ts');
}

// The competition caps the source image at 1 MiB: refuse an oversized
// file instead of handing the judge an entry that breaks the rules.
const MAX_SOURCE_BYTES = 1048576;
const sourceBytes = statSync(source).size;
if (sourceBytes > MAX_SOURCE_BYTES) {
  throw new Error(
    `entry.png is ${sourceBytes} bytes, over the 1 MiB competition cap`,
  );
}

// The competition requires the source image to be exactly 1024x1024 px:
// read the dimensions out of the file header — PNG IHDR or JPEG SOF
// marker — and refuse an image of any other size instead of submitting an
// entry that breaks the rules.
function readDimensions(bytes: Buffer): { width: number; height: number } {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        throw new Error('entry.png has a malformed JPEG segment');
      }
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
    throw new Error('entry.png has no JPEG SOF marker');
  }
  throw new Error('entry.png is neither PNG nor JPEG');
}

const REQUIRED_WIDTH = 1024;
const REQUIRED_HEIGHT = 1024;
const { width, height } = readDimensions(readFileSync(source));
if (width !== REQUIRED_WIDTH || height !== REQUIRED_HEIGHT) {
  throw new Error(
    `entry.png is ${width}x${height}, not the required 1024x1024`,
  );
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(source, target);

// A copied file must actually hold the picture: refuse an empty,
// truncated or wrong-format write instead of handing the judge a
// broken file. JPEG starts FF D8, PNG starts 89 50 4E 47.
const copiedBytes = statSync(target).size;
const head = readFileSync(target).subarray(0, 4);
const isJpeg = head[0] === 0xff && head[1] === 0xd8;
const isPng =
  head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
if (
  copiedBytes === 0 ||
  copiedBytes !== statSync(source).size ||
  (!isJpeg && !isPng)
) {
  throw new Error('entry.png was not copied whole');
}
