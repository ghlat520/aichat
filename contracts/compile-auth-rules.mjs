import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const OPERATION_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);
const AUTH_FIELDS = [
  'security',
  'x-auth-level',
  'x-accepted-auth-levels',
  'x-auth-rule-id',
  'x-mfa-required',
  'x-required-roles',
  'x-operator-policy-rule-id',
  'x-approval-policy',
  'x-risk-level',
  'x-raw-body-required',
];
const LEVEL_SCHEMES = {
  Public: null,
  Visitor: new Set(['opaqueBearer', 'refreshToken']),
  Principal: new Set(['opaqueBearer']),
  Internal: new Set(['wechatPaySignature', 'wechatVirtualPaySignature']),
  Operator: new Set(['operatorBearer']),
};

export class AuthRuleError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'AuthRuleError';
    this.code = code;
  }
}

export function readRules(rulesPath) {
  const source = fs.readFileSync(rulesPath, 'utf8');
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new AuthRuleError(
      'AUTH_RULES_PARSE_ERROR',
      `${rulesPath} 必须使用 YAML 1.2 的 JSON 兼容子集: ${error.message}`,
    );
  }
}

function operationEntries(spec) {
  const entries = [];
  for (const [route, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!OPERATION_METHODS.has(method)) continue;
      entries.push({
        route,
        method: method.toUpperCase(),
        operation,
        operationId: operation.operationId,
        tags: operation.tags ?? [],
        domainOwner: operation['x-domain-owner'],
      });
    }
  }
  return entries;
}

function validateMatch(match, ruleId) {
  if (!match || typeof match !== 'object' || Array.isArray(match)) {
    throw new AuthRuleError('AUTH_RULE_MATCH_INVALID', `${ruleId} 缺少 match 对象`);
  }
  const supported = new Set([
    'methods',
    'path_exact',
    'path_prefix',
    'path_regex',
    'operation_ids',
    'tags',
    'domain_owners',
  ]);
  const keys = Object.keys(match);
  if (keys.length === 0) {
    throw new AuthRuleError('AUTH_RULE_MATCH_EMPTY', `${ruleId} 不允许空匹配器`);
  }
  for (const key of keys) {
    if (!supported.has(key)) {
      throw new AuthRuleError('AUTH_RULE_MATCH_KEY', `${ruleId} 包含不支持的匹配字段 ${key}`);
    }
  }
  if (match.path_regex && (!match.path_regex.startsWith('^') || !match.path_regex.endsWith('$'))) {
    throw new AuthRuleError('AUTH_RULE_REGEX_UNANCHORED', `${ruleId} 的 path_regex 必须同时包含 ^ 和 $`);
  }
}

function matches(entry, match) {
  if (match.methods && !match.methods.map(value => value.toUpperCase()).includes(entry.method)) return false;
  if (match.path_exact && entry.route !== match.path_exact) return false;
  if (match.path_prefix && !entry.route.startsWith(match.path_prefix)) return false;
  if (match.path_regex && !new RegExp(match.path_regex).test(entry.route)) return false;
  if (match.operation_ids && !match.operation_ids.includes(entry.operationId)) return false;
  if (match.tags && !match.tags.some(tag => entry.tags.includes(tag))) return false;
  if (match.domain_owners && !match.domain_owners.includes(entry.domainOwner)) return false;
  return true;
}

function selectRule(entry, rules, kind) {
  const matched = rules.filter(rule => matches(entry, rule.match));
  if (matched.length === 0) return undefined;
  matched.sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  if (matched.length > 1 && matched[0].priority === matched[1].priority) {
    throw new AuthRuleError(
      'AUTH_RULE_AMBIGUOUS',
      `${entry.method} ${entry.route} 同时命中 ${kind} 规则 ${matched[0].id} 和 ${matched[1].id}`,
    );
  }
  return matched[0];
}

function validateRules(rules) {
  if (rules.schema_version !== 1) {
    throw new AuthRuleError('AUTH_RULE_VERSION', 'schema_version 必须为 1');
  }
  if (rules.defaults?.unmatched !== 'deny') {
    throw new AuthRuleError('AUTH_RULE_DEFAULT', '未匹配接口必须默认 deny');
  }
  if (rules.defaults?.operator_role_semantics !== 'any_of') {
    throw new AuthRuleError('AUTH_RULE_ROLE_SEMANTICS', 'Operator 角色语义必须为 any_of');
  }
  for (const [kind, collection] of [
    ['classification', rules.classification_rules],
    ['operator-policy', rules.operator_policy_rules],
  ]) {
    if (!Array.isArray(collection) || collection.length === 0) {
      throw new AuthRuleError('AUTH_RULE_COLLECTION', `${kind} 规则不能为空`);
    }
    const ids = new Set();
    for (const rule of collection) {
      if (!rule.id || ids.has(rule.id)) {
        throw new AuthRuleError('AUTH_RULE_ID', `${kind} 规则 ID 缺失或重复: ${rule.id}`);
      }
      ids.add(rule.id);
      if (!Number.isInteger(rule.priority)) {
        throw new AuthRuleError('AUTH_RULE_PRIORITY', `${rule.id} 的 priority 必须是整数`);
      }
      validateMatch(rule.match, rule.id);
    }
  }
}

