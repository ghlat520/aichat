import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {AuthRuleError, compileAuthRules, readRules} from './compile-auth-rules.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const rules = readRules(path.join(directory, 'auth-rules.yaml'));

function sourceSpec(entries) {
  return {
    openapi: '3.1.1',
    paths: Object.fromEntries(entries.map(({route, method = 'get', operationId, extra = {}}) => [
      route,
      {
        [method]: {
          operationId,
          tags: ['Test'],
          'x-domain-owner': 'Test',
          responses: {'200': {description: 'ok'}},
          ...extra,
        },
      },
    ])),
  };
}

test('classifies new public, private, internal and admin operations by central convention', () => {
  const source = sourceSpec([
    {route: '/public/v1/ping', operationId: 'ping'},
    {route: '/api/v1/new-capability', operationId: 'getNewCapability'},
    {route: '/api/v1/webhooks/provider', method: 'post', operationId: 'acceptProviderWebhook'},
    {route: '/ops/v1/catalog/new-capability', operationId: 'getOpsNewCapability'},
  ]);

  const {spec, counts} = compileAuthRules(source, rules);
  assert.deepEqual(counts, {Public: 1, Visitor: 1, Principal: 0, Internal: 1, Operator: 1});
  assert.equal(spec.paths['/public/v1/ping'].get['x-auth-level'], 'Public');
  assert.equal(spec.paths['/api/v1/new-capability'].get['x-auth-level'], 'Visitor');
  assert.deepEqual(spec.paths['/api/v1/new-capability'].get['x-accepted-auth-levels'], ['Visitor', 'Principal']);
  assert.equal(spec.paths['/api/v1/webhooks/provider'].post['x-auth-level'], 'Internal');
  assert.deepEqual(spec.paths['/api/v1/webhooks/provider'].post.security, [{wechatPaySignature: []}]);
  assert.equal(spec.paths['/ops/v1/catalog/new-capability'].get['x-auth-level'], 'Operator');
  assert.deepEqual(spec.paths['/ops/v1/catalog/new-capability'].get['x-required-roles'], ['product-admin']);
});

test('denies an operation outside every classification rule', () => {
  const source = sourceSpec([{route: '/unclassified', operationId: 'unclassified'}]);
  assert.throws(
    () => compileAuthRules(source, rules),
    error => error instanceof AuthRuleError && error.code === 'AUTH_RULE_UNMATCHED',
  );
});

test('denies an admin operation without an RBAC domain rule', () => {
  const source = sourceSpec([{route: '/ops/v1/unknown', operationId: 'unknownOps'}]);
  assert.throws(
    () => compileAuthRules(source, rules),
    error => error instanceof AuthRuleError && error.code === 'AUTH_RULE_OPERATOR_POLICY_UNMATCHED',
  );
});

test('rejects operation-level manual auth configuration', () => {
  const source = sourceSpec([{
    route: '/api/v1/new-capability',
    operationId: 'manualAuth',
    extra: {'x-auth-level': 'Public'},
  }]);
  assert.throws(
    () => compileAuthRules(source, rules),
    error => error instanceof AuthRuleError && error.code === 'MANUAL_OPERATION_AUTH_FORBIDDEN',
  );
});

test('rejects equal-priority ambiguous rules', () => {
  const ambiguousRules = structuredClone(rules);
  ambiguousRules.classification_rules.push({
    id: 'ambiguous-private-default',
    priority: 100,
    match: {path_exact: '/api/v1/new-capability'},
    policy: {
      level: 'Visitor',
      accepted_levels: ['Visitor', 'Principal'],
      security_scheme: 'opaqueBearer',
    },
  });
  const source = sourceSpec([{route: '/api/v1/new-capability', operationId: 'ambiguous'}]);
  assert.throws(
    () => compileAuthRules(source, ambiguousRules),
    error => error instanceof AuthRuleError && error.code === 'AUTH_RULE_AMBIGUOUS',
  );
});
