import { createServer } from "node:http";
import { createReadStream, existsSync, realpathSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const root = realpathSync(
  process.env.WIFI_CONTROL_WEB_ROOT ?? resolve("apps/web/out")
);
const port = Number(process.env.WIFI_CONTROL_WEB_PORT ?? 3001);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};
const server = createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method ?? "")) {
    response.writeHead(405).end();
    return;
  }
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname);
    const candidate = resolve(
      root,
      `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`
    );
    if (!candidate.startsWith(`${root}${sep}`) || !existsSync(candidate)) {
      response.writeHead(404).end("Recurso nao encontrado");
      return;
    }
    const file = realpathSync(candidate);
    if (!file.startsWith(`${root}${sep}`) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": "no-cache"
    });
    if (request.method === "HEAD") response.end();
    else
      createReadStream(file)
        .on("error", () => response.destroy())
        .pipe(response);
  } catch {
    response.writeHead(400).end("Solicitacao invalida");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.info(`WiFi Control: http://127.0.0.1:${port}`)
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => server.close());