function validateClassificationPolicy(rule) {
  const policy = rule.policy;
  const allowedSchemes = LEVEL_SCHEMES[policy?.level];
  if (allowedSchemes === undefined) {
    throw new AuthRuleError('AUTH_RULE_LEVEL', `${rule.id} 的鉴权等级无效`);
  }
  if (!Array.isArray(policy.accepted_levels) || policy.accepted_levels.length === 0) {
    throw new AuthRuleError('AUTH_RULE_ACCEPTED_LEVELS', `${rule.id} 必须声明 accepted_levels`);
  }
  if (policy.accepted_levels.some(level => !Object.hasOwn(LEVEL_SCHEMES, level))) {
    throw new AuthRuleError('AUTH_RULE_ACCEPTED_LEVELS', `${rule.id} 包含无效 accepted_levels`);
  }
  if (!policy.accepted_levels.includes(policy.level)) {
    throw new AuthRuleError('AUTH_RULE_ACCEPTED_LEVELS', `${rule.id} 必须接受自身鉴权等级`);
  }
  if (policy.level === 'Public' && policy.security_scheme !== null) {
    throw new AuthRuleError('AUTH_RULE_PUBLIC_SCHEME', `${rule.id} 的 Public 规则不得配置凭证`);
  }
  if (policy.level !== 'Public' && !allowedSchemes.has(policy.security_scheme)) {
    throw new AuthRuleError(
      'AUTH_RULE_SCHEME',
      `${rule.id} 的 ${policy.level} 不允许使用 ${policy.security_scheme}`,
    );
  }
  if (policy.level === 'Principal' && policy.accepted_levels.join(',') !== 'Principal') {
    throw new AuthRuleError('AUTH_RULE_PRINCIPAL_DOWNGRADE', `${rule.id} 不得允许 Principal 降级`);
  }
  if (['Public', 'Internal', 'Operator'].includes(policy.level)
      && policy.accepted_levels.join(',') !== policy.level) {
    throw new AuthRuleError('AUTH_RULE_ACCEPTED_LEVELS', `${rule.id} 的 accepted_levels 必须仅为 ${policy.level}`);
  }
  if (policy.level === 'Visitor'
      && policy.accepted_levels.some(level => !['Visitor', 'Principal'].includes(level))) {
    throw new AuthRuleError('AUTH_RULE_ACCEPTED_LEVELS', `${rule.id} 的 Visitor 规则只能接受 Visitor/Principal`);
  }
  if (policy.level === 'Operator' && policy.mfa_required !== true) {
    throw new AuthRuleError('AUTH_RULE_OPERATOR_MFA', `${rule.id} 必须启用 MFA`);
  }
}

function validateOperatorPolicy(rule) {
  if (!Array.isArray(rule.roles) || rule.roles.length === 0
      || rule.roles.some(role => typeof role !== 'string' || role.length === 0)) {
    throw new AuthRuleError('AUTH_RULE_OPERATOR_ROLES', `${rule.id} 必须声明非空 roles`);
  }
  if (rule.risk_level !== undefined && rule.risk_level !== 'high') {
    throw new AuthRuleError('AUTH_RULE_RISK_LEVEL', `${rule.id} 的 risk_level 只允许 high`);
  }
  if (rule.approval !== undefined) {
    if (
      rule.approval.type !== 'maker-checker'
      || !Array.isArray(rule.approval.approver_roles)
      || rule.approval.approver_roles.length === 0
      || rule.approval.approver_roles.some(role => typeof role !== 'string' || role.length === 0)
      || (rule.approval.maker_roles !== undefined && (
        !Array.isArray(rule.approval.maker_roles)
        || rule.approval.maker_roles.length === 0
        || rule.approval.maker_roles.some(role => typeof role !== 'string' || role.length === 0)
      ))
    ) {
      throw new AuthRuleError('AUTH_RULE_APPROVAL', `${rule.id} 的审批策略无效`);
    }
  }
  if (rule.risk_level === 'high' && !rule.approval) {
    throw new AuthRuleError('AUTH_RULE_HIGH_RISK_APPROVAL', `${rule.id} 的高风险操作缺少审批策略`);
  }
}

