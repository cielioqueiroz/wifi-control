import { z } from "zod";

export const localApiConfigSchema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.coerce.number().int().min(1).max(65535).default(4317)
});

export type LocalApiConfig = z.infer<typeof localApiConfigSchema>;

export function readLocalApiConfig(
  env: NodeJS.ProcessEnv = process.env
): LocalApiConfig {
  return localApiConfigSchema.parse({
    host: env.LOCAL_API_HOST,
    port: env.LOCAL_API_PORT
  });
}
