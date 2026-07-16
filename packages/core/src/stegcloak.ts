import { encrypt, decrypt } from "./encrypt";
import { compress, decompress } from "./compact";
import { encodeBase6, decodeBase6, detach, embed } from "./message";
import * as C from "./constants";
import { concatBuff } from "./util";

export async function hide(config: {
  secret: string;
  cover: string;
  password?: string;
}): Promise<string> {
  const { secret, cover, password } = config;
  if (cover.split(" ").length === 1) {
    throw new Error("Minimum two words required");
  }

  // 1. Compress the message
  const { data: compressedData, wasCompressed } = await compress(secret);

  const encryptRequested = password && password.length > 0;
  let flags = 0;
  if (encryptRequested) {
    flags |= C.FLAG_ENCRYPTED;
  }
  if (wasCompressed) {
    flags |= C.FLAG_COMPRESSED;
  }

  let payloadBuffer: Uint8Array;
  if (encryptRequested) {
    // 2. Encrypt
    const encrypted = await encrypt({
      password: password!,
      data: compressedData,
      flags,
    });

    // 3. Assemble wire format
    payloadBuffer = concatBuff([
      new Uint8Array([C.VERSION]),
      new Uint8Array([flags]),
      encrypted.salt,
      encrypted.nonce,
      encrypted.commitTag,
      encrypted.ciphertext,
    ]);
  } else {
    // 3. Assemble wire format
    payloadBuffer = concatBuff([
      new Uint8Array([C.VERSION]),
      new Uint8Array([flags]),
      compressedData,
    ]);
  }

  // 4. Base-6 encode
  const invisibleStream = encodeBase6(payloadBuffer, C.ZWC);

  // 5. Embed
  return embed(cover, invisibleStream);
}

export async function reveal(config: {
  text: string;
  password?: string;
}): Promise<string> {
  const { text, password } = config;

  // 1. Detach ZWC
  const detachedStream = detach(text, C.ZWC);

  // 2. Base-6 decode
  const payloadBuffer = decodeBase6(detachedStream, C.ZWC);

  if (payloadBuffer.length < 2) {
    throw new Error("Invalid payload: too short.");
  }

  // 3. Parse headers
  const version = payloadBuffer[0];
  if (version !== C.VERSION) {
    throw new Error("Unsupported/foreign version");
  }

  const flags = payloadBuffer[1];
  const isEncrypted = (flags & C.FLAG_ENCRYPTED) !== 0;
  const isCompressed = (flags & C.FLAG_COMPRESSED) !== 0;

  let decryptedData: Uint8Array;
  if (isEncrypted) {
    if (!password) {
      throw new Error("Password is required to decrypt this payload.");
    }

    if (payloadBuffer.length < 74) {
      throw new Error("Invalid payload: too short for encrypted wire format.");
    }

    const salt = payloadBuffer.slice(2, 18);
    const nonce = payloadBuffer.slice(18, 42);
    const commitTag = payloadBuffer.slice(42, 74);
    const ciphertext = payloadBuffer.slice(74);

    decryptedData = await decrypt({
      password,
      version,
      flags,
      salt,
      nonce,
      commitTag,
      ciphertext,
    });
  } else {
    decryptedData = payloadBuffer.slice(2);
  }

  // 4. Decompress
  const decompressed = await decompress(decryptedData, isCompressed);

  // 5. Convert to UTF-8 string
  return new TextDecoder().decode(decompressed);
}

export * from "./message";
export * from "./constants";
export * from "./util";
