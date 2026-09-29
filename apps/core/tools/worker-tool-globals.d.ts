/**
 * Narrow Worker type shims for Node-based operational tools that import the
 * Core route graph. The generated Worker declarations intentionally stay out
 * of this compiler lane because their web globals conflict with Node's URL
 * and process types.
 */
interface PlatformBindings {
  readonly __toolBindingBrand?: never;
}

interface R2ObjectBody {
  readonly body: ReadableStream;
  readonly key: string;
  readonly httpEtag: string;
  readonly size: number;
  readonly uploaded: Date;
  readonly checksums: { readonly sha256?: ArrayBuffer };
  readonly customMetadata?: Record<string, string>;
  readonly httpMetadata?: Record<string, string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2Bucket {
  put(key: string, value: unknown, options?: unknown): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}
