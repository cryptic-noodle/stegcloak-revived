import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import StegCloak from "./stegcloak.js";
import {
  encodeBase6,
  decodeBase6,
  detach,
  ZWC,
  FLAG_COMPRESSED,
  FLAG_ENCRYPTED
} from "@stegcloak/core";

const C = { ZWC, FLAG_COMPRESSED, FLAG_ENCRYPTED };

async function runTests() {
  console.log("=== StegCloak v2 Verification Suite ===");

  // 1. Base-6 Codec Unit Tests
  console.log("\n1. Testing Base-6 Codec...");
  const testLengths = [0, 1, 4, 7, 8, 9, 15, 16, 17, 1000];
  for (const len of testLengths) {
    const original = randomBytes(len);
    const encoded = encodeBase6(original, C.ZWC);

    // Assert all chars in encoded are ZWC
    for (const char of encoded) {
      assert(C.ZWC.indexOf(char) !== -1, "Encoded contains non-ZWC character");
    }

    // Assert length is multiple of 25
    assert(encoded.length % 25 === 0, `Encoded length ${encoded.length} is not a multiple of 25 for input size ${len}`);

    const decoded = decodeBase6(encoded, C.ZWC);
    assert.deepEqual(Buffer.from(decoded), original, `Base-6 mismatch for length ${len}`);
  }
  console.log("✓ Base-6 Codec tests passed!");

  // 2. Round-trip Correctness
  console.log("\n2. Testing Round-Trip Correctness...");
  const stegcloak = new StegCloak(true, false);
  const password = "my-super-secret-password-123";
  const cover = "This is a cover sentence that needs to hide some secret data.";

  const secrets = [
    "",
    "a",
    "Hello World!",
    "Emojis: 🦄 🔥 🚀 🌟 🥳",
    "Non-latin: こんにちは世界 / Russian: Привет мир / Arabic: مرحبا بالعالم",
    randomBytes(500).toString("base64"), // hard to compress
    "A very long message... ".repeat(100) // highly compressible
  ];

  for (const secret of secrets) {
    const hidden = await stegcloak.hide(secret, password, cover);
    const revealed = await stegcloak.reveal(hidden, password);
    assert.equal(revealed, secret, `Round-trip mismatch for secret: ${secret.slice(0, 30)}...`);
  }
  console.log("✓ Round-Trip correctness tests passed!");

  // 3. Wrong Password Handling
  console.log("\n3. Testing Wrong Password Handling...");
  const targetSecret = "Sensitive classified data!";
  const hiddenPayload = await stegcloak.hide(targetSecret, password, cover);

  try {
    await stegcloak.reveal(hiddenPayload, "wrong-password");
    assert.fail("Should have thrown error on wrong password");
  } catch (err) {
    assert.equal(err.message, "Wrong password or corrupted payload", "Error message mismatch");
  }
  console.log("✓ Wrong password tests passed!");

  // 4. Tampered Ciphertext Handling
  console.log("\n4. Testing Tampered Ciphertext...");
  const detachedZwc = detach(hiddenPayload, C.ZWC);

  // Flip a character in the ZWC stream
  const modifiedZwc =
    detachedZwc.slice(0, 50) +
    (detachedZwc[50] === C.ZWC[0] ? C.ZWC[1] : C.ZWC[0]) +
    detachedZwc.slice(51);
  const tamperedPayload = hiddenPayload.replace(detachedZwc, modifiedZwc);

  try {
    await stegcloak.reveal(tamperedPayload, password);
    assert.fail("Should have thrown error on tampered ciphertext");
  } catch (err) {
    assert.equal(err.message, "Wrong password or corrupted payload", "Error message mismatch");
  }
  console.log("✓ Tampered ciphertext tests passed!");

  // 5. Compression Fallback
  console.log("\n5. Testing Compression Fallback...");
  const nonCompressible = randomBytes(32).toString("base64");
  const hiddenFallback = await stegcloak.hide(nonCompressible, password, cover);
  const detached = detach(hiddenFallback, C.ZWC);
  const decoded = decodeBase6(detached, C.ZWC);
  const flags = decoded[1];

  // Bit 1 (FLAG_COMPRESSED) should be 0 since random data isn't smaller when compressed
  assert.equal(flags & C.FLAG_COMPRESSED, 0, "FLAG_COMPRESSED should be unset for random data");

  const revealedFallback = await stegcloak.reveal(hiddenFallback, password);
  assert.equal(revealedFallback, nonCompressible, "Fallback round-trip mismatch");
  console.log("✓ Compression fallback tests passed!");

  // 6. No-Encryption Mode
  console.log("\n6. Testing No-Encryption Mode...");
  const stegcloakNoCrypt = new StegCloak(false, false);
  const noCryptPayload = await stegcloakNoCrypt.hide("Unencrypted secret message", null, cover);

  const detachedNoCrypt = detach(noCryptPayload, C.ZWC);
  const decodedNoCrypt = decodeBase6(detachedNoCrypt, C.ZWC);
  const flagsNoCrypt = decodedNoCrypt[1];

  // Bit 0 (FLAG_ENCRYPTED) must be 0
  assert.equal(flagsNoCrypt & C.FLAG_ENCRYPTED, 0, "FLAG_ENCRYPTED should be unset");

  const revealedNoCrypt = await stegcloakNoCrypt.reveal(noCryptPayload, null);
  assert.equal(revealedNoCrypt, "Unencrypted secret message", "No-encryption round-trip mismatch");
  console.log("✓ No-encryption mode tests passed!");

  // 7. Non-determinism Verification
  console.log("\n7. Testing Non-determinism...");
  const run1 = await stegcloak.hide("Same secret", password, cover);
  const run2 = await stegcloak.hide("Same secret", password, cover);
  assert.notEqual(run1, run2, "Encryption outputs must be non-deterministic (different salts/nonces)");
  console.log("✓ Non-determinism tests passed!");

  // 8. Performance Sanity Check
  console.log("\n8. Measuring KDF/Encryption Performance...");
  const start = Date.now();
  await stegcloak.hide("Measure time", password, cover);
  const duration = Date.now() - start;
  console.log(`Latency: ${duration} ms`);
  assert(duration < 2000, `Argon2id latency took too long: ${duration} ms`);
  console.log("✓ Performance tests passed!");

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
