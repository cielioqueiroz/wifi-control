"use client";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { RefreshCw, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { readApi, writeApi } from "./api";

interface RouterState {
  connected: { hostname: string | null; mac: string; ip: string | null }[];
  blocked: { hostname: string | null; mac: string }[];
}
interface Audit {
  id: string;
  action: "block" | "unblock";
  status: string;
  requestedAt: number;
  deviceId: string | null;
}

export function RouterPanel(): JSX.Element {
  const [state, setState] = useState<RouterState | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const status = await readApi<{ router: { available: boolean } }>(
        "/status"
      );
      const actions = await readApi<{ actions: Audit[] }>("/router/audit");
      setAudit(actions.actions);
      if (!status.router.available) {
        setError(
          "Acesso administrativo ainda não configurado neste computador."
        );
        setState(null);
        return;
      }
      setState(await readApi<RouterState>("/router/devices"));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Roteador indisponível."
      );
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="operational-panel">
      <div className="panel-heading">
        <h1>Roteador Huawei AX2</h1>
        <button
          className="icon-button"
          title="Atualizar roteador"
          aria-label="Atualizar roteador"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {busy ? <p role="status">Consultando roteador...</p> : null}
      {error ? (
        <p role="status" className="operation-message">
          {error}
        </p>
      ) : null}
      {state ? (
        <>
          <h2>Dispositivos conectados ({state.connected.length})</h2>
          <div className="table-scroll">
            <table className="device-table">
              <thead>
                <tr>
                  <th>Dispositivo</th>
                  <th>IP</th>
                  <th>MAC</th>
                  <th>Acesso</th>
                </tr>
              </thead>
              <tbody>
                {state.connected.map((device) => (
                  <tr key={device.mac}>
                    <td>{device.hostname ?? "Não identificado"}</td>
                    <td>{device.ip ?? "Não observado"}</td>
                    <td>{device.mac}</td>
                    <td>
                      {state.blocked.some(
                        (item) =>
                          item.mac.toUpperCase() === device.mac.toUpperCase()
                      )
                        ? "Bloqueado"
                        : "Permitido"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Bloqueados ({state.blocked.length})</h2>
          {state.blocked.map((device) => (
            <p key={device.mac}>{device.hostname ?? device.mac}</p>
          ))}
        </>
      ) : null}
      <h2>Auditoria administrativa</h2>
      {audit.length === 0 ? (
        <p>Nenhuma ação registrada.</p>
      ) : (
        <div className="table-scroll">
          <table className="device-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Dispositivo</th>
                <th>Ação</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.requestedAt).toLocaleString("pt-BR")}</td>
                  <td>{item.deviceId ?? "Não identificado"}</td>
                  <td>
                    {item.action === "block" ? "Bloqueio" : "Desbloqueio"}
                  </td>
                  <td>
                    {{
                      requested: "Solicitado",
                      succeeded: "Confirmado",
                      failed: "Não concluído"
                    }[item.status] ?? item.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RouterDeviceControl({
  deviceId,
  mac,
  name
}: {
  deviceId: string;
  mac: string | null;
  name: string;
}): JSX.Element {
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    setBlocked(null);
    try {
      const status = await readApi<{ router: { available: boolean } }>(
        "/status"
      );
      if (!status.router.available || !mac) {
        setMessage(
          "Controle indisponível até configurar o acesso administrativo local."
        );
        return;
      }
      const state = await readApi<RouterState>("/router/devices");
      setBlocked(
        state.blocked.some(
          (item) => item.mac.toUpperCase() === mac.toUpperCase()
        )
      );
      setMessage("");
    } catch {
      setMessage("Não foi possível consultar o estado no roteador.");
    }
  }, [mac]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const word = blocked ? "DESBLOQUEAR" : "BLOQUEAR";
  async function act(): Promise<void> {
    setBusy(true);
    try {
      await writeApi(`/router/${blocked ? "unblock" : "block"}`, {
        deviceId,
        confirmation
      });
      await load();
      setMessage("Alteração confirmada pelo roteador.");
      setOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Ação não concluída."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="drawer-section">
      <p className="drawer-label">Acesso à rede</p>
      <button
        className="action-row"
        disabled={blocked === null || busy}
        onClick={() => {
          setConfirmation("");
          setMessage("");
          setOpen(true);
        }}
      >
        <span>
          {blocked ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
          <strong>
            {blocked ? "Desbloquear no roteador" : "Bloquear no roteador"}
          </strong>
        </span>
      </button>
      {!open && message ? (
        <p className="operation-message" role="status">
          {message}
        </p>
      ) : null}
      <dialog
        className="confirm-dialog"
        ref={dialog}
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setOpen(false);
        }}
        aria-labelledby="confirm-router-title"
      >
        <div className="panel-heading">
          <h2 id="confirm-router-title">
            {blocked ? "Liberar acesso" : "Bloquear acesso"}
          </h2>
          <button
            className="icon-button"
            aria-label="Cancelar ação"
            title="Cancelar ação"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <p>{name}</p>
        <p>{mac}</p>
        <p>
          {blocked
            ? "O dispositivo poderá se conectar novamente."
            : "O dispositivo perderá acesso à rede."}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act();
          }}
        >
          <label htmlFor="router-confirmation">
            Digite {word} para confirmar
          </label>
          <input
            id="router-confirmation"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
          />
          <div className="dialog-actions">
            <button
              type="button"
              className="trust-button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={busy || confirmation !== word}
            >
              {busy ? "Aplicando..." : "Confirmar"}
            </button>
          </div>
          {message ? <p role="alert">{message}</p> : null}
        </form>
      </dialog>
    </section>
  );
}
