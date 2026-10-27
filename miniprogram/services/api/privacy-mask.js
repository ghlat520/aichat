// privacy-mask.js — final transport-boundary PII masking (AC-22).
// Keep the page's in-memory draft intact; only clone and mask the value passed to wx.request.

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MOBILE_PATTERN = /(^|[^\d])(1[3-9]\d{9})(?!\d)/g;

function maskString(value) {
  return value
    .replace(EMAIL_PATTERN, '[EMAIL]')
    .replace(MOBILE_PATTERN, (_match, prefix) => prefix + '[MOBILE]');
}

const PROTOCOL_FIELDS = new Set(['login_code', 'price_version', 'purchase_disclosure_version',
  'client_instance_id', 'policy_version', 'order_id', 'base_order_id', 'report_version',
  'session_id', 'access_token', 'refresh_token', 'signData', 'paySig', 'signature']);

function maskPiiDeep(value, depth = 0) {
  if (typeof value === 'string') {
    return maskString(value);
  }
  if (Array.isArray(value)) {
    return value.map(child => maskPiiDeep(child, depth + 1));
  }
  if (value && typeof value === 'object') {
    const masked = {};
    for (const [key, child] of Object.entries(value)) {
      masked[key] = depth === 0 && PROTOCOL_FIELDS.has(key) ? child : maskPiiDeep(child, depth + 1);
    }
    return masked;
  }
  return value;
}

module.exports = { maskPiiDeep };
