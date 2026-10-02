"use client";

import {
  Bell,
  Settings,
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
import { readApi, writeApi } from "./api";
import {
  defaultSettings,
  useLocalNotifications,
  SettingsPanel,
  NotificationsPanel,
  type Settings as AppSettings
} from "./preferences";
import { RouterPanel, RouterDeviceControl } from "./router-panel";

type DeviceStatus = "online" | "offline" | "unknown";
type TrustStatus = "unknown" | "trusted" | "blocked";
type ConnectionState = "loading" | "ready" | "offline" | "error";
type DeviceFilter = "all" | DeviceStatus;
type DashboardView =
  "network" | "history" | "router" | "trust" | "settings" | "notifications";

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
  warning?: string | null;
  devices: ApiDevice[];
  evidence: unknown[];
}

interface HistoryResponse {
  devices: Array<{
    displayName: string;
    firstSeenAt: string;
    id: string;
    ip: string | null;
    lastSeenAt: string;
    mac: string | null;
    status: DeviceStatus;
  }>;
  events: Array<{
    deviceId: string | null;
    deviceName: string | null;
    id: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
    type: string;
  }>;
}

interface AgentStatus {
  interfaces: Array<{
    address: string;
    cidr: string | null;
    gateway: string | null;
    name: string;
  }>;
  router: { available: boolean; model: string | null };
  scanner: {
    endpoint: string;
    platform: string;
    ready: boolean;
    lastScanAt?: number;
  };
}

interface Notice {
  tone: "info" | "warning" | "error";
  title: string;
  message: string;
}

const AGENT_URL =
  process.env.NEXT_PUBLIC_LOCAL_AGENT_URL ?? "http://127.0.0.1:4317";

