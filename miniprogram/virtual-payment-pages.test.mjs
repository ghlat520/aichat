import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CONTENT = require('./growth-content.js');

function page(name, growth, payment, wx = {}) {
  let definition;
  const context = { Page: value => { definition = value; }, wx,
    require: id => id.includes('growth-store') ? { getGrowth: () => growth }
      : id.includes('virtual-payment') ? { getVirtualPayment: () => payment }
        : id.includes('growth-content') ? CONTENT : { friendlyError: e => e.message } };
  vm.runInNewContext(fs.readFileSync(new URL(`./pages/${name}/${name}.js`, import.meta.url), 'utf8'), context);
  return { ...definition, data: structuredClone(definition.data), setData(value) { Object.assign(this.data, value); } };
}

test('checkout can resume the first payment of an order that the server never signed', async () => {
  const state = { product: 'base', results: {}, goals: [], order: null };
  const order = { order_id: 'existing-order', sku: 'base', payment_state: 'PENDING', payment_started: false, price_fen: 2990 };
  let purchased = 0;
  const growth = { get: () => state, purchaseSnapshot: () => ({}), applyServerOrder: value => { state.order = value; } };
  const payment = { assertSupported: () => {}, bind: async () => {}, quote: async () => ({ sku: 'base', existing_order: order, price_fen: 2990 }),
    purchase: async () => { purchased++; } };
  const p = page('checkout', growth, payment, { showModal: o => o.success({ confirm: true }), redirectTo: () => {} });
  p.product = 'base'; p.snapshot = {};
  await p.loadQuote(); await p.confirmPurchase();
  assert.equal(purchased, 1);
});

test('checkout sends a different-SKU unfinished order to its status page without a payment modal', async () => {
  const state = { product: 'base', results: {}, goals: [] };
  let purchases = 0;
  const order = { order_id: 'old-career', sku: 'career', payment_state: 'PENDING', payment_started: false, price_fen: 4990 };
  const growth = { get: () => state, applyServerOrder: value => { state.order = value; } };
  const payment = { assertSupported: () => {}, bind: async () => {},
    quote: async () => ({ sku: 'base', existing_order: order, price_fen: 2990 }), purchase: async () => { purchases++; } };
  const p = page('checkout', growth, payment, { redirectTo: () => {}, showModal: () => { throw new Error('unexpected payment modal'); } });
  p.product = 'base'; p.snapshot = {}; p.setData({ quoteReady: true });
  await p.confirmPurchase();
  assert.equal(purchases, 0);
  assert.equal(state.order.order_id, order.order_id);
  assert.equal(p.data.error, '');
});

test('checkout applies the iOS compatibility check before binding the account', async () => {
  let binds = 0;
  const p = page('checkout', {}, { assertSupported: () => { throw new Error('iOS 端需微信 8.0.68 及以上版本'); },
    bind: async () => { binds++; } });
  p.setData({ quoteReady: true });
  await p.confirmPurchase();
  assert.equal(binds, 0);
  assert.match(p.data.error, /8.0.68/);
});

test('purchased report uses its own frozen version and never attaches another draft calibration', async () => {
  const state = { order: { id: 'old-order' }, version: '1.1', calibrated: true,
    calibrationText: 'correction belonging to another draft', results: {}, goals: [], experiences: [] };
  const snapshot = { confirmed: true, results: { traits: true }, goals: ['original goal'],
    experiences: [{ event: 'original experience' }] };
  const p = page('growth-report', { get: () => state }, { readReport: async () => ({ snapshot,
    report_version: 'growth-v1', order: { created_at: '2026-10-27T00:00:00Z' } }) },
    { setNavigationBarTitle: () => {}, showToast: () => {} });
  await p.onShow();
  assert.equal(p.data.version, 'growth-v1');
  assert.equal(p.data.calibrated, false);
  assert.equal(p.data.calibrationText, '');
  assert.equal(p.data.experiences[0].event, 'original experience');
});

test('purchased reports can follow the existing cursor past unpaid recent orders', async () => {
  const calls = [];
  const paid = { order_id: 'older-paid', payment_state: 'PAID', entitlement_state: 'ACTIVE', refund_state: 'NONE',
    sku: 'base', report_version: 'growth-v1', created_at: '2026-10-27T00:00:00Z' };
  const p = page('reports', {}, { list: async cursor => { calls.push(cursor); return cursor
    ? { items: [paid], next_cursor: null } : { items: [], next_cursor: 'first-page-last-id' }; } });
  await p.loadPaid();
  assert.equal(p.data.nextCursor, 'first-page-last-id');
  await p.morePaid();
  assert.equal(p.data.paidItems[0].id, 'older-paid');
  assert.equal(calls.length, 2);
});
