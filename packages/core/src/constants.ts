"use strict";

export const VERSION = 0x02;

export const FLAG_ENCRYPTED = 0b00000001;
export const FLAG_COMPRESSED = 0b00000010;

export const ARGON2_SALT_BYTES = 16;
export const ARGON2_OPSLIMIT = 3;
export const ARGON2_MEMLIMIT = 256 * 1024 * 1024; // 256 MiB

export const XCHACHA_NONCE_BYTES = 24;
export const KEY_BYTES = 32;
export const COMMIT_TAG_BYTES = 32;

export const ZSTD_LEVEL = 19;

export const BASE6_CHUNK_BYTES = 8;
export const BASE6_DIGITS_PER_CHUNK = 25;

export const KDF_CONTEXT_ENC = "stegcloak-v2-enc";
export const KDF_CONTEXT_COMMIT = "stegcloak-v2-commit";
export const COMMIT_TAG_CONTEXT = "stegcloak-v2-commit-tag";

export const ZWC = ["\u200c", "\u200d", "\u2061", "\u2062", "\u2063", "\u2064"];