export default function Dashboard(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const alerts = useLocalNotifications(settings);
  useEffect(() => {
    void readApi<AppSettings>("/settings")
      .then(setSettings)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = (): void => {
      document.documentElement.dataset.theme =
        settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : settings.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);
  const [view, setView] = useState<DashboardView>("network");
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DeviceFilter>("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const loadDashboard = useCallback(
    async (isRefresh = false, background = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (!background) {
        setConnectionState("loading");
      }
      if (!background) setNotice(null);

      try {
        if (isRefresh) await writeApi("/scan", {});
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
        if (devicesResult.value.warning)
          setNotice({
            title: "Varredura incompleta",
            message: devicesResult.value.warning,
            tone: "warning"
          });

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
    },
    []
  );

  useEffect(() => {
    void loadDashboard();
    const timer = setInterval(() => {
      void loadDashboard(false, true);
    }, 60_000);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  const selectedDevice = devices.find(
    (device) => device.identity.id === selectedId
  );
  const filteredDevices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return devices.filter((device) => {
      const identity = device.identity;
      const matchesFilter =
        (filter === "all" || identity.status === filter) &&
        (view !== "trust" || identity.trustStatus !== "trusted");
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
  }, [devices, filter, query, view]);

  const metrics = useMemo(() => {
    const online = devices.filter(
      (device) => device.identity.status === "online"
    ).length;
    const unknown = devices.filter(
      (device) => device.identity.trustStatus === "unknown"
    ).length;
    const privateMacs = devices.filter(
      (device) => device.identity.privateMac
    ).length;

    return { online, privateMacs, total: devices.length, unknown };
  }, [devices]);

  async function updateDevice(
    deviceId: string,
    input: { alias?: string; trustStatus?: "trusted" | "unknown" }
  ): Promise<void> {
    try {
      const result = await writeApi<DevicesResponse>("/devices/preferences", {
        deviceId,
        ...input
      });
      setDevices(result.devices.map(normalizeDevice));
      setNotice({
        title: "Alteração salva",
        message: "Preferências atualizadas.",
        tone: "info"
      });
    } catch (error) {
      setNotice({
        title: "Não foi possível salvar",
        message:
          error instanceof Error ? error.message : "Agente indisponível.",
        tone: "error"
      });
    }
  }

  function renameDevice(deviceId: string, displayName: string): void {
    void updateDevice(deviceId, { alias: displayName.trim() });
  }

  function setTrust(deviceId: string, trustStatus: TrustStatus): void {
    if (trustStatus !== "blocked") void updateDevice(deviceId, { trustStatus });
  }
  return (
    <main className="dashboard-shell">
      <Sidebar activeView={view} onNavigate={setView} />
      <section className="dashboard-main">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark small">
              <Wifi size={15} />
            </span>
            <span className="brand-name">WiFi Control</span>
          </div>
          <div className="breadcrumb">
            <span className="eyebrow">REDE LOCAL</span>
            <ChevronRight size={14} />
            <span>
              {
                {
                  network: "Visão geral",
                  history: "Histórico",
                  router: "Roteador",
                  trust: "Central de confiança",
                  settings: "Preferências",
                  notifications: "Notificações"
                }[view]
              }
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              title="Notificações"
              aria-label={`Notificações: ${alerts.unread} não lidas`}
              onClick={() => setView("notifications")}
            >
              <Bell size={17} />
              <span className="notification-count">{alerts.unread || ""}</span>
            </button>
            <span className={`agent-pill ${connectionState}`}>
              <span className="status-dot" />
              {connectionState === "offline"
                ? "Agente offline"
                : "Agente local"}
            </span>
            {view === "network" ? (
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
            ) : null}
            <span className="avatar">CQ</span>
          </div>
        </header>

        <div className="content-wrap">
          <label className="mobile-navigation">
            Seção
            <select
              aria-label="Seção"
              value={view}
              onChange={(event) => {
                setSelectedId(null);
                setView(event.target.value as DashboardView);
              }}
            >
              <option value="network">Rede</option>
              <option value="history">Histórico</option>
              <option value="trust">Central de confiança</option>
              <option value="router">Roteador</option>
              <option value="notifications">Notificações</option>
              <option value="settings">Preferências</option>
            </select>
          </label>
          {view === "network" || view === "trust" ? (
            <>
              <section className="page-heading reveal reveal-one">
                <div>
                  <p className="eyebrow">REDE / ESCRITÓRIO</p>
                  <h1>
                    {view === "trust"
                      ? "Dispositivos para revisar"
                      : "Visão geral da rede"}
                  </h1>
                  <p className="lede">
                    Um retrato local, legível e sem suposições sobre quem está
                    na sua rede.
                  </p>
                </div>
                <div className="network-chip">
                  <span className="signal-icon">
                    <Network size={17} />
                  </span>
                  <span>
                    <small>SEGMENTO ATIVO</small>
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
                  detail="última varredura"
                  icon={<MonitorSmartphone size={17} />}
                  label="Dispositivos descobertos"
                  value={metrics.total}
                />
                <MetricCard
                  detail="respondendo"
                  icon={<Sparkles size={17} />}
                  label="Online agora"
                  tone="mint"
                  value={metrics.online}
                />
                <MetricCard
                  detail="identidade desconhecida"
                  icon={<CircleHelp size={17} />}
                  label="Requer revisão"
                  tone="amber"
                  value={metrics.unknown}
                />
                <MetricCard
                  detail="fabricante oculto"
                  icon={<ShieldAlert size={17} />}
                  label="MACs privados"
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
                      {agentStatus?.interfaces[0]?.gateway ?? "Não detectado"}
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
                      {agentStatus?.interfaces[0]?.name ?? "Aguardando agente"}
                    </strong>
                  </span>
                </div>
                <div className="strip-item">
                  <span className="strip-icon">
                    <Clock3 size={16} />
                  </span>
                  <span>
                    <small>ÚLTIMA OBSERVAÇÃO</small>
                    <strong>
                      {connectionState === "ready"
                        ? "Agora mesmo"
                        : "Aguardando varredura"}
                    </strong>
                  </span>
                </div>
                <div className="strip-action">
                  <span>
                    <small>CONTROLE DO ROTEADOR</small>
                    <strong>
                      {agentStatus?.router.available
                        ? "Configurado"
                        : "Indisponível"}
                    </strong>
                  </span>
                  <ShieldOff size={17} />
                </div>
              </section>

              <section className="devices-section reveal reveal-four">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">OBSERVAÇÕES</p>
                    <h2>Dispositivos na sua rede</h2>
                  </div>
                  <div className="table-tools">
                    <label className="search-box">
                      <Search size={16} />
                      <span className="sr-only">Buscar dispositivos</span>
                      <input
                        aria-label="Buscar dispositivos"
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar dispositivo, IP ou MAC"
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
                        [
                          "all",
                          "online",
                          "unknown",
                          "offline"
                        ] as DeviceFilter[]
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
                          {getFilterLabel(option)}
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
                {connectionState !== "loading" &&
                connectionState !== "ready" ? (
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
            </>
          ) : view === "settings" ? (
            <SettingsPanel settings={settings} onChange={setSettings} />
          ) : view === "notifications" ? (
            <NotificationsPanel
              alerts={alerts}
              enabled={settings.notificationsEnabled}
            />
          ) : view === "router" ? (
            <RouterPanel />
          ) : (
            <HistoryPanel />
          )}
        </div>
      </section>

      {selectedDevice ? (
        <DeviceDrawer
          key={selectedDevice.identity.id}
          device={selectedDevice}
          onClose={() => setSelectedId(null)}
          onRename={renameDevice}
          onTrust={setTrust}
        />
      ) : null}
    </main>
  );
}

function Sidebar({
  activeView,
  onNavigate
}: Readonly<{
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
}>): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <span className="brand-mark">
          <Wifi size={18} />
        </span>
        <span>
          <strong>WiFi Control</strong>
          <small>OBSERVATÓRIO LOCAL</small>
        </span>
      </div>
      <div className="sidebar-rule" />
      <nav aria-label="Navegação principal" className="side-nav">
        <NavItem
          active={activeView === "network"}
          icon={<Network size={16} />}
          label="Rede"
          onClick={() => onNavigate("network")}
        />
        <NavItem
          active={activeView === "router"}
          icon={<Server size={16} />}
          label="Roteador"
          onClick={() => onNavigate("router")}
        />
        <NavItem
          active={activeView === "history"}
          icon={<History size={16} />}
          label="Histórico"
          onClick={() => onNavigate("history")}
        />
        <NavItem
          icon={<ShieldCheck size={16} />}
          label="Central de confiança"
          active={activeView === "trust"}
          onClick={() => onNavigate("trust")}
        />
      </nav>
      <div className="sidebar-bottom">
        <NavItem
          active={activeView === "notifications"}
          icon={<Bell size={16} />}
          label="Notificações"
          onClick={() => onNavigate("notifications")}
        />
        <NavItem
          active={activeView === "settings"}
          icon={<Settings size={16} />}
          label="Preferências"
          onClick={() => onNavigate("settings")}
        />
        <div className="scope-label">
          <span className="status-dot online" />
          SOMENTE LOCAL
        </div>
        <p>As evidências permanecem nesta máquina.</p>
        <span className="version">v1.0 / LOCAL</span>
      </div>
    </aside>
  );
}

function NavItem({
  active,
  icon,
  label,
  onClick
}: Readonly<{
  active?: boolean;
  icon: JSX.Element;
  label: string;
  onClick?: () => void;
}>): JSX.Element {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      disabled={!onClick}
      onClick={onClick}
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

function HistoryPanel(): JSX.Element {
  const [snapshot, setSnapshot] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setHasError(false);

    try {
      setSnapshot(await requestJson<HistoryResponse>("/history", "history"));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <>
      <section className="page-heading history-heading reveal reveal-one">
        <div>
          <p className="eyebrow">REDE / HISTÓRICO</p>
          <h1>Atividade da rede</h1>
          <p className="lede">
            Presença observada ao longo do tempo, mantida localmente nesta
            máquina.
          </p>
        </div>
        <button
          className={`primary-button history-refresh ${
            isRefreshing ? "is-spinning" : ""
          }`}
          disabled={isLoading || isRefreshing}
          onClick={() => void loadHistory(true)}
          type="button"
        >
          <RefreshCw size={15} />
          Atualizar histórico
        </button>
      </section>

      {isLoading ? <HistoryLoading /> : null}
      {!isLoading && hasError ? <HistoryError onRefresh={loadHistory} /> : null}
      {!isLoading && !hasError && snapshot ? (
        snapshot.events.length > 0 ? (
          <div className="history-layout reveal reveal-two">
            <section className="history-panel">
              <div className="history-panel-heading">
                <div>
                  <p className="eyebrow">LINHA DO TEMPO</p>
                  <h2>Eventos recentes</h2>
                </div>
                <span className="history-count">
                  {snapshot.events.length} eventos
                </span>
              </div>
              <div className="history-list">
                {snapshot.events.map((event) => (
                  <article className="history-event" key={event.id}>
                    <span className="history-event-icon">
                      {event.type === "status_changed" ? (
                        <Clock3 size={16} />
                      ) : (
                        <Network size={16} />
                      )}
                    </span>
                    <div>
                      <strong>{getHistoryEventTitle(event)}</strong>
                      <p>{getHistoryEventDescription(event)}</p>
                    </div>
                    <time dateTime={event.occurredAt}>
                      {formatHistoryDate(event.occurredAt)}
                    </time>
                  </article>
                ))}
              </div>
            </section>
            <section className="history-panel">
              <div className="history-panel-heading">
                <div>
                  <p className="eyebrow">DISPOSITIVOS</p>
                  <h2>Presença registrada</h2>
                </div>
                <span className="history-count">
                  {snapshot.devices.length} dispositivos
                </span>
              </div>
              <div className="history-device-list">
                {snapshot.devices.map((device) => (
                  <div className="history-device" key={device.id}>
                    <span className="device-avatar">
                      <Laptop size={16} />
                    </span>
                    <span>
                      <strong>{device.displayName}</strong>
                      <small>
                        {device.ip ?? "Sem IP"} · desde{" "}
                        {formatHistoryDate(device.firstSeenAt)}
                      </small>
                    </span>
                    <StatusBadge status={device.status} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <HistoryEmpty />
        )
      ) : null}
    </>
  );
}

function HistoryLoading(): JSX.Element {
  return (
    <div className="history-layout">
      <div className="history-panel history-loading-panel" />
      <div className="history-panel history-loading-panel" />
    </div>
  );
}

function HistoryEmpty(): JSX.Element {
  return (
    <div className="state-panel">
      <span className="state-icon">
        <History size={21} />
      </span>
      <h3>Ainda não há atividade registrada</h3>
      <p>
        Execute uma descoberta na visão da rede para começar a registrar a
        presença dos dispositivos.
      </p>
    </div>
  );
}

function HistoryError({
  onRefresh
}: Readonly<{
  onRefresh: (isRefresh?: boolean) => Promise<void>;
}>): JSX.Element {
  return (
    <div className="state-panel offline-state">
      <span className="state-icon">
        <CircleAlert size={21} />
      </span>
      <h3>Não foi possível carregar o histórico</h3>
      <p>O agente local não respondeu ao consultar a atividade registrada.</p>
      <button
        className="primary-button"
        onClick={() => void onRefresh(true)}
        type="button"
      >
        <RefreshCw size={15} />
        Tentar novamente
      </button>
    </div>
  );
}

function getHistoryEventTitle(
  event: HistoryResponse["events"][number]
): string {
  if (event.type === "device_updated") return "Preferências atualizadas";
  return event.type === "status_changed"
    ? "Mudança de status"
    : "Dispositivo descoberto";
}

function getHistoryEventDescription(
  event: HistoryResponse["events"][number]
): string {
  const name = event.deviceName ?? "Dispositivo não identificado";
  if (event.type === "device_updated")
    return `${name} teve suas preferências atualizadas.`;

  if (event.type !== "status_changed") {
    return `${name} foi observado na rede.`;
  }

  const from = getStatusLabel(event.metadata.from);
  const to = getStatusLabel(event.metadata.to);
  return `${name} mudou de ${from} para ${to}.`;
}

function getStatusLabel(value: unknown): string {
  const labels: Record<DeviceStatus, string> = {
    offline: "offline",
    online: "online",
    unknown: "desconhecido"
  };

  return typeof value === "string" && value in labels
    ? labels[value as DeviceStatus]
    : labels.unknown;
}

function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
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
        <span>Dispositivo</span>
        <span>Endereço</span>
        <span>Identidade</span>
        <span>Status</span>
        <span>Confiança</span>
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
                  "Dispositivo não identificado"}
              </small>
            </span>
          </span>
          <span className="mono-cell">{device.identity.ip ?? "Sem IP"}</span>
          <span className="identity-cell">
            {device.identity.privateMac ? (
              <span className="private-label">MAC privado</span>
            ) : (
              (device.identity.manufacturer ?? "Não resolvido")
            )}
            <small>{device.identity.mac ?? "MAC não observado"}</small>
          </span>
          <span>
            <StatusBadge status={device.identity.status} />
          </span>
          <span className={`trust-label ${device.identity.trustStatus}`}>
            {getTrustLabel(device.identity.trustStatus)}
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
            <p className="eyebrow">DETALHES DO DISPOSITIVO</p>
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
            {getTrustLabel(device.identity.trustStatus)}
          </span>
          <span className="drawer-id">{device.identity.id}</span>
        </div>
        <div className="drawer-section">
          <p className="drawer-label">Identidade</p>
          <DetailRow
            label="Endereço IP"
            mono
            value={device.identity.ip ?? "Não observado"}
          />
          <DetailRow
            label="Endereço MAC"
            mono
            value={device.identity.mac ?? "Não observado"}
          />
          <DetailRow
            label="Fabricante"
            value={
              device.identity.privateMac
                ? "Oculto por MAC privado"
                : (device.identity.manufacturer ?? "Não resolvido")
            }
          />
          <DetailRow
            label="Tipo de dispositivo"
            value={device.identity.deviceType ?? "Desconhecido"}
          />
          <DetailRow
            label="Nome detectado"
            value={device.identity.hostname ?? "Não observado"}
          />
          <DetailRow
            label="Primeira presença"
            value={formatHistoryDate(device.identity.firstSeenAt)}
          />
          <DetailRow
            label="Última presença"
            value={formatHistoryDate(device.identity.lastSeenAt)}
          />
        </div>
        <div className="drawer-section">
          <p className="drawer-label">Ações locais</p>
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
                maxLength={80}
                required
                autoFocus
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <button className="primary-button" type="submit">
                <Check size={15} />
                Salvar
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
                <strong>Renomear dispositivo</strong>
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
              Confiar
            </button>
            <button
              className={
                device.identity.trustStatus === "unknown"
                  ? "trust-button danger selected"
                  : "trust-button danger"
              }
              onClick={() => onTrust(device.identity.id, "unknown")}
              type="button"
            >
              <ShieldOff size={15} />
              Remover confiança
            </button>
          </div>
        </div>
        <RouterDeviceControl
          deviceId={device.identity.id}
          mac={device.identity.mac}
          name={device.identity.displayName}
        />
        <div className="drawer-section evidence-section">
          <p className="drawer-label">
            Trilha de evidências <span>{device.evidence.length}</span>
          </p>
          {device.evidence.map((item, index) => (
            <div className="evidence-row" key={`${item.source}-${index}`}>
              <span className="evidence-source">
                {{
                  neighbor: "Tabela de vizinhos",
                  arp: "ARP",
                  icmp: "Ping",
                  dns: "DNS reverso",
                  mdns: "mDNS",
                  ssdp: "SSDP",
                  oui: "Fabricante"
                }[item.source] ?? item.source}
              </span>
              <span>{Math.round(item.confidence * 100)}% de confiança</span>
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
      <h3>Nenhum dispositivo observado ainda</h3>
      <p>
        O agente local está conectado, mas nenhuma evidência de vizinhança ou
        ICMP foi coletada.
      </p>
      <button className="primary-button" onClick={onRefresh} type="button">
        <RefreshCw size={15} />
        Executar descoberta
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
        {isOffline
          ? "Agente local indisponível"
          : "Não foi possível carregar a rede"}
      </h3>
      <p>
        {isOffline
          ? "Inicie o agente WiFi Control nesta máquina e tente a descoberta novamente."
          : "O agente respondeu com um erro. Tente a descoberta novamente para recuperar a visão."}
      </p>
      <button className="primary-button" onClick={onRefresh} type="button">
        <RefreshCw size={15} />
        Tentar novamente
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
      <span>Nenhum dispositivo corresponde a esta visualização.</span>
      <button onClick={onClear} type="button">
        Limpar filtros
      </button>
    </div>
  );
}

function getNetworkLabel(status: AgentStatus | null): string {
  return (
    status?.interfaces.find((item) => item.cidr)?.cidr ?? "Aguardando interface"
  );
}

function getFilterLabel(filter: DeviceFilter): string {
  const labels: Record<DeviceFilter, string> = {
    all: "Todos",
    offline: "Offline",
    online: "Online",
    unknown: "Desconhecido"
  };

  return labels[filter];
}

function getTrustLabel(status: TrustStatus): string {
  const labels: Record<TrustStatus, string> = {
    blocked: "Bloqueado",
    trusted: "Confiável",
    unknown: "Desconhecido"
  };

  return labels[status];
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
