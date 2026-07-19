import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node contracts/generate-api-skeleton.mjs <bundled-openapi.json>');
  process.exit(2);
}

const spec = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (spec['x-auth-rule-source'] !== 'contracts/auth-rules.yaml') {
  throw new Error('Input must be contracts/openapi.generated.json compiled from central auth rules.');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const javaRoot = path.join(
  root,
  'server/src/main/java/com/aichat',
);
const miniRoot = path.join(root, 'miniprogram/services/api');
const operationMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);
const stateChangingMethods = new Set(['post', 'put', 'patch', 'delete']);

function resolveRef(value) {
  if (!value?.$ref) return value;
  const parts = value.$ref.replace(/^#\//, '').split('/');
  return parts.reduce((current, part) => current[part], spec);
}

function upperSnake(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[- ]/g, '_').toUpperCase();
}

function lowerCamel(value) {
  const converted = value
    .replace(/^[^A-Za-z]+/, '')
    .replace(/[-_ ]+([A-Za-z0-9])/g, (_, character) => character.toUpperCase());
  return converted.charAt(0).toLowerCase() + converted.slice(1);
}

function javaString(value) {
  return JSON.stringify(String(value));
}

function javaArray(values, mapper) {
  return `{${(values ?? []).map(mapper).join(', ')}}`;
}

function authAccepted(operation) {
  return operation['x-accepted-auth-levels'] ?? [operation['x-auth-level']];
}

function allOperations() {
  const result = [];
  for (const [route, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operationMethods.has(method)) continue;
      result.push({route, pathItem, method, operation});
    }
  }
  return result;
}

