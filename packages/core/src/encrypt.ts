import sodium from "libsodium-wrappers-sumo";
import * as C from "./constants";
import { toBuffer, concatBuff } from "./util";

export async function encrypt(config: {
  password: string | Uint8Array;
  data: string | Uint8Array;
  flags: number;
}): Promise<{
  salt: Uint8Array;
  nonce: Uint8Array;
  commitTag: Uint8Array;
  ciphertext: Uint8Array;
}> {
  await sodium.ready;

  const password = config.password;
  const plaintext = toBuffer(config.data);
  const flags = config.flags;

  // 1. Generate random salt
  const salt = sodium.randombytes_buf(C.ARGON2_SALT_BYTES);

  // 2. Derive master key via Argon2id
  const masterKey = sodium.crypto_pwhash(
    C.KEY_BYTES,
    password,
    salt,
    C.ARGON2_OPSLIMIT,
    C.ARGON2_MEMLIMIT,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );

  let encKey: Uint8Array | null = null;
  let commitKey: Uint8Array | null = null;
  let nonce: Uint8Array | null = null;
  let ciphertext: Uint8Array | null = null;
  let commitTag: Uint8Array | null = null;

  try {
    // 3. Derive independent subkeys
    encKey = sodium.crypto_generichash(
      C.KEY_BYTES,
      new TextEncoder().encode(C.KDF_CONTEXT_ENC),
      masterKey
    );
    commitKey = sodium.crypto_generichash(
      C.KEY_BYTES,
      new TextEncoder().encode(C.KDF_CONTEXT_COMMIT),
      masterKey
    );

    // 4. Generate random 24-byte nonce
    nonce = sodium.randombytes_buf(C.XCHACHA_NONCE_BYTES);

    // 5. Build associated data: version (1B) || flags (1B) || salt (16B) || nonce (24B)
    const associatedData = concatBuff([
      new Uint8Array([C.VERSION]),
      new Uint8Array([flags]),
      salt,
      nonce,
    ]);

    // 6. Encrypt plaintext via XChaCha20-Poly1305-IETF
    ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      associatedData,
      null,
      nonce,
      encKey
    );

    // 7. Compute commitment tag
    commitTag = sodium.crypto_generichash(
      C.COMMIT_TAG_BYTES,
      new TextEncoder().encode(C.COMMIT_TAG_CONTEXT),
      commitKey
    );

    return {
      salt,
      nonce: nonce!,
      commitTag: commitTag!,
      ciphertext: ciphertext!,
    };
  } finally {
    if (masterKey) sodium.memzero(masterKey);
    if (encKey) sodium.memzero(encKey);
    if (commitKey) sodium.memzero(commitKey);
  }
}

export async function decrypt(config: {
  password: string | Uint8Array;
  version: number;
  flags: number;
  salt: Uint8Array;
  nonce: Uint8Array;
  commitTag: Uint8Array;
  ciphertext: Uint8Array;
}): Promise<Uint8Array> {
  await sodium.ready;

  const password = config.password;
  const version = config.version;
  const flags = config.flags;
  const salt = toBuffer(config.salt);
  const nonce = toBuffer(config.nonce);
  const providedCommitTag = toBuffer(config.commitTag);
  const ciphertext = toBuffer(config.ciphertext);

  // 1. Derive master key via Argon2id
  const masterKey = sodium.crypto_pwhash(
    C.KEY_BYTES,
    password,
    salt,
    C.ARGON2_OPSLIMIT,
    C.ARGON2_MEMLIMIT,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );

  let encKey: Uint8Array | null = null;
  let commitKey: Uint8Array | null = null;
  let recomputedCommitTag: Uint8Array | null = null;

  try {
    // 2. Derive independent subkeys
    encKey = sodium.crypto_generichash(
      C.KEY_BYTES,
      new TextEncoder().encode(C.KDF_CONTEXT_ENC),
      masterKey
    );
    commitKey = sodium.crypto_generichash(
      C.KEY_BYTES,
      new TextEncoder().encode(C.KDF_CONTEXT_COMMIT),
      masterKey
    );

    // 3. Compute commitment tag
    recomputedCommitTag = sodium.crypto_generichash(
      C.COMMIT_TAG_BYTES,
      new TextEncoder().encode(C.COMMIT_TAG_CONTEXT),
      commitKey
    );

    // 4. Verify commitment tag constant-time
    if (!sodium.memcmp(recomputedCommitTag, providedCommitTag)) {
      throw new Error("Wrong password or corrupted payload");
    }

    // 5. Build associated data
    const associatedData = concatBuff([
      new Uint8Array([version]),
      new Uint8Array([flags]),
      salt,
      nonce,
    ]);

    // 6. Decrypt via XChaCha20-Poly1305-IETF
    let decrypted;
    try {
      decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertext,
        associatedData,
        nonce,
        encKey
      );
    } catch (e) {
      throw new Error("Wrong password or corrupted payload");
    }

    return decrypted;
  } finally {
    if (masterKey) sodium.memzero(masterKey);
    if (encKey) sodium.memzero(encKey);
    if (commitKey) sodium.memzero(commitKey);
  }
}
