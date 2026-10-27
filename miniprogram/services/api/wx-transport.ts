import type {HttpRequest, HttpResponse, HttpTransport} from './generated/client';
import {maskPiiDeep} from './privacy-mask';

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
        ...(request.body === undefined ? {} : {data: maskPiiDeep(request.body)}),
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
