// scripts/e2e/celebrity-walkthrough.mjs — 名人共鸣卡视觉走查（一次性）
// 前置：开发者工具已开自动化端口（cli auto --project miniprogram --auto-port 9420）与 CDP 服务端口
// 用法：node scripts/e2e/celebrity-walkthrough.mjs
// 截图输出：docs/e2e-screenshots/celebrity-walkthrough-{result,via-mbti}.png
import { Launcher } from '@weapp-vite/miniprogram-automator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CdpUi } from './cdp-ui.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOT_DIR = path.join(ROOT, 'docs/e2e-screenshots');
const AUTO_PORT = process.env.AUTO_PORT || 9420;
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(SHOT_DIR, { recursive: true });

const mini = await new Launcher().connect({ wsEndpoint: `ws://127.0.0.1:${AUTO_PORT}` });
const ui = new CdpUi({ port: CDP_PORT });

async function shot(route, name) {
  const file = path.join(SHOT_DIR, `celebrity-walkthrough-${name}.png`);
  fs.writeFileSync(file, await ui.screenshot(route));
  console.log('saved:', file);
}

// 1) MBTI 结果页（介绍页“先看 ENTP 结果样例”直达，不必答满 40 题）
await mini.reLaunch('/pages/growth-intro/growth-intro?tool=mbti');
await sleep(1800);
let page = await mini.currentPage();
await page.callMethod('openSample');
for (let i = 0; i < 20; i += 1) {
  await sleep(500);
  page = await mini.currentPage();
  if (String(page.path).includes('growth-result')) break;
}
console.log('result page:', page.path);
const celebrity = await page.$('.mbti-r-celebrity');
if (!celebrity) throw new Error('结果页未见名人卡 .mbti-r-celebrity');
const names = await page.$$('.mbti-r-celebrity-name');
console.log('ENTP 名人位:', names.length, '（应为 4）');
const prompt = await page.$('.mbti-r-celebrity-prompt');
console.log('引导句:', (await prompt.text()).slice(0, 24) + '…');
await shot(page.path, 'result');

// 2) via-mbti 对照表（ENTP 筛选）
await mini.reLaunch('/pages/via-mbti/via-mbti?code=ENTP');
await sleep(2200);
page = await mini.currentPage();
console.log('via-mbti page:', page.path);
const card = await page.$('.vc-celebrity');
if (!card) throw new Error('对照表未见名人卡 .vc-celebrity');
const vcNames = await page.$$('.vc-celebrity-name');
console.log('ENTP 对照卡名人数:', vcNames.length, '（应为 4）');
const vcPrompt = await page.$('.vc-celebrity-prompt');
console.log('引导句:', (await vcPrompt.text()).slice(0, 24) + '…');
await shot(page.path, 'via-mbti');

mini.disconnect();
console.log('走查完成：两处名人卡均渲染并截图');
