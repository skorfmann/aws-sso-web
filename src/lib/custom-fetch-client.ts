// copied from https://github.com/aws/aws-sdk-js-v3/blob/5ae46f645327216f5f06c5cddc48523ff0d9e19e/packages/fetch-http-handler/src/fetch-http-handler.ts
import { HttpHandler, HttpRequest, HttpResponse } from "@aws-sdk/protocol-http";
import { buildQueryString } from "@aws-sdk/querystring-builder";
import { HeaderBag, HttpHandlerOptions } from "@aws-sdk/types";

export function requestTimeout(timeoutInMs = 0): Promise<never> {
  return new Promise((resolve, reject) => {
    if (timeoutInMs) {
      setTimeout(() => {
        const timeoutError = new Error(`Request did not complete within ${timeoutInMs} ms`);
        timeoutError.name = "TimeoutError";
        reject(timeoutError);
      }, timeoutInMs);
    }
  });
}

declare let AbortController: any;

/**
 * Represents the http options that can be passed to a browser http client.
 */
export interface FetchHttpHandlerOptions {
  /**
   * The number of milliseconds a request can take before being automatically
   * terminated.
   */
  requestTimeout?: number;
}

export class FetchHttpHandler implements HttpHandler {
  private readonly requestTimeout?: number;

  constructor({ requestTimeout }: FetchHttpHandlerOptions = {}) {
    this.requestTimeout = requestTimeout;
  }

  destroy(): void {
    // Do nothing. TLS and HTTP/2 connection pooling is handled by the browser.
  }

  handle(request: HttpRequest, { abortSignal }: HttpHandlerOptions = {}): Promise<{ response: HttpResponse }> {
    const requestTimeoutInMs = this.requestTimeout;

    // if the request was already aborted, prevent doing extra work
    if (abortSignal?.aborted) {
      const abortError = new Error("Request aborted");
      abortError.name = "AbortError";
      return Promise.reject(abortError);
    }

    let path = request.path;
    if (request.query) {
      const queryString = buildQueryString(request.query);
      if (queryString) {
        path += `?${queryString}`;
      }
    }

    const { port, method } = request;
    const url = `${request.protocol}//${request.hostname}${port ? `:${port}` : ""}${path}`;
    // Request constructor doesn't allow GET/HEAD request with body
    // ref: https://github.com/whatwg/fetch/issues/551
    const body = method === "GET" || method === "HEAD" ? undefined : request.body;
    const requestOptions: RequestInit = {
      body,
      headers: new Headers({...request.headers, 'Target-URL': url}),
      method: method,
    };

    // some browsers support abort signal
    if (typeof AbortController !== "undefined") {
      (requestOptions as any)["signal"] = abortSignal;
    }

    // Use local proxy to avoid CORS issues - the actual URL is set in the headers as `Target-URL`
    // This is only required for AWS SSO related requests - All other SDK calls
    // should use the the default fetch client implementation.
    const fetchRequest = new Request('http://127.0.0.1:5174', requestOptions);
    const raceOfPromises = [
      fetch(fetchRequest).then((response) => {
        const fetchHeaders: any = response.headers;
        const transformedHeaders: HeaderBag = {};

        for (const pair of <Array<string[]>>fetchHeaders.entries()) {
          transformedHeaders[pair[0]] = pair[1];
        }

        const hasReadableStream = response.body !== undefined;

        // Return the response with buffered body
        if (!hasReadableStream) {
          return response.blob().then((body) => ({
            response: new HttpResponse({
              headers: transformedHeaders,
              statusCode: response.status,
              body,
            }),
          }));
        }
        // Return the response with streaming body
        return {
          response: new HttpResponse({
            headers: transformedHeaders,
            statusCode: response.status,
            body: response.body,
          }),
        };
      }),
      requestTimeout(requestTimeoutInMs),
    ];
    if (abortSignal) {
      raceOfPromises.push(
        new Promise<never>((resolve, reject) => {
          abortSignal.onabort = () => {
            const abortError = new Error("Request aborted");
            abortError.name = "AbortError";
            reject(abortError);
          };
        })
      );
    }
    return Promise.race(raceOfPromises);
  }
}