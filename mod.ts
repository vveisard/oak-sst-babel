/**
 * (Oak)[https://deno.land/x/oak] middleware for just-in-time server-side transformation (SST) of JavaScript and TypeScript (including jsx and tsx) using (Babel)[https://babeljs.io/].
 *
 * @module
 */

import {
  convertBodyToBodyInit,
  join,
  type Middleware,
  transformAsync,
  type TransformOptions,
} from "./deps.ts";

// @region-begin

const jsMimeTypes = new Set<string | undefined>(
  ["js", ".js", "text/javascript"],
);
const tsMimeTypes = new Set<string | undefined>(
  ["ts", ".ts", "mts", ".mts", "video/mp2t"],
);
const tsxMimeTypes = new Set<string | undefined>(["tsx", ".tsx"]);
const jsxMimeTypes = new Set<string | undefined>(["jsx", ".jsx", "text/jsx"]);

interface MiddlewareOptions {
  readonly absoluteRootDirPath: string;
  readonly transformOptions: Omit<TransformOptions, "sourceRoot">;
}

/**
 * Create middleware which transforms js, jsx, ts and tsx files using Babel before serving.
 */
const createSstBabelMiddleware = (
  options: MiddlewareOptions,
): Middleware => {
  const decoder = new TextDecoder();

  return async (ctx, next) => {
    await next();

    // TODO options for type matcher function
    if (
      !jsMimeTypes.has(ctx.response.type) &&
      !tsMimeTypes.has(ctx.response.type) &&
      !jsxMimeTypes.has(ctx.response.type) &&
      !tsxMimeTypes.has(ctx.response.type)
    ) {
      return;
    }

    const absoluteSourceFilePath = join(
      options.absoluteRootDirPath,
      ctx.request.url.pathname,
    );

    if (ctx.response.body == null) {
      // skip
    } else if (typeof ctx.response.body === "string") {
      // major fast path
      const code = ctx.response.body;
      const result = await transformAsync(
        code,
        {
          ...options.transformOptions,
          sourceRoot: options.absoluteRootDirPath,
          filename: absoluteSourceFilePath,
        },
      );
      ctx.response.body = result?.code;
    } else if (ctx.response.body instanceof Uint8Array) {
      // major fast path
      const code = decoder.decode(ctx.response.body);
      const result = await transformAsync(
        code,
        {
          ...options.transformOptions,
          sourceRoot: options.absoluteRootDirPath,
          filename: absoluteSourceFilePath,
        },
      );
      ctx.response.body = result?.code;
    } else {
      // fallback
      const [responseInit] = await convertBodyToBodyInit(ctx.response.body);
      const code = await new Response(responseInit).text();
      const result = await transformAsync(
        code,
        {
          ...options.transformOptions,
          sourceRoot: options.absoluteRootDirPath,
          filename: absoluteSourceFilePath,
        },
      );
      ctx.response.body = result?.code;
    }

    ctx.response.type = ".js";
  };
};

export { createSstBabelMiddleware };

// @region-end
