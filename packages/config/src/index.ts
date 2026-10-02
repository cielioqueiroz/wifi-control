import { z } from "zod";

export const localApiConfigSchema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.coerce.number().int().min(1).max(65535).default(4317)
});

export type LocalApiConfig = z.infer<typeof localApiConfigSchema>;

export const routerConfigSchema = z.object({
  adapter: z.enum(["unsupported", "huawei-ax2"]).default("unsupported"),
  credentialRef: z.string().min(1).optional(),
  gatewayIp: z.string().ip({ version: "v4" }).default("192.168.3.1"),
  baseUrl: z.string().url().optional()
});

export type RouterConfig = z.infer<typeof routerConfigSchema>;

export function readLocalApiConfig(
  env: NodeJS.ProcessEnv = process.env
): LocalApiConfig {
  return localApiConfigSchema.parse({
    host: env.LOCAL_API_HOST,
    port: env.LOCAL_API_PORT
  });
}

export function readRouterConfig(
  env: NodeJS.ProcessEnv = process.env
): RouterConfig {
  return routerConfigSchema.parse({
    adapter: env.ROUTER_ADAPTER,
    baseUrl: env.ROUTER_BASE_URL,
    credentialRef: env.ROUTER_CREDENTIAL_REF,
    gatewayIp: env.ROUTER_GATEWAY_IP
  });
}

export function isRouterConfigReady(config: RouterConfig): boolean {
  return Boolean(
    config.adapter !== "unsupported" && config.baseUrl && config.credentialRef
  );
}
