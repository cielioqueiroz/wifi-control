export interface RouterInfo {
  id: string;
  model: string;
  vendor: string;
  gatewayIp: string;
  supportsBlocking: boolean;
}

export interface RouterDevice {
  ip: string | null;
  mac: string;
  hostname: string | null;
}

export interface RouterActionResult {
  ok: boolean;
  reason?: string;
}

export interface RouterAdapter {
  getInfo(): Promise<RouterInfo>;
  listConnectedDevices(): Promise<RouterDevice[]>;
  listBlockedDevices(): Promise<RouterDevice[]>;
  blockDevice(mac: string): Promise<RouterActionResult>;
  unblockDevice(mac: string): Promise<RouterActionResult>;
}

export class UnsupportedRouterAdapter implements RouterAdapter {
  getInfo(): Promise<RouterInfo> {
    return Promise.resolve({
      gatewayIp: "192.168.3.1",
      id: "unsupported-huawei-ax2",
      model: "WiFi AX2",
      supportsBlocking: false,
      vendor: "Huawei"
    });
  }

  listConnectedDevices(): Promise<RouterDevice[]> {
    return Promise.resolve([]);
  }

  listBlockedDevices(): Promise<RouterDevice[]> {
    return Promise.resolve([]);
  }

  blockDevice(): Promise<RouterActionResult> {
    return Promise.resolve({
      ok: false,
      reason:
        "Router integration is unavailable until legitimate access is configured."
    });
  }

  unblockDevice(): Promise<RouterActionResult> {
    return Promise.resolve({
      ok: false,
      reason:
        "Router integration is unavailable until legitimate access is configured."
    });
  }
}

export class MockRouterAdapter extends UnsupportedRouterAdapter {}
