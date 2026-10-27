// privacy-mask.js — final transport-boundary PII masking (AC-22).
// Keep the page's in-memory draft intact; only clone and mask the value passed to wx.request.

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MOBILE_PATTERN = /(^|[^\d])(1[3-9]\d{9})(?!\d)/g;

function maskString(value) {
  return value
    .replace(EMAIL_PATTERN, '[EMAIL]')
    .replace(MOBILE_PATTERN, (_match, prefix) => prefix + '[MOBILE]');
}

function maskPiiDeep(value) {
  if (typeof value === 'string') {
    return maskString(value);
  }
  if (Array.isArray(value)) {
    return value.map(maskPiiDeep);
  }
  if (value && typeof value === 'object') {
    const masked = {};
    for (const [key, child] of Object.entries(value)) {
      masked[key] = maskPiiDeep(child);
    }
    return masked;
  }
  return value;
}

module.exports = { maskPiiDeep };
