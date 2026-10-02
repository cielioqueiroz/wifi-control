"use client";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { Bell, Check, RefreshCw } from "lucide-react";
import { readApi, writeApi } from "./api";

export interface Settings {
  notificationsEnabled: boolean;
  desktopNotifications: boolean;
  scanIntervalSeconds: number;
  retentionDays: number;
  theme: "light" | "dark" | "system";
}
export const defaultSettings: Settings = {
  notificationsEnabled: true,
  desktopNotifications: false,
  scanIntervalSeconds: 60,
  retentionDays: 90,
  theme: "system"
};
interface NotificationItem {
  id: string;
  deviceName: string | null;
  type: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  read: boolean;
}

export function useLocalNotifications(settings: Settings) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");
  const seen = useRef<Set<string> | null>(null);
  const load = useCallback(async () => {
    if (!settings.notificationsEnabled) {
      setItems([]);
      return;
    }
    try {
      const result = await readApi<{ notifications: NotificationItem[] }>(
        "/notifications"
      );
      if (
        settings.desktopNotifications &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        seen.current
      ) {
        for (const item of result.notifications
          .filter((item) => !item.read && !seen.current?.has(item.id))
          .slice(0, 3))
          new Notification("WiFi Control", {
            body: notificationText(item),
            tag: item.id
          });
      }
      seen.current = new Set(result.notifications.map((item) => item.id));
      setItems(result.notifications);
      setError("");
    } catch {
      setError("Não foi possível atualizar as notificações.");
    }
  }, [settings.notificationsEnabled, settings.desktopNotifications]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);
  async function markRead(): Promise<void> {
    try {
      await writeApi("/notifications/read", {
        ids: items.filter((item) => !item.read).map((item) => item.id)
      });
      await load();
    } catch {
      setError("Não foi possível marcar as notificações como lidas.");
    }
  }
  return {
    items,
    error,
    load,
    markRead,
    unread: items.filter((item) => !item.read).length
  };
}

export function NotificationsPanel({
  alerts,
  enabled
}: {
  alerts: ReturnType<typeof useLocalNotifications>;
  enabled: boolean;
}): JSX.Element {
  return (
    <section className="operational-panel">
      <div className="panel-heading">
        <h1>Notificações</h1>
        <div className="dialog-actions">
          <button
            className="icon-button"
            title="Atualizar notificações"
            aria-label="Atualizar notificações"
            onClick={() => void alerts.load()}
          >
            <RefreshCw size={18} />
          </button>
          <button
            className="trust-button"
            disabled={!alerts.unread}
            onClick={() => void alerts.markRead()}
          >
            <Check size={16} />
            Marcar todas como lidas
          </button>
        </div>
      </div>
      {alerts.error ? <p role="alert">{alerts.error}</p> : null}
      {!enabled ? (
        <p>As notificações estão desativadas nas preferências.</p>
      ) : !alerts.items.length ? (
        <p>Nenhuma notificação registrada.</p>
      ) : (
        <ul className="notification-list">
          {alerts.items.map((item) => (
            <li key={item.id} className={item.read ? "read" : "unread"}>
              <Bell size={18} />
              <div>
                <strong>{notificationText(item)}</strong>
                <time dateTime={item.occurredAt}>
                  {new Date(item.occurredAt).toLocaleString("pt-BR")}
                </time>
              </div>
              <span>{item.read ? "Lida" : "Nova"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SettingsPanel({
  settings,
  onChange
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): JSX.Element {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function update(next: Settings): Promise<void> {
    setBusy(true);
    setMessage("");
    try {
      onChange(await writeApi<Settings>("/settings", next));
      setMessage("Preferências salvas.");
    } catch {
      setMessage("Não foi possível salvar as preferências.");
    } finally {
      setBusy(false);
    }
  }
  async function toggleDesktop(enabled: boolean): Promise<void> {
    if (
      enabled &&
      (typeof Notification === "undefined" ||
        (await Notification.requestPermission()) !== "granted")
    ) {
      setMessage("O navegador não permitiu notificações do sistema.");
      return;
    }
    await update({ ...settings, desktopNotifications: enabled });
  }
  return (
    <section className="operational-panel">
      <h1>Preferências</h1>
      <fieldset className="settings-fields" disabled={busy}>
        <legend>Monitoramento local</legend>
        <label>
          <span>Intervalo entre varreduras</span>
          <select
            value={settings.scanIntervalSeconds}
            onChange={(event) =>
              void update({
                ...settings,
                scanIntervalSeconds: Number(event.target.value)
              })
            }
          >
            <option value={30}>30 segundos</option>
            <option value={60}>1 minuto</option>
            <option value={300}>5 minutos</option>
            <option value={900}>15 minutos</option>
          </select>
        </label>
        <label>
          <span>Retenção do histórico</span>
          <select
            value={settings.retentionDays}
            onChange={(event) =>
              void update({
                ...settings,
                retentionDays: Number(event.target.value)
              })
            }
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={365}>1 ano</option>
          </select>
        </label>
        <label>
          <span>Notificações locais</span>
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={(event) =>
              void update({
                ...settings,
                notificationsEnabled: event.target.checked
              })
            }
          />
        </label>
        <label>
          <span>Notificações do sistema</span>
          <input
            type="checkbox"
            checked={settings.desktopNotifications}
            onChange={(event) => void toggleDesktop(event.target.checked)}
          />
        </label>
        <label>
          <span>Aparência</span>
          <select
            value={settings.theme}
            onChange={(event) =>
              void update({
                ...settings,
                theme: event.target.value as Settings["theme"]
              })
            }
          >
            <option value="system">Usar tema do sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </select>
        </label>
      </fieldset>
      <p role="status">{message}</p>
    </section>
  );
}

function notificationText(item: NotificationItem): string {
  const name = item.deviceName ?? "Dispositivo não identificado";
  if (item.type === "device_discovered") return `Novo dispositivo: ${name}`;
  return `${name} está ${item.metadata.to === "online" ? "online" : "offline"}.`;
}
