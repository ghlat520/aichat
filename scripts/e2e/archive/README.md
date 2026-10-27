# Historical E2E scripts

This directory keeps superseded runners and diagnostics for traceability. The
`*-false-green-*` files are not valid acceptance evidence. The
`growth-smoke-v12.mjs` and `growth-shots-v12.mjs` files describe the historical
V1.2 UI baseline and relied on local mock payment methods that were removed by
personal virtual-payment integration; they cannot run against the current app.
Their previously captured screenshots and results remain historical evidence.

Current runners are `../run-all.mjs`, `../smoke-pages.mjs`, and
`npm run smoke:virtual-pay`. Native verification still requires a working WeChat
DevTools environment and never implies a real payment was performed.
