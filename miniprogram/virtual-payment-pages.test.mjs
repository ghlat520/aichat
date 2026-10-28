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

test('order page restore binds for cross-device recovery, not payment', async () => {
  const purposes = [];
  const state = {};
  const growth = { get: () => state, applyServerOrder: () => {} };
  const p = page('order', growth, { bind: async purpose => { purposes.push(purpose); },
    list: async () => ({ items: [], next_cursor: null }) }, {});
  await p.restoreOrders();
  assert.deepEqual(purposes, ['cross_device_recovery']);
  assert.equal(p.data.busy, false);
});

test('reports page restore binds for cross-device recovery, not payment', async () => {
  const purposes = [];
  const p = page('reports', { get: () => ({}) }, { bind: async purpose => { purposes.push(purpose); },
    list: async () => ({ items: [], next_cursor: null }) }, {});
  await p.restorePaid();
  assert.deepEqual(purposes, ['cross_device_recovery']);
});

test('payment page shows the wechat restore entry instead of redirecting when no local order exists', async () => {
  let redirected = 0;
  const p = page('payment', { get: () => ({ order: null }) },
    { getOrder: async () => { throw new Error('should not fetch without a local order'); } },
    { redirectTo: () => { redirected++; } });
  await p.onShow();
  assert.equal(redirected, 0);
  assert.equal(p.data.canRestore, true);
  assert.match(p.data.notice, /微信登录/);
});

test('payment page offers restore when the local order cannot be loaded from the server', async () => {
  const p = page('payment', { get: () => ({ order: { id: 'order-x' } }) },
    { getOrder: async () => { throw new Error('会话已过期，登录后可恢复'); } }, {});
  await p.onShow();
  assert.equal(p.data.canRestore, true);
  assert.match(p.data.notice, /登录后可恢复/);
});

test('payment page restore binds for cross-device recovery and adopts the recovered order', async () => {
  const purposes = [];
  const order = { order_id: 'recovered-order', sku: 'base', price_fen: 2990, payment_state: 'PAID',
    entitlement_state: 'ACTIVE', refund_state: 'NONE', refunded_fen: 0, created_at: '2026-10-27T00:00:00Z' };
  const state = { order: null };
  const growth = { get: () => state,
    applyServerOrder: value => { state.order = { ...value, id: value.order_id }; state.payment = 'success'; } };
  const p = page('payment', growth, { bind: async purpose => { purposes.push(purpose); },
    list: async () => ({ items: [order], next_cursor: null }) }, { redirectTo: () => {} });
  await p.onShow();
  await p.restorePaid();
  assert.deepEqual(purposes, ['cross_device_recovery']);
  assert.equal(p.data.orderId, 'recovered-order');
  assert.equal(p.data.payment, 'success');
  assert.equal(p.data.canRestore, false);
  assert.equal(p.data.busy, false);
});

test('payment page restore keeps the entry when recovery finds no orders', async () => {
  const p = page('payment', { get: () => ({ order: null }) }, { bind: async () => {},
    list: async () => ({ items: [], next_cursor: null }) }, { redirectTo: () => {} });
  await p.onShow();
  await p.restorePaid();
  assert.equal(p.data.canRestore, true);
  assert.match(p.data.notice, /未找到/);
});

test('payment page restore failure keeps the entry and clears the busy flag', async () => {
  const p = page('payment', { get: () => ({ order: null }) },
    { bind: async () => { throw new Error('微信登录未完成'); } }, { redirectTo: () => {} });
  await p.onShow();
  await p.restorePaid();
  assert.equal(p.data.canRestore, true);
  assert.equal(p.data.notice, '微信登录未完成');
  assert.equal(p.data.busy, false);
});

