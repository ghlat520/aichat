#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = process.env.AICHAT_ENV_FILE || resolve(root, '.env.local');
// Parse dotenv literally: JDBC ampersands and secret values must never become shell code.
const env = { ...parseEnv(readFileSync(envFile, 'utf8')), ...process.env };
for (const key of ['AICHAT_DB_URL', 'AICHAT_DB_USERNAME', 'AICHAT_DB_PASSWORD', 'AICHAT_SESSION_TOKEN_KEY', 'AICHAT_CONTENT_MASTER_KEY']) {
  if (!env[key]) throw new Error('本地配置缺少 ' + key);
}
const database = new URL(env.AICHAT_DB_URL.replace(/^jdbc:/, ''));
if (database.protocol !== 'mysql:' || !['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) || database.pathname !== '/aichat') {
  throw new Error('本地启动仅连接 loopback 地址下的 aichat schema');
}
const queryCredentials = [...database.searchParams.keys()].some(key => /^(user|username|password[123]?)$/i.test(key));
if (/[\s"'\\]/.test(env.AICHAT_DB_URL) || database.username || database.password || queryCredentials) {
  throw new Error('JDBC URL 请使用 URI 编码，用户名和密码使用独立 AICHAT_DB_* 字段');
}
const port = Number(env.AICHAT_PORT || 18088);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('AICHAT_PORT 必须是 1024–65535 的端口');
env.AICHAT_VIRTUAL_PAY_ENABLED = 'false';
// An explicit Flyway URL creates its own connection; keep credentials in env, never CLI.
env.SPRING_DATASOURCE_USERNAME = env.SPRING_FLYWAY_USER = env.AICHAT_DB_USERNAME;
env.SPRING_DATASOURCE_PASSWORD = env.SPRING_FLYWAY_PASSWORD = env.AICHAT_DB_PASSWORD;
console.log('AIChat local: http://127.0.0.1:' + port + ' · MySQL schema: aichat · virtual payment: disabled');
const child = spawn('mvn', [
  '--file', resolve(root, 'server/pom.xml'), '--batch-mode', '--no-transfer-progress',
  'spring-boot:run', '-Dspring-boot.run.profiles=local',
  '-Dspring-boot.run.arguments=--server.address=127.0.0.1 --server.port=' + port +
    ' --aichat.virtual-pay.enabled=false --spring.datasource.url=' + env.AICHAT_DB_URL +
    ' --spring.flyway.url=' + env.AICHAT_DB_URL + ' --spring.flyway.schemas=aichat --spring.flyway.default-schema=aichat'
], { cwd: root, env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error('无法启动 Maven：' + error.code); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 130 : 1); });