function resolvedParameters(pathItem, operation) {
  const seen = new Set();
  const result = [];
  for (const source of [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]) {
    const parameter = resolveRef(source);
    const key = `${parameter.in}:${parameter.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(parameter);
    }
  }
  return result;
}

function javaType(parameter) {
  const schema = resolveRef(parameter.schema ?? {});
  const name = lowerCamel(parameter.name);
  let type = 'String';
  if (schema.type === 'integer') type = 'Integer';
  if (schema.type === 'boolean') type = 'Boolean';
  if (schema.type === 'array') type = 'List<String>';

  return {name, type};
}

function javaParameter(parameter) {
  const {name, type} = javaType(parameter);

  if (parameter.in === 'path') {
    return `@PathVariable(${javaString(parameter.name)}) ${type} ${name}`;
  }
  if (parameter.in === 'query') {
    return `@RequestParam(name = ${javaString(parameter.name)}, required = ${parameter.required === true}) ${type} ${name}`;
  }
  if (parameter.in === 'header') {
    return `@RequestHeader(name = ${javaString(parameter.name)}, required = ${parameter.required === true}) ${type} ${name}`;
  }
  throw new Error(`Unsupported parameter location: ${parameter.in}`);
}

function plainJavaParameter(parameter) {
  const {name, type} = javaType(parameter);
  return `${type} ${name}`;
}

function requestSchemaName(operation) {
  const schema = operation.requestBody?.content?.['application/json']?.schema;
  if (!schema) return undefined;
  if (schema.$ref) return schema.$ref.split('/').at(-1);
  throw new Error(`Inline request schema is not supported for ${operation.operationId}`);
}

function mappingAnnotation(method, route) {
  const annotation = {
    get: 'GetMapping',
    post: 'PostMapping',
    put: 'PutMapping',
    patch: 'PatchMapping',
    delete: 'DeleteMapping',
  }[method];
  return `@${annotation}(${javaString(route)})`;
}

function tagPackage(tag) {
  return tag === 'Public' ? 'publicapi' : tag.toLowerCase();
}

function successStatusAnnotation(operation) {
  const successStatus = Object.keys(operation.responses ?? {})
    .filter(status => /^2\d\d$/.test(status))
    .sort()[0];
  if (successStatus === '201') return '@ResponseStatus(HttpStatus.CREATED)';
  if (successStatus === '202') return '@ResponseStatus(HttpStatus.ACCEPTED)';
  if (successStatus === '204') return '@ResponseStatus(HttpStatus.NO_CONTENT)';
  return undefined;
}

function controllerSource(tag, operations) {
  const className = `${tag}ApiController`;
  const delegateName = `${tag}ApiDelegate`;
  const packageName = `com.aichat.${tagPackage(tag)}.api`;
  const methods = operations.map(({route, pathItem, method, operation}) => {
    const resolved = resolvedParameters(pathItem, operation);
    const parameters = resolved.map(javaParameter);
    const delegateArguments = [
      'ApiCallContext.from(httpRequest)',
      ...resolved.map(parameter => javaType(parameter).name),
    ];
    const schemaName = requestSchemaName(operation);
    if (schemaName) {
      if (operation.operationId === 'acceptWechatPayWebhook') {
        parameters.push('@RequestBody byte[] rawBody');
        delegateArguments.push('rawBody');
      } else {
        parameters.push(`@Valid @RequestBody ContractRequests.${schemaName} request`);
        delegateArguments.push('request');
      }
    }
    parameters.push('HttpServletRequest httpRequest');

    const authLevel = upperSnake(operation['x-auth-level']);
    const accepted = javaArray(authAccepted(operation), value => `AuthLevel.${upperSnake(value)}`);
    const roles = javaArray(operation['x-required-roles'] ?? [], javaString);
    const authPolicy = `@AuthPolicy(ruleId = ${javaString(operation['x-auth-rule-id'])}, operatorPolicyRuleId = ${javaString(operation['x-operator-policy-rule-id'] ?? '')}, level = AuthLevel.${authLevel}, accepted = ${accepted}, roles = ${roles}, mfaRequired = ${operation['x-mfa-required'] === true}, rawBodyRequired = ${operation['x-raw-body-required'] === true})`;
    const contractOperation = `@ContractOperation(operationId = ${javaString(operation.operationId)}, domainOwner = ${javaString(operation['x-domain-owner'])})`;
    const approval = operation['x-approval-policy'];
    const makerChecker = approval
      ? `\n    @MakerChecker(makerRoles = ${javaArray(approval.maker_roles ?? [], javaString)}, approverRoles = ${javaArray(approval.approver_roles, javaString)}, requesterMustDiffer = ${approval.requester_must_differ === true}, effectBeforeApproval = ${approval.effect_before_approval !== 'none'})`
      : '';
    const responseStatus = successStatusAnnotation(operation);
    const formattedParameters = parameters.length === 0
      ? ''
      : `\n            ${parameters.join(',\n            ')}\n    `;

    return `    ${mappingAnnotation(method, route)}
${responseStatus ? `    ${responseStatus}\n` : ''}    ${contractOperation}
    ${authPolicy}${makerChecker}
    public ApiEnvelope<Map<String, Object>> ${operation.operationId}(${formattedParameters}) {
        return delegate.${operation.operationId}(${delegateArguments.join(', ')});
    }`;
  }).join('\n\n');

  return `// Generated by contracts/generate-api-skeleton.mjs. Do not edit manually.
package ${packageName};

import com.aichat.contract.ContractRequests;
import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.api.ApiEnvelope;
import com.aichat.kernel.auth.AuthLevel;
import com.aichat.kernel.auth.AuthPolicy;
import com.aichat.kernel.auth.ContractOperation;
import com.aichat.kernel.auth.MakerChecker;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Validated
@RestController
public class ${className} {
    private final ${delegateName} delegate;

    public ${className}(ObjectProvider<${delegateName}> delegateProvider) {
        this.delegate = delegateProvider.getIfAvailable(() -> new ${delegateName}() { });
    }

${methods}
}
`;
}

function delegateSource(tag, operations) {
  const delegateName = `${tag}ApiDelegate`;
  const packageName = `com.aichat.${tagPackage(tag)}.api`;
  const methods = operations.map(({pathItem, operation}) => {
    const parameters = [
      'ApiCallContext context',
      ...resolvedParameters(pathItem, operation).map(plainJavaParameter),
    ];
    const schemaName = requestSchemaName(operation);
    if (schemaName) {
      parameters.push(operation.operationId === 'acceptWechatPayWebhook'
        ? 'byte[] rawBody'
        : `ContractRequests.${schemaName} request`);
    }
    const formattedParameters = `\n            ${parameters.join(',\n            ')}\n    `;
    return `    default ApiEnvelope<Map<String, Object>> ${operation.operationId}(${formattedParameters}) {
        return SkeletonResponses.notImplemented(${javaString(operation.operationId)});
    }`;
  }).join('\n\n');

  return `// Generated by contracts/generate-api-skeleton.mjs. Do not edit manually.
package ${packageName};

import com.aichat.contract.ContractRequests;
import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.api.ApiEnvelope;
import com.aichat.kernel.api.SkeletonResponses;

import java.util.List;
import java.util.Map;

public interface ${delegateName} {

${methods}
}
`;
}

function writeControllers(operations) {
  const groups = Map.groupBy(operations, entry => entry.operation.tags?.[0] ?? 'Uncategorized');
  for (const [tag, entries] of groups) {
    const directory = path.join(javaRoot, tagPackage(tag), 'api');
    fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(path.join(directory, `${tag}ApiController.java`), controllerSource(tag, entries));
    fs.writeFileSync(path.join(directory, `${tag}ApiDelegate.java`), delegateSource(tag, entries));
  }
}

function tsType(schema) {
  schema = resolveRef(schema ?? {});
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map(value => JSON.stringify(value)).join(' | ');
  if (Array.isArray(schema.type)) {
    return schema.type.map(type => type === 'null' ? 'null' : tsType({...schema, type})).join(' | ');
  }
  if (schema.type === 'string') return 'string';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'array') return `Array<${tsType(schema.items)}>`;
  if (schema.type === 'object' || schema.properties) {
    if (!schema.properties) {
      const valueType = typeof schema.additionalProperties === 'object'
        ? tsType(schema.additionalProperties)
        : 'unknown';
      return `Record<string, ${valueType}>`;
    }
    const required = new Set(schema.required ?? []);
    const fields = Object.entries(schema.properties)
      .map(([name, property]) => `  ${name}${required.has(name) ? '' : '?'}: ${tsType(property)};`)
      .join('\n');
    return `{\n${fields}\n}`;
  }
  if (schema.$ref) return schema.$ref.split('/').at(-1);
  return 'unknown';
}

function tsTypesSource(operations) {
  const included = new Set(['Ulid']);
  operations
    .filter(entry => !['Internal', 'Operator'].includes(entry.operation['x-auth-level']))
    .map(entry => requestSchemaName(entry.operation))
    .filter(Boolean)
    .forEach(name => included.add(name));
  const definitions = Object.entries(spec.components?.schemas ?? {})
    .filter(([name]) => included.has(name))
    .map(([name, schema]) => `export type ${name} = ${tsType(schema)};`)
    .join('\n\n');

  return `// Generated by contracts/generate-api-skeleton.mjs. Do not edit manually.
export interface ApiMeta {
  api_version: 'v1';
}

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface ApiEnvelope<T> {
  request_id: string;
  data: T | null;
  error: ApiError | null;
  meta: ApiMeta;
}

${definitions}
`;
}

function tsPathExpression(route, pathParameters) {
  let expression = JSON.stringify(route);
  for (const parameter of pathParameters) {
    expression = `${expression}.replace(${JSON.stringify(`{${parameter.name}}`)}, encodeURIComponent(String(${lowerCamel(parameter.name)})))`;
  }
  return expression;
}

function tsQueryType(parameters) {
  if (parameters.length === 0) return undefined;
  const fields = parameters.map(parameter => {
    const schema = resolveRef(parameter.schema ?? {});
    return `${parameter.name}${parameter.required ? '' : '?'}: ${tsType(schema)}`;
  });
  return `{ ${fields.join('; ')} }`;
}

function tsClientMethod({route, pathItem, method, operation}) {
  const parameters = resolvedParameters(pathItem, operation);
  const pathParameters = parameters.filter(parameter => parameter.in === 'path');
  const queryParameters = parameters.filter(parameter => parameter.in === 'query');
  const argumentsList = pathParameters.map(parameter => `${lowerCamel(parameter.name)}: ${tsType(resolveRef(parameter.schema))}`);
  const schemaName = requestSchemaName(operation);
  if (schemaName) argumentsList.push(`request: Types.${schemaName}`);
  const queryType = tsQueryType(queryParameters);
  if (queryType) argumentsList.push(`query: ${queryType} = {}`);
  argumentsList.push('options: ApiRequestOptions = {}');

  const body = schemaName ? 'request' : 'undefined';
  const query = queryType ? 'query' : 'undefined';
  const credential = route === '/api/v1/tokens/refresh'
    ? 'refresh'
    : operation['x-auth-level'] === 'Public' ? 'none' : 'access';
  const accepted = JSON.stringify(authAccepted(operation));
  const needsIdempotency = stateChangingMethods.has(method) && route !== '/api/v1/webhooks/wechat-pay';

  return `  ${operation.operationId}(${argumentsList.join(', ')}): Promise<Types.ApiEnvelope<Record<string, unknown>>> {
    const path = ${tsPathExpression(route, pathParameters)};
    return this.invoke(${JSON.stringify(method.toUpperCase())}, path, ${body}, ${query}, ${JSON.stringify(credential)}, ${accepted}, ${needsIdempotency}, options);
  }`;
}

function tsClientSource(operations) {
  const methods = operations
    .filter(entry => !['Internal', 'Operator'].includes(entry.operation['x-auth-level']))
    .map(tsClientMethod)
    .join('\n\n');

  return `// Generated by contracts/generate-api-skeleton.mjs. Do not edit manually.
import type * as Types from './types';

export type ClientAuthLevel = 'Visitor' | 'Principal';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ClientIdentity {
  accessToken: string;
  level: ClientAuthLevel;
}

export interface TokenProvider {
  getIdentity(): Promise<ClientIdentity | undefined>;
  getRefreshToken(): Promise<string | undefined>;
}

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface HttpResponse<T> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

export interface HttpTransport {
  request<T>(request: HttpRequest): Promise<HttpResponse<T>>;
}

export interface ApiRequestOptions {
  idempotencyKey?: string;
  requestId?: string;
}

export interface AiChatApiClientOptions {
  apiBaseUrl: string;
  transport: HttpTransport;
  tokenProvider: TokenProvider;
  idempotencyKeyFactory?: () => string;
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly apiError: Types.ApiError,
    readonly requestId?: string,
  ) {
    super(apiError.message);
    this.name = 'ApiClientError';
  }
}

export class AiChatApiClient {
  private readonly apiBaseUrl: string;
  private readonly transport: HttpTransport;
  private readonly tokenProvider: TokenProvider;
  private readonly idempotencyKeyFactory?: () => string;

  constructor(options: AiChatApiClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\\/$/, '');
    this.transport = options.transport;
    this.tokenProvider = options.tokenProvider;
    this.idempotencyKeyFactory = options.idempotencyKeyFactory;
  }

${methods}

  private async invoke<T extends Record<string, unknown>>(
    method: HttpMethod,
    path: string,
    body: unknown,
    query: Record<string, unknown> | undefined,
    credential: 'none' | 'access' | 'refresh',
    acceptedLevels: ReadonlyArray<string>,
    idempotencyRequired: boolean,
    options: ApiRequestOptions,
  ): Promise<Types.ApiEnvelope<T>> {
    const headers: Record<string, string> = {'Content-Type': 'application/json'};
    if (options.requestId) headers['X-Request-ID'] = this.safeHeader(options.requestId, 'requestId');

    if (credential === 'access') {
      const identity = await this.tokenProvider.getIdentity();
      if (!identity || !acceptedLevels.includes(identity.level)) {
        throw new Error(\`需要以下身份之一: \${acceptedLevels.join(', ')}\`);
      }
      headers.Authorization = \`Bearer \${this.safeHeader(identity.accessToken, 'accessToken')}\`;
    } else if (credential === 'refresh') {
      const refreshToken = await this.tokenProvider.getRefreshToken();
      if (!refreshToken) throw new Error('缺少刷新令牌');
      headers['X-Refresh-Token'] = this.safeHeader(refreshToken, 'refreshToken');
    }

    if (idempotencyRequired) {
      const key = options.idempotencyKey ?? this.idempotencyKeyFactory?.();
      if (!key) throw new Error('写请求必须提供 Idempotency-Key 或 idempotencyKeyFactory');
      headers['Idempotency-Key'] = this.safeHeader(key, 'idempotencyKey');
    }

    const response = await this.transport.request<Types.ApiEnvelope<T>>({
      method,
      url: this.apiBaseUrl + path + this.queryString(query),
      headers,
      ...(body === undefined ? {} : {body}),
    });
    if (response.status >= 400 || response.body.error) {
      const error = response.body.error ?? {
        code: 'HTTP_ERROR',
        message: \`HTTP \${response.status}\`,
        retryable: response.status >= 500,
      };
      throw new ApiClientError(response.status, error, response.body.request_id);
    }
    return response.body;
  }

  private queryString(query: Record<string, unknown> | undefined): string {
    if (!query) return '';
    const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null);
    if (entries.length === 0) return '';
    return '?' + entries
      .map(([key, value]) => \`\${encodeURIComponent(key)}=\${encodeURIComponent(String(value))}\`)
      .join('&');
  }

  private safeHeader(value: string, field: string): string {
    if (!value || /[\\r\\n]/.test(value)) throw new Error(\`\${field} 不是安全的 Header 值\`);
    return value;
  }
}
`;
}

function wxTransportSource() {
  return `import type {HttpRequest, HttpResponse, HttpTransport} from './generated/client';

export interface WxRequestSuccess {
  statusCode: number;
  data: unknown;
  header?: Record<string, string>;
}

export interface WxLike {
  request(options: {
    url: string;
    method: string;
    header: Record<string, string>;
    data?: unknown;
    success(result: WxRequestSuccess): void;
    fail(error: {errMsg?: string}): void;
  }): void;
}

export class WxTransport implements HttpTransport {
  constructor(private readonly wxApi: WxLike) {}

  request<T>(request: HttpRequest): Promise<HttpResponse<T>> {
    return new Promise((resolve, reject) => {
      this.wxApi.request({
        url: request.url,
        method: request.method,
        header: request.headers,
        ...(request.body === undefined ? {} : {data: request.body}),
        success(result) {
          resolve({
            status: result.statusCode,
            headers: result.header ?? {},
            body: result.data as T,
          });
        },
        fail(error) {
          reject(new Error(error.errMsg ?? '微信网络请求失败'));
        },
      });
    });
  }
}
`;
}

function writeMiniProgram(operations) {
  const generated = path.join(miniRoot, 'generated');
  fs.mkdirSync(generated, {recursive: true});
  fs.writeFileSync(path.join(generated, 'types.ts'), tsTypesSource(operations));
  fs.writeFileSync(path.join(generated, 'client.ts'), tsClientSource(operations));
  fs.writeFileSync(path.join(miniRoot, 'wx-transport.ts'), wxTransportSource());
  fs.writeFileSync(path.join(miniRoot, 'index.ts'), `export * from './generated/types';\nexport * from './generated/client';\nexport * from './wx-transport';\n`);
}

const operations = allOperations();
writeControllers(operations);
writeMiniProgram(operations);

console.log(`Generated ${operations.length} Spring operations and ${operations.filter(entry => !['Internal', 'Operator'].includes(entry.operation['x-auth-level'])).length} mini-program operations.`);
