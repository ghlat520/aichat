import fs from 'node:fs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node contracts/check-auth-contract.mjs <bundled-openapi.json>');
  process.exit(2);
}

const spec = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const operationMethods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
  'trace',
]);
const expectedLevels = ['Public', 'Visitor', 'Principal', 'Internal', 'Operator'];
const stateChangingMethods = new Set(['post', 'put', 'patch', 'delete']);
const errors = [];
const operations = [];

if (spec['x-auth-rule-source'] !== 'contracts/auth-rules.yaml') {
  errors.push('AUTH_RULE_SOURCE_MISSING');
}
if (spec['x-auth-rule-schema-version'] !== 1) {
  errors.push('AUTH_RULE_SCHEMA_VERSION expected=1');
}

const configuredLevels = Object.keys(spec['x-auth-levels'] ?? {}).sort();
if (configuredLevels.join(',') !== [...expectedLevels].sort().join(',')) {
  errors.push(`AUTH_LEVEL_SET expected=${expectedLevels.join(',')} actual=${configuredLevels.join(',')}`);
}

const publicHost = spec.servers?.[0]?.variables?.apiHost?.default;
if (!publicHost) {
  errors.push('PUBLIC_API_HOST_BOUNDARY_MISSING');
}

const schemes = spec.components?.securitySchemes ?? {};
if (spec['x-operator-rbac']?.required_roles_semantics !== 'any_of') {
  errors.push('OPERATOR_ROLE_SEMANTICS must be any_of');
}
for (const requiredScheme of ['opaqueBearer', 'refreshToken', 'wechatPaySignature', 'operatorBearer']) {
  if (!schemes[requiredScheme]) {
    errors.push(`SECURITY_SCHEME_MISSING ${requiredScheme}`);
  }
}
for (const [name, scheme] of Object.entries(schemes)) {
  if (String(scheme.bearerFormat ?? '').toUpperCase() === 'JWT') {
    errors.push(`JWT_FORBIDDEN ${name}`);
  }
}

for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
  if (path.startsWith('/ops/v1/')) {
    const opsHost = pathItem.servers?.[0]?.variables?.opsHost?.default;
    if (!opsHost || opsHost === publicHost) {
      errors.push(`OPS_HOST_BOUNDARY ${path}`);
    }
  }
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!operationMethods.has(method)) continue;

    const label = `${method.toUpperCase()} ${path}`;
    const level = operation['x-auth-level'];
    const security = operation.security;
    const usedSchemes = Array.isArray(security)
      ? security.flatMap((requirement) => Object.keys(requirement))
      : [];

    operations.push({ label, level });

    if (!expectedLevels.includes(level)) {
      errors.push(`AUTH_LEVEL_INVALID ${label}`);
    }
    if (typeof operation['x-domain-owner'] !== 'string' || !operation['x-domain-owner']) {
      errors.push(`DOMAIN_OWNER_MISSING ${label}`);
    }
    if (typeof operation['x-auth-rule-id'] !== 'string' || !operation['x-auth-rule-id']) {
      errors.push(`AUTH_RULE_ID_MISSING ${label}`);
    }
    if (!Array.isArray(security)) {
      errors.push(`SECURITY_UNDECLARED ${label}`);
    }

    if (level === 'Public' && (!Array.isArray(security) || security.length !== 0)) {
      errors.push(`PUBLIC_MUST_BE_ANONYMOUS ${label}`);
    }

    if (level === 'Visitor' || level === 'Principal') {
      const expectedScheme = path === '/api/v1/tokens/refresh' ? 'refreshToken' : 'opaqueBearer';
      if (usedSchemes.length !== 1 || usedSchemes[0] !== expectedScheme) {
        errors.push(`USER_SECURITY_SCHEME ${label} expected=${expectedScheme}`);
      }
      const accepted = operation['x-accepted-auth-levels'];
      if (!Array.isArray(accepted) || accepted.length === 0) {
        errors.push(`ACCEPTED_AUTH_LEVELS_MISSING ${label}`);
      }
      if (level === 'Principal' && (accepted.length !== 1 || accepted[0] !== 'Principal')) {
        errors.push(`PRINCIPAL_MUST_NOT_DOWNGRADE ${label}`);
      }
    }

    if (level === 'Internal') {
      if (usedSchemes.length !== 1 || usedSchemes[0] !== 'wechatPaySignature') {
        errors.push(`INTERNAL_SECURITY_SCHEME ${label}`);
      }
      if (path === '/api/v1/webhooks/wechat-pay' && operation['x-raw-body-required'] !== true) {
        errors.push(`WEBHOOK_RAW_BODY_REQUIRED ${label}`);
      }
      if (path === '/api/v1/webhooks/wechat-pay' && operation['x-idempotency-source'] !== 'provider_event_id') {
        errors.push(`WEBHOOK_IDEMPOTENCY_SOURCE ${label}`);
      }
    }

    if (level === 'Operator') {
      if (usedSchemes.length !== 1 || usedSchemes[0] !== 'operatorBearer') {
        errors.push(`OPERATOR_SECURITY_SCHEME ${label}`);
      }
      if (operation['x-mfa-required'] !== true) {
        errors.push(`OPERATOR_MFA_REQUIRED ${label}`);
      }
      if (!Array.isArray(operation['x-required-roles']) || operation['x-required-roles'].length === 0) {
        errors.push(`OPERATOR_ROLE_REQUIRED ${label}`);
      }
      if (
        typeof operation['x-operator-policy-rule-id'] !== 'string'
        || !operation['x-operator-policy-rule-id']
      ) {
        errors.push(`OPERATOR_POLICY_RULE_ID_MISSING ${label}`);
      }
      const policy = operation['x-approval-policy'];
      if (policy !== undefined) {
        if (
          policy?.type !== 'maker-checker' ||
          !Array.isArray(policy.approver_roles) ||
          policy.approver_roles.length === 0 ||
          (policy.maker_roles !== undefined && (
            !Array.isArray(policy.maker_roles) || policy.maker_roles.length === 0
          )) ||
          policy.requester_must_differ !== true ||
          policy.effect_before_approval !== 'none'
        ) {
          errors.push(`MAKER_CHECKER_POLICY ${label}`);
        }
      }
    } else if (operation['x-operator-policy-rule-id'] !== undefined || operation['x-approval-policy'] !== undefined) {
      errors.push(`OPERATOR_POLICY_ON_NON_OPERATOR ${label}`);
    }

    if (stateChangingMethods.has(method) && path !== '/api/v1/webhooks/wechat-pay') {
      const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
      const hasIdempotencyKey = parameters.some(
        (parameter) =>
          parameter.name === 'Idempotency-Key' ||
          parameter.$ref === '#/components/parameters/IdempotencyKey',
      );
      if (!hasIdempotencyKey) {
        errors.push(`IDEMPOTENCY_KEY_MISSING ${label}`);
      }
    }
  }
}

const counts = Object.fromEntries(
  expectedLevels.map((level) => [level, operations.filter((operation) => operation.level === level).length]),
);

if (errors.length > 0) {
  console.error(`Auth contract verification failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Auth contract verification passed: ${operations.length} operations.`);
console.log(JSON.stringify(counts));
