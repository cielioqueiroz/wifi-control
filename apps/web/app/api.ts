export const AGENT_URL =
  process.env.NEXT_PUBLIC_LOCAL_AGENT_URL ?? "http://127.0.0.1:4317";

export async function readApi<T>(path: string): Promise<T> {
  const response = await fetch(`${AGENT_URL}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(90_000)
  });
  if (!response.ok)
    throw new Error("Não foi possível consultar o agente local.");
  return response.json() as Promise<T>;
}

export async function writeApi<T>(path: string, body: unknown): Promise<T> {
  const { token } = await readApi<{ token: string }>("/session");
  const response = await fetch(`${AGENT_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-wifi-control-token": token
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000)
  });
  const result = (await response.json()) as { error?: string; reason?: string };
  if (!response.ok)
    throw new Error(
      result.reason ?? result.error ?? "Não foi possível salvar a alteração."
    );
  return result as T;
}
