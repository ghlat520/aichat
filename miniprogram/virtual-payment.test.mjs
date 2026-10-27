import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createVirtualPayment } = require('./services/virtual-payment.js');
const { createGrowthStore } = require('./growth-store.js');
const { maskPiiDeep } = require('./services/api/privacy-mask.js');

function setup(changes = {}) {
  const saved = {};
  const growth = createGrowthStore({ getStorageSync: k => saved[k], setStorageSync: (k, v) => { saved[k] = v; } });
  let session = { accessToken: 'test', level: 'Visitor' };
  const calls = [];
  const order = { order_id: '01M00000000000000000000000', sku: 'base', price_fen: 2990,
    payment_state: 'PENDING', refund_state: 'NONE', entitlement_state: 'NONE', refunded_fen: 0 };
  const quote = { sku: 'base', price_fen: 2990, price_version: 'test-price', purchase_disclosure_version: 'personal-virtual-pay-v1', existing_order: null };
  const api = {
    bindWechatIdentity: async body => { calls.push(['bind', body]); return { data: { bound: true } }; },
    quoteVirtualPurchase: async body => { calls.push(['quote', body]); return { data: quote }; },
    createVirtualOrder: async body => { calls.push(['create', body]); return { data: order }; },
    prepareVirtualPayment: async id => { calls.push(['sign', id]); return { data: { mode: 'short_series_goods', signData: '{"goodsPrice":2990}', paySig: 'fake-pay-sig', signature: 'fake-user-sig' } }; },
    queryVirtualPayment: async id => { calls.push(['query', id]); return { data: order }; },
    getVirtualOrder: async () => ({ data: order }),
    getPurchasedGrowthSnapshot: async () => ({ data: { order, snapshot: { experiences: [{ event: 'frozen old input' }] }, report_version: 'growth-v1' } }),
    listVirtualOrders: async () => ({ data: { items: [order], next_cursor: null } }),
    ...changes.api
  };
  const wxApi = {
    getSystemInfoSync: () => ({ platform: 'android', version: '8.0.68' }),
    login: options => options.success({ code: 'code_13800138000_preserve_exact' }),
    requestVirtualPayment: options => { calls.push(['native', options]); options.success({}); },
    ...changes.wx
  };
  const payment = createVirtualPayment({ wxApi, api, state: { accept: growth.applyServerOrder,
    bound: () => growth.patch({ bound: true }), notice: message => growth.patch({ paymentNotice: message }),
    pending: message => growth.patch({ payment: 'pending', paymentNotice: message }), preparationKey: growth.paymentPreparationKey },
    loadEntitlement: id => api.getPurchasedGrowthSnapshot(id), ensureSession: async () => {},
    getSession: () => session, setSession: value => { session = value; } });
  return { payment, growth, order, quote, calls, saved, session: () => session };
}

test('native success alone keeps the report locked and queries only the original order', async () => {
  const f = setup();
  await f.payment.purchase({ product: 'base', snapshot: {}, quote: f.quote });
  assert.equal(f.growth.canReadBase(), false);
  assert.equal(f.growth.get().payment, 'pending');
  assert.equal(f.calls.filter(c => c[0] === 'native').length, 1);
  assert.equal(f.calls.find(c => c[0] === 'query')[1], f.order.order_id);
  assert.equal(f.session().level, 'Principal');
  assert.equal(f.calls.find(c => c[0] === 'bind')[1].login_code, 'code_13800138000_preserve_exact');
});

test('query failure keeps the original order and never reports success or retries native payment', async () => {
  const f = setup({ api: { queryVirtualPayment: async () => { throw new Error('查询暂不可用'); } } });
  await f.payment.purchase({ product: 'base', snapshot: {}, quote: f.quote });
  assert.equal(f.growth.get().order.id, f.order.order_id);
  assert.equal(f.growth.get().payment, 'pending');
  assert.equal(f.growth.canReadBase(), false);
  assert.match(f.growth.get().paymentNotice, /查询暂不可用/);
});

test('confirmed server entitlement unlocks; frozen report input does not replace the current draft', async () => {
  const f = setup();
  Object.assign(f.order, { payment_state: 'PAID', entitlement_state: 'ACTIVE', paid_fen: 2990 });
  f.growth.setExperience(0, 'event', 'new draft');
  await f.payment.query(f.order.order_id);
  assert.equal(f.growth.canReadBase(), true);
  const report = await f.payment.readEntitlement(f.order.order_id);
  assert.equal(report.snapshot.experiences[0].event, 'frozen old input');
  assert.equal(f.growth.get().experiences[0].event, 'new draft');
});

test('an existing pending order is displayed without signing or opening native payment again', async () => {
  const f = setup();
  f.order.payment_started = true;
  f.quote.existing_order = f.order;
  await f.payment.purchase({ product: 'base', snapshot: {}, quote: f.quote });
  assert.equal(f.calls.some(c => ['create', 'native', 'sign'].includes(c[0])), false);
  assert.equal(f.growth.get().order.id, f.order.order_id);
});

