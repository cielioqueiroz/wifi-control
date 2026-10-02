"use client";

import {
  Check,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Clock3,
  History,
  Laptop,
  MonitorSmartphone,
  Network,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Sparkles,
  Wifi,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { StatusBadge } from "@wifi-control/ui";

type DeviceStatus = "online" | "offline" | "unknown";
type TrustStatus = "unknown" | "trusted" | "blocked";
type ConnectionState = "loading" | "ready" | "offline" | "error";
type DeviceFilter = "all" | DeviceStatus;

interface ApiDevice {
  identity: {
    deviceType: string | null;
    displayName: string;
    firstSeenAt: string;
    hostname: string | null;
    id: string;
    ip: string | null;
    lastSeenAt: string;
    manufacturer: string | null;
    mac: string | null;
    operatingSystem: string | null;
    privateMac: boolean;
    status: DeviceStatus;
    trustStatus: TrustStatus;
  };
  evidence: Array<{
    confidence: number;
    observedAt: string;
    source: string;
    value: unknown;
  }>;
}

interface DevicesResponse {
  devices: ApiDevice[];
  evidence: unknown[];
}

interface AgentStatus {
  interfaces: Array<{
    address: string;
    cidr: string | null;
    gateway: string | null;
    name: string;
  }>;
  router: { available: boolean; model: string | null };
  scanner: { endpoint: string; platform: string; ready: boolean };
}

interface Notice {
  tone: "info" | "warning" | "error";
  title: string;
  message: string;
}

const AGENT_URL =
  process.env.NEXT_PUBLIC_LOCAL_AGENT_URL ?? "http://127.0.0.1:4317";

export default function Dashboard(): JSX.Element {
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DeviceFilter>("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setConnectionState("loading");
    }
    setNotice(null);

    try {
      const [devicesResult, statusResult] = await Promise.allSettled([
        requestJson<DevicesResponse>("/devices", "devices"),
        requestJson<AgentStatus>("/status", "status")
      ]);

      if (devicesResult.status === "rejected") {
        setConnectionState(
          devicesResult.reason instanceof TypeError ? "offline" : "error"
        );
        setDevices([]);
        setAgentStatus(null);
        setNotice({
          message:
            devicesResult.reason instanceof TypeError
              ? "O agente local não respondeu. Verifique se ele está em execução."
              : "O agente retornou um erro ao carregar os dispositivos.",
          title:
            devicesResult.reason instanceof TypeError
              ? "Agente offline"
              : "Falha na leitura",
          tone: "error"
        });
        return;
      }

      setDevices(devicesResult.value.devices.map(normalizeDevice));
      setConnectionState("ready");

      if (statusResult.status === "fulfilled") {
        setAgentStatus(statusResult.value);
      } else {
        setAgentStatus(null);
        setNotice({
          message:
            "Os dispositivos foram carregados, mas o resumo da interface de rede não está disponível.",
          title: "Visão parcial",
          tone: "warning"
        });
      }
    } catch (error) {
      setConnectionState(error instanceof TypeError ? "offline" : "error");
      setNotice({
        message: "Não foi possível montar a visão da rede.",
        title: "Dashboard indisponível",
        tone: "error"
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const selectedDevice = devices.find(
    (device) => device.identity.id === selectedId
  );
  const filteredDevices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return devices.filter((device) => {
      const identity = device.identity;
      const matchesFilter = filter === "all" || identity.status === filter;
      const searchable = [
        identity.displayName,
        identity.ip,
        identity.mac,
        identity.hostname,
        identity.manufacturer
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesFilter &&
        (!normalizedQuery || searchable.includes(normalizedQuery))
      );
    });
  }, [devices, filter, query]);

  const metrics = useMemo(() => {
    const online = devices.filter(
      (device) => device.identity.status === "online"
    ).length;
    const unknown = devices.filter(
      (device) => device.identity.status === "unknown"
    ).length;
    const privateMacs = devices.filter(
      (device) => device.identity.privateMac
    ).length;

    return { online, privateMacs, total: devices.length, unknown };
  }, [devices]);

  function renameDevice(deviceId: string, displayName: string): void {
    const cleanName = displayName.trim();

    if (!cleanName) {
      return;
    }

    setDevices((current) =>
      current.map((device) =>
        device.identity.id === deviceId
          ? {
              ...device,
              identity: { ...device.identity, displayName: cleanName }
            }
          : device
      )
    );
    setNotice({
      message:
        "O nome foi aplicado nesta sessão local. A persistência chega com o histórico.",
      title: "Nome atualizado",
      tone: "info"
    });
  }

  function setTrust(deviceId: string, trustStatus: TrustStatus): void {
    setDevices((current) =>
      current.map((device) =>
        device.identity.id === deviceId
          ? {
              ...device,
              identity: { ...device.identity, trustStatus }
            }
          : device
      )
    );
    setNotice({
      message: "A classificação foi aplicada nesta sessão local.",
      title:
        trustStatus === "trusted"
          ? "Dispositivo confiável"
          : "Dispositivo bloqueado",
      tone: trustStatus === "trusted" ? "info" : "warning"
    });
  }

  return (
    <main className="dashboard-shell">
      <Sidebar />
      <section className="dashboard-main">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark small">
              <Wifi size={15} />
            </span>
            <span className="brand-name">WiFi Control</span>
          </div>
          <div className="breadcrumb">
            <span className="eyebrow">LOCAL NETWORK</span>
            <ChevronRight size={14} />
            <span>Overview</span>
          </div>
          <div className="topbar-actions">
            <span className={`agent-pill ${connectionState}`}>
              <span className="status-dot" />
              {connectionState === "offline" ? "Agent offline" : "Agent local"}
            </span>
            <button
              aria-label="Atualizar descoberta"
              className={`icon-button ${isRefreshing ? "is-spinning" : ""}`}
              disabled={isRefreshing || connectionState === "loading"}
              onClick={() => void loadDashboard(true)}
              title="Atualizar descoberta"
              type="button"
            >
              <RefreshCw size={16} />
            </button>
            <span className="avatar">CQ</span>
          </div>
        </header>

        <div className="content-wrap">
          <section className="page-heading reveal reveal-one">
            <div>
              <p className="eyebrow">NETWORK / HOME OFFICE</p>
              <h1>Network overview</h1>
              <p className="lede">
                Um retrato local, legível e sem suposições sobre quem está na
                sua rede.
              </p>
            </div>
            <div className="network-chip">
              <span className="signal-icon">
                <Network size={17} />
              </span>
              <span>
                <small>ACTIVE SEGMENT</small>
                <strong>{getNetworkLabel(agentStatus)}</strong>
              </span>
              <span className="chip-state">LOCAL</span>
            </div>
          </section>

          {notice ? (
            <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
          ) : null}

          <section
            aria-label="Resumo da rede"
            className="metrics-grid reveal reveal-two"
          >
            <MetricCard
              detail="last scan"
              icon={<MonitorSmartphone size={17} />}
              label="Discovered devices"
              value={metrics.total}
            />
            <MetricCard
              detail="responding"
              icon={<Sparkles size={17} />}
              label="Online now"
              tone="mint"
              value={metrics.online}
            />
            <MetricCard
              detail="identity unknown"
              icon={<CircleHelp size={17} />}
              label="Needs review"
              tone="amber"
              value={metrics.unknown}
            />
            <MetricCard
              detail="manufacturer hidden"
              icon={<ShieldAlert size={17} />}
              label="Private MACs"
              tone="coral"
              value={metrics.privateMacs}
            />
          </section>

          <section className="overview-strip reveal reveal-three">
            <div className="strip-item">
              <span className="strip-icon">
                <Server size={16} />
              </span>
              <span>
                <small>GATEWAY</small>
                <strong>
                  {agentStatus?.interfaces[0]?.gateway ?? "Not detected"}
                </strong>
              </span>
            </div>
            <div className="strip-item">
              <span className="strip-icon">
                <Wifi size={16} />
              </span>
              <span>
                <small>INTERFACE</small>
                <strong>
                  {agentStatus?.interfaces[0]?.name ?? "Waiting for agent"}
                </strong>
              </span>
            </div>
            <div className="strip-item">
              <span className="strip-icon">
                <Clock3 size={16} />
              </span>
              <span>
                <small>LAST OBSERVED</small>
                <strong>
                  {connectionState === "ready" ? "Just now" : "Awaiting scan"}
                </strong>
              </span>
            </div>
            <div className="strip-action">
              <span>
                <small>ROUTER CONTROL</small>
                <strong>Unavailable</strong>
              </span>
              <ShieldOff size={17} />
            </div>
          </section>

          <section className="devices-section reveal reveal-four">
            <div className="section-heading">
              <div>
                <p className="eyebrow">OBSERVATIONS</p>
                <h2>Devices on your network</h2>
              </div>
              <div className="table-tools">
                <label className="search-box">
                  <Search size={16} />
                  <span className="sr-only">Buscar dispositivos</span>
                  <input
                    aria-label="Buscar dispositivos"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search device, IP or MAC"
                    value={query}
                  />
                </label>
                <span className="tool-divider" />
                <SlidersHorizontal size={16} />
                <div
                  aria-label="Filtrar dispositivos"
                  className="filter-group"
                  role="group"
                >
                  {(
                    ["all", "online", "unknown", "offline"] as DeviceFilter[]
                  ).map((option) => (
                    <button
                      className={
                        filter === option
                          ? "filter-button active"
                          : "filter-button"
                      }
                      key={option}
                      onClick={() => setFilter(option)}
                      type="button"
                    >
                      {option === "all" ? "All" : option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {connectionState === "loading" ? <LoadingTable /> : null}
            {connectionState !== "loading" &&
            connectionState === "ready" &&
            devices.length === 0 ? (
              <EmptyState onRefresh={() => void loadDashboard(true)} />
            ) : null}
            {connectionState !== "loading" && connectionState !== "ready" ? (
              <ProblemState
                connectionState={connectionState}
                onRefresh={() => void loadDashboard(true)}
              />
            ) : null}
            {connectionState === "ready" && devices.length > 0 ? (
              filteredDevices.length > 0 ? (
                <DeviceTable
                  devices={filteredDevices}
                  onSelect={setSelectedId}
                />
              ) : (
                <FilteredEmptyState
                  onClear={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                />
              )
            ) : null}
          </section>
        </div>
      </section>

      {selectedDevice ? (
        <DeviceDrawer
          device={selectedDevice}
          onClose={() => setSelectedId(null)}
          onRename={renameDevice}
          onTrust={setTrust}
        />
      ) : null}
    </main>
  );
}

function Sidebar(): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <span className="brand-mark">
          <Wifi size={18} />
        </span>
        <span>
          <strong>WiFi Control</strong>
          <small>LOCAL OBSERVATORY</small>
        </span>
      </div>
      <div className="sidebar-rule" />
      <nav aria-label="Primary navigation" className="side-nav">
        <NavItem active icon={<Network size={16} />} label="Network" />
        <NavItem icon={<MonitorSmartphone size={16} />} label="Devices" />
        <NavItem icon={<History size={16} />} label="History" />
        <NavItem icon={<ShieldCheck size={16} />} label="Trust center" />
      </nav>
      <div className="sidebar-bottom">
        <div className="scope-label">
          <span className="status-dot online" />
          LOCAL ONLY
        </div>
        <p>Evidence stays on this machine.</p>
        <span className="version">v0.1 / FOUNDATION</span>
      </div>
    </aside>
  );
}

function NavItem({
  active,
  icon,
  label
}: Readonly<{
  active?: boolean;
  icon: JSX.Element;
  label: string;
}>): JSX.Element {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      disabled={!active}
      type="button"
    >
      {icon}
      <span>{label}</span>
      {active ? <span className="nav-indicator" /> : null}
    </button>
  );
}

function MetricCard({
  detail,
  icon,
  label,
  tone = "cyan",
  value
}: Readonly<{
  detail: string;
  icon: JSX.Element;
  label: string;
  tone?: string;
  value: number;
}>): JSX.Element {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value.toString().padStart(2, "0")}</strong>
      <small>{detail}</small>
    </article>
  );
}

function NoticeBanner({
  notice,
  onClose
}: Readonly<{ notice: Notice; onClose: () => void }>): JSX.Element {
  const Icon =
    notice.tone === "error"
      ? CircleAlert
      : notice.tone === "warning"
        ? ShieldAlert
        : Check;

  return (
    <div className={`notice-banner ${notice.tone}`}>
      <Icon size={17} />
      <span>
        <strong>{notice.title}</strong>
        {notice.message}
      </span>
      <button
        aria-label="Fechar aviso"
        className="notice-close"
        onClick={onClose}
        title="Fechar aviso"
        type="button"
      >
        <X size={15} />
      </button>
    </div>
  );
}

function DeviceTable({
  devices,
  onSelect
}: Readonly<{
  devices: ApiDevice[];
  onSelect: (id: string) => void;
}>): JSX.Element {
  return (
    <div
      aria-label="Dispositivos descobertos"
      className="device-table"
      role="table"
    >
      <div className="device-table-head" role="row">
        <span>Device</span>
        <span>Address</span>
        <span>Identity</span>
        <span>Status</span>
        <span>Trust</span>
        <span />
      </div>
      {devices.map((device) => (
        <button
          className="device-row"
          key={device.identity.id}
          onClick={() => onSelect(device.identity.id)}
          role="row"
          type="button"
        >
          <span className="device-name-cell">
            <span className="device-avatar">
              <Laptop size={16} />
            </span>
            <span>
              <strong>{device.identity.displayName}</strong>
              <small>
                {device.identity.hostname ??
                  device.identity.deviceType ??
                  "Unidentified endpoint"}
              </small>
            </span>
          </span>
          <span className="mono-cell">{device.identity.ip ?? "No IP"}</span>
          <span className="identity-cell">
            {device.identity.privateMac ? (
              <span className="private-label">Private MAC</span>
            ) : (
              (device.identity.manufacturer ?? "Unresolved")
            )}
            <small>{device.identity.mac ?? "MAC not observed"}</small>
          </span>
          <span>
            <StatusBadge status={device.identity.status} />
          </span>
          <span className={`trust-label ${device.identity.trustStatus}`}>
            {device.identity.trustStatus}
          </span>
          <span className="row-arrow">
            <ChevronRight size={16} />
          </span>
        </button>
      ))}
    </div>
  );
}

function DeviceDrawer({
  device,
  onClose,
  onRename,
  onTrust
}: Readonly<{
  device: ApiDevice;
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  onTrust: (id: string, trust: TrustStatus) => void;
}>): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.identity.displayName);

  return (
    <>
      <button
        aria-label="Fechar detalhes"
        className="drawer-scrim"
        onClick={onClose}
        type="button"
      />
      <aside aria-label="Detalhes do dispositivo" className="device-drawer">
        <div className="drawer-header">
          <div>
            <p className="eyebrow">DEVICE DETAIL</p>
            <h2>{device.identity.displayName}</h2>
          </div>
          <button
            aria-label="Fechar detalhes"
            className="icon-button"
            onClick={onClose}
            title="Fechar detalhes"
            type="button"
          >
            <X size={17} />
          </button>
        </div>
        <div className="drawer-status">
          <StatusBadge status={device.identity.status} />
          <span className={`trust-label ${device.identity.trustStatus}`}>
            {device.identity.trustStatus}
          </span>
          <span className="drawer-id">{device.identity.id}</span>
        </div>
        <div className="drawer-section">
          <p className="drawer-label">Identity</p>
          <DetailRow
            label="IP address"
            mono
            value={device.identity.ip ?? "Not observed"}
          />
          <DetailRow
            label="MAC address"
            mono
            value={device.identity.mac ?? "Not observed"}
          />
          <DetailRow
            label="Manufacturer"
            value={
              device.identity.privateMac
                ? "Hidden for private MAC"
                : (device.identity.manufacturer ?? "Not resolved")
            }
          />
          <DetailRow
            label="Device type"
            value={device.identity.deviceType ?? "Unknown"}
          />
        </div>
        <div className="drawer-section">
          <p className="drawer-label">Local actions</p>
          {editing ? (
            <form
              className="rename-form"
              onSubmit={(event) => {
                event.preventDefault();
                onRename(device.identity.id, name);
                setEditing(false);
              }}
            >
              <input
                aria-label="Nome do dispositivo"
                autoFocus
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <button className="primary-button" type="submit">
                <Check size={15} />
                Save
              </button>
            </form>
          ) : (
            <button
              className="action-row"
              onClick={() => setEditing(true)}
              type="button"
            >
              <span>
                <Sparkles size={16} />
                <strong>Rename device</strong>
              </span>
              <ChevronRight size={16} />
            </button>
          )}
          <div className="trust-actions">
            <button
              className={
                device.identity.trustStatus === "trusted"
                  ? "trust-button selected"
                  : "trust-button"
              }
              onClick={() => onTrust(device.identity.id, "trusted")}
              type="button"
            >
              <ShieldCheck size={15} />
              Trust
            </button>
            <button
              className={
                device.identity.trustStatus === "blocked"
                  ? "trust-button danger selected"
                  : "trust-button danger"
              }
              onClick={() => onTrust(device.identity.id, "blocked")}
              type="button"
            >
              <ShieldOff size={15} />
              Block
            </button>
          </div>
        </div>
        <div className="router-lock">
          <ShieldAlert size={17} />
          <span>
            <strong>Router control unavailable</strong>
            <small>
              Blocking at the router is disabled until a supported adapter and
              legitimate admin access are configured.
            </small>
          </span>
        </div>
        <div className="drawer-section evidence-section">
          <p className="drawer-label">
            Evidence trail <span>{device.evidence.length}</span>
          </p>
          {device.evidence.map((item, index) => (
            <div className="evidence-row" key={`${item.source}-${index}`}>
              <span className="evidence-source">{item.source}</span>
              <span>{Math.round(item.confidence * 100)}% confidence</span>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

function DetailRow({
  label,
  mono,
  value
}: Readonly<{ label: string; mono?: boolean; value: string }>): JSX.Element {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong className={mono ? "mono-cell" : ""}>{value}</strong>
    </div>
  );
}

function LoadingTable(): JSX.Element {
  return (
    <div className="loading-table">
      {[1, 2, 3, 4].map((item) => (
        <div className="skeleton-row" key={item}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  onRefresh
}: Readonly<{ onRefresh: () => void }>): JSX.Element {
  return (
    <div className="state-panel">
      <span className="state-icon">
        <Network size={21} />
      </span>
      <h3>No devices observed yet</h3>
      <p>
        The local agent is connected, but no neighbor or ICMP evidence has been
        collected.
      </p>
      <button className="primary-button" onClick={onRefresh} type="button">
        <RefreshCw size={15} />
        Run discovery
      </button>
    </div>
  );
}

function ProblemState({
  connectionState,
  onRefresh
}: Readonly<{
  connectionState: "offline" | "error";
  onRefresh: () => void;
}>): JSX.Element {
  const isOffline = connectionState === "offline";

  return (
    <div className="state-panel offline-state">
      <span className="state-icon">
        <CircleAlert size={21} />
      </span>
      <h3>
        {isOffline ? "Local agent unavailable" : "Could not load network"}
      </h3>
      <p>
        {isOffline
          ? "Start the WiFi Control agent on this machine, then try the discovery again."
          : "The agent responded with an error. Try the discovery again to recover the view."}
      </p>
      <button className="primary-button" onClick={onRefresh} type="button">
        <RefreshCw size={15} />
        Try again
      </button>
    </div>
  );
}

function FilteredEmptyState({
  onClear
}: Readonly<{ onClear: () => void }>): JSX.Element {
  return (
    <div className="filtered-empty">
      <Search size={17} />
      <span>No devices match this view.</span>
      <button onClick={onClear} type="button">
        Clear filters
      </button>
    </div>
  );
}

function getNetworkLabel(status: AgentStatus | null): string {
  return (
    status?.interfaces.find((item) => item.cidr)?.cidr ?? "Awaiting interface"
  );
}

function normalizeDevice(device: ApiDevice): ApiDevice {
  return {
    ...device,
    identity: {
      ...device.identity,
      trustStatus: device.identity.trustStatus ?? "unknown"
    }
  };
}

async function requestJson<T>(path: string, label: string): Promise<T> {
  const response = await fetch(`${AGENT_URL}${path}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`${label} request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}