function assertSourceHasNoOperationAuth(entries) {
  const violations = [];
  for (const entry of entries) {
    for (const field of AUTH_FIELDS) {
      if (Object.hasOwn(entry.operation, field)) {
        violations.push(`${entry.method} ${entry.route} -> ${field}`);
      }
    }
  }
  if (violations.length > 0) {
    throw new AuthRuleError(
      'MANUAL_OPERATION_AUTH_FORBIDDEN',
      `接口源码不得逐项配置鉴权；请修改 auth-rules.yaml:\n${violations.join('\n')}`,
    );
  }
}

function applyClassification(entry, rule) {
  const policy = rule.policy;
  entry.operation['x-auth-rule-id'] = rule.id;
  entry.operation['x-auth-level'] = policy.level;
  if (policy.level === 'Visitor' || policy.level === 'Principal') {
    entry.operation['x-accepted-auth-levels'] = [...policy.accepted_levels];
  }
  entry.operation.security = policy.security_scheme === null ? [] : [{[policy.security_scheme]: []}];
  if (policy.mfa_required === true) entry.operation['x-mfa-required'] = true;
  if (policy.raw_body_required === true) entry.operation['x-raw-body-required'] = true;
}

function applyOperatorPolicy(entry, rule) {
  entry.operation['x-operator-policy-rule-id'] = rule.id;
  entry.operation['x-required-roles'] = [...rule.roles];
  if (rule.risk_level) entry.operation['x-risk-level'] = rule.risk_level;
  if (rule.approval) {
    entry.operation['x-approval-policy'] = {
      type: 'maker-checker',
      ...(rule.approval.maker_roles ? {maker_roles: [...rule.approval.maker_roles]} : {}),
      approver_roles: [...rule.approval.approver_roles],
      requester_must_differ: true,
      effect_before_approval: 'none',
    };
  }
}

export function compileAuthRules(sourceSpec, rules) {
  validateRules(rules);
  rules.classification_rules.forEach(validateClassificationPolicy);
  rules.operator_policy_rules.forEach(validateOperatorPolicy);
  const spec = structuredClone(sourceSpec);
  const entries = operationEntries(spec);
  assertSourceHasNoOperationAuth(entries);

  const counts = {Public: 0, Visitor: 0, Principal: 0, Internal: 0, Operator: 0};
  for (const entry of entries) {
    if (!entry.operationId) {
      throw new AuthRuleError('AUTH_RULE_OPERATION_ID', `${entry.method} ${entry.route} 缺少 operationId`);
    }
    const classification = selectRule(entry, rules.classification_rules, 'classification');
    if (!classification) {
      throw new AuthRuleError(
        'AUTH_RULE_UNMATCHED',
        `${entry.method} ${entry.route} 未命中任何中央鉴权规则，默认拒绝`,
      );
    }
    applyClassification(entry, classification);
    counts[classification.policy.level] += 1;

    if (classification.policy.level === 'Operator') {
      const operatorPolicy = selectRule(entry, rules.operator_policy_rules, 'operator-policy');
      if (!operatorPolicy) {
        throw new AuthRuleError(
          'AUTH_RULE_OPERATOR_POLICY_UNMATCHED',
          `${entry.method} ${entry.route} 已归类为 Admin，但没有命中中央 RBAC 规则`,
        );
      }
      applyOperatorPolicy(entry, operatorPolicy);
    }
  }

  spec['x-auth-rule-source'] = 'contracts/auth-rules.yaml';
  spec['x-auth-rule-schema-version'] = rules.schema_version;
  return {spec, counts, operationCount: entries.length};
}

function main() {
  const [sourcePath, rulesPath, outputPath] = process.argv.slice(2);
  if (!sourcePath || !rulesPath || !outputPath) {
    console.error('Usage: node contracts/compile-auth-rules.mjs <bundled-source.json> <auth-rules.yaml> <compiled-openapi.json>');
    process.exit(2);
  }
  const sourceSpec = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const rules = readRules(rulesPath);
  const result = compileAuthRules(sourceSpec, rules);
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, `${JSON.stringify(result.spec, null, 2)}\n`);
  console.log(`Compiled auth rules for ${result.operationCount} operations.`);
  console.log(JSON.stringify(result.counts));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
