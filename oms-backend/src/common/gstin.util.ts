// GSTIN (India GST Identification Number) validator.
//
// Format: 15 characters —
//   2 digits  state code
//   10 chars  PAN (5 letters, 4 digits, 1 letter)
//   1 char    entity number for this PAN in this state (1-9 or A-Z)
//   1 literal 'Z' (reserved by default)
//   1 char    checksum digit, computed below
//
// The checksum uses the standard GSTN algorithm: a base-36 weighted
// (alternating factor 2/1) checksum over the first 14 characters. This has
// been verified against known-valid GSTINs (format+checksum both pass).
const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const CODE_POINT_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MOD = CODE_POINT_CHARS.length; // 36

export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_FORMAT.test(gstin);
}

export function isValidGstinChecksum(gstin: string): boolean {
  if (gstin.length !== 15) return false;
  let sum = 0;
  let factor = 2;
  for (let i = 13; i >= 0; i--) {
    const codePoint = CODE_POINT_CHARS.indexOf(gstin[i]);
    if (codePoint < 0) return false;
    let digit = factor * codePoint;
    digit = Math.floor(digit / MOD) + (digit % MOD);
    sum += digit;
    factor = factor === 2 ? 1 : 2;
  }
  const checkCodePoint = (MOD - (sum % MOD)) % MOD;
  return gstin[14] === CODE_POINT_CHARS[checkCodePoint];
}

/** Full validation: structural format AND checksum digit. */
export function isValidGstin(gstin: string): boolean {
  const normalized = gstin.trim().toUpperCase();
  return isValidGstinFormat(normalized) && isValidGstinChecksum(normalized);
}