test('payment recovery re-reads the original order even when a newer order exists', async () => {
  const state = { order: { id: 'old-order' } };
  const calls = [];
  const old = { order_id: 'old-order', sku: 'base', price_fen: 2990, payment_state: 'PENDING',
    entitlement_state: 'NONE', refund_state: 'NONE', refunded_fen: 0 };
  const growth = { get: () => state, applyServerOrder: value => { state.order = { ...value, id: value.order_id, product: 'base' }; state.payment = 'pending'; } };
  let bound = false;
  const payment = { bind: async () => { bound = true; }, getOrder: async id => {
    calls.push(id);
    if (!bound) throw new Error('登录后恢复');
    growth.applyServerOrder(old);
  }, list: async () => ({ items: [{ order_id: 'newer-paid' }, old] }) };
  const p = page('payment', growth, payment);
  await p.onShow();
  await p.restorePaid();
  assert.deepEqual(calls, ['old-order', 'old-order']);
  assert.equal(p.data.orderId, 'old-order');
  assert.equal(p.data.payment, 'pending');
});

test('without an original order, multiple recovered orders are chosen from the order list', async () => {
  const state = { order: null };
  let destination = '';
  const p = page('payment', { get: () => state }, { bind: async () => {},
    list: async () => ({ items: [{ order_id: 'new' }, { order_id: 'old' }], next_cursor: null }) },
    { redirectTo: options => { destination = options.url; } });
  await p.onShow();
  await p.restorePaid();
  assert.equal(destination, '/pages/order/order');
  assert.equal(state.order, null);
});

test('payment page cannot query a missing local order', async () => {
  const p = page('payment', { get: () => ({ order: null }) }, {}, {});
  await p.onShow();
  assert.equal(p.data.hasOrder, false);
  await p.queryOrder();
  assert.match(p.data.notice, /没有可查询的订单/);
  assert.match(fs.readFileSync(new URL('./pages/payment/payment.wxml', import.meta.url), 'utf8'), /payment !== 'success' && hasOrder/);
});

test('order recovery retains the selected original order while showing all recovered orders', async () => {
  const original = { order_id: 'old-order', sku: 'base', price_fen: 2990, payment_state: 'PENDING',
    entitlement_state: 'NONE', refund_state: 'NONE', refunded_fen: 0, created_at: '2026-10-27T00:00:00Z' };
  const state = { order: { ...original, id: original.order_id, product: 'base' }, refund: 'none' };
  const calls = [];
  const growth = { get: () => state, applyServerOrder: order => { state.order = { ...order, id: order.order_id, product: 'base' }; } };
  const payment = { bind: async () => {}, getOrder: async id => { calls.push(id); growth.applyServerOrder(original); },
    list: async () => ({ items: [{ ...original, order_id: 'newer-order' }, original], next_cursor: null }) };
  const p = page('order', growth, payment);
  await p.restoreOrders();
  assert.deepEqual(calls, ['old-order']);
  assert.equal(p.data.orderId, 'old-order');
  assert.equal(p.data.orders.length, 2);
});

test('payment recovery stops if the selected order changes while binding', async () => {
  let release, markStarted;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const state = { order: { id: 'old-order' } };
  const calls = [];
  const p = page('payment', { get: () => state }, { bind: async () => { markStarted(); await pending; },
    getOrder: async id => { calls.push(id); }, list: async () => ({ items: [] }) });
  const recovery = p.restorePaid();
  await started;
  state.order = { id: 'new-order' };
  release();
  await recovery;
  assert.deepEqual(calls, []);
  assert.match(p.data.notice, /订单已变化/);
});

test('payment and order pages clear old confirmed display before a failed re-read', async () => {
  const state = { order: { id: 'old-order' } };
  const payment = { getOrder: async () => { throw new Error('登录已变化'); }, list: async () => { throw new Error('登录已变化'); } };
  const paymentPage = page('payment', { get: () => state }, payment);
  paymentPage.setData({ payment: 'success', deliveryText: '有效权益已确认', productLabel: '旧商品', amount: '29.90' });
  await paymentPage.onShow();
  assert.notEqual(paymentPage.data.deliveryText, '有效权益已确认');
  assert.notEqual(paymentPage.data.payment, 'success');
  const orderPage = page('order', { get: () => state }, payment);
  orderPage.setData({ hasGrowthOrder: true, statusLabel: '付款已确认', deliveryText: '报告权益有效' });
  await orderPage.refresh();
  assert.equal(orderPage.data.hasGrowthOrder, false);
  assert.notEqual(orderPage.data.deliveryText, '报告权益有效');
});
