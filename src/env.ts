import { z } from "zod";
import { AppError } from "./lib/errors.js";

/**
 * Raw Worker bindings as declared in wrangler.toml (`vars`) plus secrets set via
 * `wrangler secret put`. Everything arrives as strings; `parseEnv` validates and
 * coerces into a typed, trusted `Config`.
 */
export interface Bindings {
  HEALTH_CACHE: KVNamespace;
  // vars
  X402_NETWORK: string;
  X402_PRICE_USD: string;
  X402_FACILITATOR_URL: string;
  CACHE_TTL_SECONDS: string;
  GITHUB_TIMEOUT_MS: string;
  SERVICE_NAME: string;
  SERVICE_DESCRIPTION: string;
  // secrets
  WALLET_ADDRESS: string;
  GITHUB_TOKEN?: string;
  CDP_API_KEY_ID?: string;
  CDP_API_KEY_SECRET?: string;
}

const EvmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "WALLET_ADDRESS must be a 0x-prefixed 40-hex-char EVM address");

const Caip2Network = z
  .string()
  .regex(/^eip155:\d+$/, "X402_NETWORK must be a CAIP-2 eip155 id, e.g. eip155:8453");

const envSchema = z.object({
  X402_NETWORK: Caip2Network,
  X402_PRICE_USD: z.string().regex(/^\$\d+(\.\d+)?$/, "X402_PRICE_USD must look like $0.01"),
  X402_FACILITATOR_URL: z.string().url(),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive(),
  GITHUB_TIMEOUT_MS: z.coerce.number().int().positive(),
  SERVICE_NAME: z.string().min(1),
  SERVICE_DESCRIPTION: z.string().min(1),
  WALLET_ADDRESS: EvmAddress,
  GITHUB_TOKEN: z.string().optional(),
  CDP_API_KEY_ID: z.string().optional(),
  CDP_API_KEY_SECRET: z.string().optional(),
});

/** Validated, typed configuration derived from the raw {@link Bindings}. */
export type Config = z.infer<typeof envSchema> & { HEALTH_CACHE: KVNamespace };

/**
 * Validate raw bindings at request time. Fails loudly with a 500 `AppError`
 * (`config_invalid`) so misconfiguration surfaces immediately rather than as a
 * confusing downstream failure.
 */
export function parseEnv(bindings: Bindings): Config {
  const result = envSchema.safeParse(bindings);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new AppError("config_invalid", `Invalid Worker configuration: ${issues}`, 500);
  }
  if (!bindings.HEALTH_CACHE || typeof bindings.HEALTH_CACHE.get !== "function") {
    throw new AppError("config_invalid", "HEALTH_CACHE KV binding is missing", 500);
  }
  return { ...result.data, HEALTH_CACHE: bindings.HEALTH_CACHE };
}
