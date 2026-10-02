import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const device = {
    identity: {
      id: "test-device",
      displayName: "Televisão",
      ip: "192.168.3.42",
      mac: "AA:BB:CC:DD:EE:FF",
      hostname: "TV",
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: "online",
      trustStatus: "unknown",
      privateMac: true,
      manufacturer: null,
      operatingSystem: null,
      deviceType: null
    },
    evidence: [
      {
        confidence: 0.9,
        source: "mdns",
        observedAt: new Date().toISOString(),
        value: {}
      }
    ]
  };
  let blocked = false;
  await page.route("http://127.0.0.1:4317/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path === "/devices") json = { devices: [device], evidence: [] };
    if (path === "/status")
      json = {
        interfaces: [
          {
            address: "192.168.3.10",
            cidr: "192.168.3.10/24",
            gateway: "192.168.3.1",
            name: "Wi-Fi"
          }
        ],
        router: { available: true, model: "Huawei AX2" },
        scanner: { ready: true }
      };
    if (path === "/session") json = { token: "test-token" };
    if (path === "/router/devices")
      json = {
        connected: [
          { hostname: "TV", ip: device.identity.ip, mac: device.identity.mac }
        ],
        blocked: blocked ? [{ mac: device.identity.mac }] : []
      };
    if (path === "/router/audit") json = { actions: [] };
    if (path === "/history") json = { devices: [], events: [] };
    if (path === "/devices/preferences") {
      const body = route.request().postDataJSON() as {
        alias?: string;
        trustStatus?: string;
      };
      if (body.alias) device.identity.displayName = body.alias;
      if (body.trustStatus) device.identity.trustStatus = body.trustStatus;
      json = { ok: true, devices: [device] };
    }
    if (path === "/router/block") {
      blocked = true;
      json = { ok: true };
    }
    await route.fulfill({ json });
  });
});

test("persists names and requires explicit router confirmation", async ({
  page
}) => {
  await page.goto("/");
  await page.getByRole("row").filter({ hasText: "Televisão" }).click();
  await page.getByRole("button", { name: "Renomear dispositivo" }).click();
  await page
    .getByRole("textbox", { name: "Nome do dispositivo" })
    .fill("TV da sala");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "TV da sala" })).toBeVisible();
  await page.getByRole("button", { name: "Bloquear no roteador" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Confirmar", exact: true })
  ).toBeDisabled();
  await dialog.getByLabel("Digite BLOQUEAR para confirmar").fill("BLOQUEAR");
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Desbloquear no roteador" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fechar detalhes", exact: true })
    .last()
    .click();
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "TV da sala" })
  ).toBeVisible();
});

test("desktop and mobile navigation fit the viewport", async ({
  page
}, testInfo) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("row").filter({ hasText: "Televisão" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Visão geral da rede" })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-${width}.png`),
      fullPage: true
    });
    if (width === 390)
      await page.getByLabel("Seção", { exact: true }).selectOption("router");
    else
      await page.getByRole("button", { name: "Roteador", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Roteador Huawei AX2" })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  }
});
