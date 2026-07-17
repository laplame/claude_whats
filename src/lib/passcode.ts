import crypto from "node:crypto";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(passcode, salt, 32, SCRYPT_PARAMS);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPasscode(passcode: string, stored: string): boolean {
  try {
    const [algo, saltHex, hashHex] = stored.split("$");
    if (algo !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(passcode, salt, expected.length, SCRYPT_PARAMS);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
