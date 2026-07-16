import { writeUInt32BE, readUInt32BE, concatBuff } from "./util";

export function encodeBase6(buffer: Uint8Array, zwc: string[]): string {
  const len = buffer.length;
  const header = writeUInt32BE(len);
  const lenPrefixed = concatBuff([header, buffer]);

  let result = "";
  for (let i = 0; i < lenPrefixed.length; i += 8) {
    let chunk = lenPrefixed.slice(i, i + 8);
    if (chunk.length < 8) {
      const padded = new Uint8Array(8);
      padded.set(chunk);
      chunk = padded;
    }

    // Convert 8 bytes chunk to a BigInt (unsigned big-endian)
    let n = 0n;
    for (let j = 0; j < 8; j++) {
      n = (n << 8n) | BigInt(chunk[j]);
    }

    // Convert to exactly 25 base-6 digits, zero-padded on the left
    let chunkDigits = "";
    for (let d = 0; d < 25; d++) {
      const digit = Number(n % 6n);
      chunkDigits = zwc[digit] + chunkDigits;
      n = n / 6n;
    }
    result += chunkDigits;
  }
  return result;
}

export function decodeBase6(zwcString: string, zwc: string[]): Uint8Array {
  if (zwcString.length % 25 !== 0) {
    throw new Error("Invalid ZWC string length: not a multiple of 25.");
  }

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < zwcString.length; i += 25) {
    const group = zwcString.slice(i, i + 25);
    let n = 0n;
    for (let j = 0; j < 25; j++) {
      const char = group[j];
      const digit = zwc.indexOf(char);
      if (digit === -1) {
        throw new Error(`Invalid ZWC character detected: ${char}`);
      }
      n = n * 6n + BigInt(digit);
    }

    const chunk = new Uint8Array(8);
    for (let j = 7; j >= 0; j--) {
      chunk[j] = Number(n & 0xffn);
      n = n >> 8n;
    }
    chunks.push(chunk);
  }

  const lenPrefixed = concatBuff(chunks);
  if (lenPrefixed.length < 4) {
    throw new Error("Invalid payload: too short to contain length prefix.");
  }

  const length = readUInt32BE(lenPrefixed, 0);
  if (length > lenPrefixed.length - 4) {
    throw new Error("Invalid payload: length prefix exceeds decoded data size.");
  }

  return lenPrefixed.slice(4, 4 + length);
}

export function detach(str: string, zwc: string[]): string {
  const eachWords = str.split(" ");
  const targetWord = eachWords.find((word) => {
    const chars = word.split("");
    return chars.some((char) => zwc.indexOf(char) !== -1);
  });
  if (!targetWord) {
    throw new Error(
      "Invisible stream not detected! Please copy and paste the StegCloak text sent by the sender."
    );
  }
  return targetWord
    .split("")
    .filter((char) => zwc.indexOf(char) !== -1)
    .join("");
}

export function embed(cover: string, secret: string): string {
  const arr = cover.split(" ");
  const targetIndex = Math.floor(Math.random() * Math.floor(arr.length / 2));
  return arr
    .slice(0, targetIndex + 1)
    .concat([secret + arr[targetIndex + 1]])
    .concat(arr.slice(targetIndex + 2, arr.length))
    .join(" ");
}