test('an existing order that was never signed starts its first payment using the same order', async () => {
  const f = setup();
  f.order.payment_started = false;
  f.quote.existing_order = f.order;
  await f.payment.purchase({ product: 'base', snapshot: {}, quote: f.quote });
  assert.equal(f.calls.some(c => c[0] === 'create'), false);
  assert.equal(f.calls.filter(c => c[0] === 'native').length, 1);
  assert.equal(f.calls.find(c => c[0] === 'sign')[1], f.order.order_id);
});

test('an existing or concurrently returned different SKU cannot launch payment for the requested product', async () => {
  for (const existing of [true, false]) {
    const f = setup();
    Object.assign(f.order, { sku: 'career', price_fen: 4990, payment_started: false });
    if (existing) f.quote.existing_order = f.order;
    const result = await f.payment.purchase({ product: 'base', snapshot: {}, quote: f.quote });
    assert.equal(result.order_id, f.order.order_id);
    assert.equal(f.calls.some(c => c[0] === 'native' || c[0] === 'sign'), false);
  }
});

test('confirmed refund is displayed as refunded instead of pending delivery', () => {
  const f = setup();
  f.growth.applyServerOrder({ ...f.order, payment_state: 'PAID', refund_state: 'COMPLETED', entitlement_state: 'REVOKED', refunded_fen: 2990 });
  assert.equal(f.growth.get().payment, 'refunded');
});

test('a lost signing response is retrieved once with the same key before any native invocation', async () => {
  const keys = [];
  let prepareCalls = 0;
  const f = setup({ api: { prepareVirtualPayment: async (_id, options) => {
    keys.push(options.idempotencyKey);
    if (++prepareCalls === 1) throw new Error('network response lost');
    return { data: { mode: 'short_series_goods', signData: '{}', paySig: 'fake', signature: 'fake' } };
  } } });
  await f.payment.purchase({ product: 'base', snapshot: {}, quote: f.quote });
  assert.equal(prepareCalls, 2);
  assert.equal(keys[0], keys[1]);
  assert.equal(f.calls.filter(c => c[0] === 'native').length, 1);
});

test('a changed authoritative price needs fresh user confirmation before creating any order', async () => {
  const f = setup();
  await assert.rejects(f.payment.purchase({ product: 'base', snapshot: {}, quote: { ...f.quote, price_version: 'stale' } }), /报价已变化/);
  assert.equal(f.calls.some(c => c[0] === 'create'), false);
});

test('unsupported native API stops before order creation', async () => {
  const f = setup({ wx: { requestVirtualPayment: undefined } });
  await assert.rejects(f.payment.purchase({ product: 'base', snapshot: {}, quote: f.quote }), /微信版本/);
  assert.equal(f.calls.length, 0);
});

test('iOS WeChat below 8.0.68 stops before login or order creation', async () => {
  const f = setup({ wx: { getSystemInfoSync: () => ({ platform: 'ios', version: '8.0.67' }) } });
  await assert.rejects(f.payment.purchase({ product: 'base', snapshot: {}, quote: f.quote }), /8.0.68/);
  assert.equal(f.calls.length, 0);
});

test('iOS WeChat 8.0.68 and a higher minor version can enter the verified payment flow', async () => {
  for (const version of ['8.0.68', '8.1.0']) {
    const f = setup({ wx: { getSystemInfoSync: () => ({ platform: 'ios', version }) } });
    await f.payment.purchase({ product: 'base', snapshot: {}, quote: f.quote });
    assert.equal(f.calls.filter(c => c[0] === 'native').length, 1);
    assert.equal(f.growth.canReadBase(), false);
  }
});

test('stored paid flags never restore an entitlement without a new server check', () => {
  const f = setup();
  f.growth.patch({ paid: true, careerPaid: true, bound: true, payment: 'success' });
  const g = createGrowthStore({ getStorageSync: k => f.saved[k], setStorageSync: () => {} });
  assert.equal(g.canReadBase(), false);
  assert.equal(g.get().careerPaid, false);
  assert.equal(g.get().bound, false);
});

test('PII masking preserves protocol identifiers but still masks private text', () => {
  const body = maskPiiDeep({ login_code: 'wx_13800138000_code', price_version: 'a13800138000b',
    snapshot: { experiences: [{ event: '联系 13800138000 和 person@example.com', login_code: '13800138000' }] } });
  assert.equal(body.login_code, 'wx_13800138000_code');
  assert.equal(body.price_version, 'a13800138000b');
  assert.equal(body.snapshot.experiences[0].event, '联系 [MOBILE] 和 [EMAIL]');
  assert.equal(body.snapshot.experiences[0].login_code, '[MOBILE]');
});
