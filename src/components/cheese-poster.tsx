"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";

const TICKER =
  "MOUSE&CHEESE   ·   LA PANTALLA NO SE DUERME   ·   ABRE LA PÁGINA Y PULSA COMENZAR   ·   SIN INSTALAR NADA   ·   ";

export function CheesePoster() {
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const wantRef = useRef(false);
  const lockRef = useRef<WakeLockSentinel | null>(null);
  const holdRef = useRef<() => Promise<void>>(async () => {});
  const acquiring = useRef<Promise<void> | null>(null);

  useEffect(() => {
    setSupported("wakeLock" in navigator);
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (!wantRef.current || document.visibilityState !== "visible") return;
      void holdRef.current().catch((cause: unknown) => {
        wantRef.current = false;
        setRunning(false);
        setStartedAt(null);
        setError(messageFrom(cause));
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    return () => {
      wantRef.current = false;
      void lockRef.current?.release();
    };
  }, []);

  async function hold() {
    if (lockRef.current && !lockRef.current.released) return;
    if (acquiring.current) return acquiring.current;
    if (!("wakeLock" in navigator)) {
      throw new Error(
        "Este navegador no puede mantener la pantalla despierta. Prueba con Chrome, Edge o Safari.",
      );
    }

    const job = navigator.wakeLock.request("screen");
    let finish: (error?: unknown) => void = () => {};
    const wait = new Promise<void>((resolve, reject) => {
      finish = (error) => (error === undefined ? resolve() : reject(error));
    });
    wait.catch(() => {});
    acquiring.current = wait;
    let sentinel: WakeLockSentinel;
    try {
      sentinel = await job;
      finish();
    } catch (error) {
      finish(error);
      throw error;
    } finally {
      if (acquiring.current === wait) acquiring.current = null;
    }
    if (!wantRef.current) {
      await sentinel.release();
      return;
    }
    lockRef.current = sentinel;
    sentinel.addEventListener("release", () => {
      if (lockRef.current === sentinel) lockRef.current = null;
      if (!wantRef.current || document.visibilityState !== "visible") return;
      void holdRef.current().catch((cause: unknown) => {
        wantRef.current = false;
        setRunning(false);
        setStartedAt(null);
        setError(messageFrom(cause));
      });
    });
  }

  holdRef.current = hold;

  async function start() {
    setPending(true);
    setError(null);
    wantRef.current = true;
    try {
      await hold();
      if (!wantRef.current) return;
      setRunning(true);
      setStartedAt((current) => current ?? Date.now());
    } catch (cause) {
      wantRef.current = false;
      setRunning(false);
      setStartedAt(null);
      setError(messageFrom(cause));
    } finally {
      setPending(false);
    }
  }

  async function stop() {
    setPending(true);
    wantRef.current = false;
    try {
      await lockRef.current?.release();
    } catch {
      lockRef.current = null;
    }
    setRunning(false);
    setStartedAt(null);
    setPending(false);
  }

  const elapsed =
    running && startedAt != null && now != null ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const ticketClass = error && !running ? "ticket ticket-error" : running ? "ticket ticket-hot" : "ticket";
  const ticketLabel = error && !running ? "Error" : running ? "Despierta" : "En espera";

  return (
    <div className="cheese-body flex min-h-dvh flex-col overflow-x-hidden">
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          <span>{TICKER}</span>
          <span>{TICKER}</span>
        </div>
      </div>
      <div className="checker" aria-hidden="true" />

      <main className="flex flex-1 items-center justify-center px-3 py-6 sm:px-6 sm:py-8">
        <article className="poster" aria-labelledby="wordmark">
          <div className="poster-top">
            <p className={ticketClass} role="status" aria-live="polite">
              <span className="blink-dot" aria-hidden="true" />
              {ticketLabel}
            </p>
            <p className="stamp" aria-hidden="true">
              <small>100%</small>
              <strong>web</strong>
            </p>
          </div>

          <div className="poster-hero">
            <div>
              <p className="kicker">la página que mantiene la pantalla despierta</p>
              <h1 id="wordmark" className="wordmark">
                <span className="block">mouse</span>
                <span className="block">
                  <span className="amp">&</span>cheese
                </span>
              </h1>
            </div>
            <CheeseMark running={running} />
          </div>

          <div className="rule" aria-hidden="true" />

          {error ? (
            <p className="alert-sticker" role="alert">
              {error}
            </p>
          ) : null}

          {!supported && !error ? (
            <p className="alert-sticker" role="alert">
              Este navegador no puede mantener la pantalla despierta. Prueba con Chrome, Edge o Safari.
            </p>
          ) : null}

          {running ? (
            <div className="countdown">
              <strong>{formatElapsed(elapsed)}</strong>
              <span>
                {elapsed >= 60
                  ? "con la pantalla despierta"
                  : elapsed === 1
                    ? "segundo con la pantalla despierta"
                    : "segundos con la pantalla despierta"}
              </span>
            </div>
          ) : null}

          <p className="lead">
            {running
              ? "Esta pestaña mantiene la pantalla encendida. Si te vas a otra, puede soltarse; al volver, se engancha sola."
              : "Pulsa Comenzar. Mientras esta pestaña siga abierta y a la vista, el navegador pide que la pantalla no se apague. No hay que instalar nada."}
          </p>

          <p className="hint mt-3">
            Una página web no puede mover el ratón ni hacer clic en Excel, Slack o Teams. Eso lo prohíbe el navegador en cualquier sitio, aunque esté publicado. Esto solo evita que se apague la pantalla.
          </p>

          <Button
            type="button"
            className={running ? "action-button stop" : "action-button"}
            disabled={pending || !supported}
            onClick={() => void (running ? stop() : start())}
          >
            {pending ? "Un momento…" : running ? "Detener" : "Comenzar"}
          </Button>

          <p className="footnote">Corre en el navegador de quien abre la página. No hay un servidor moviendo nada.</p>
        </article>
      </main>

      <footer className="site-footer">
        Cualquiera puede abrir este sitio. Comenzar mantiene despierta la pantalla de esa persona mientras la pestaña esté visible.
      </footer>
    </div>
  );
}

function messageFrom(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "El navegador bloqueó mantener la pantalla despierta. Deja esta pestaña visible y pulsa Comenzar de nuevo.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "No se pudo mantener la pantalla despierta.";
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return String(seconds);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function CheeseMark({ running }: { running: boolean }) {
  return (
    <svg
      viewBox="0 0 150 128"
      className={running ? "cheese-mark cheese-nibble" : "cheese-mark"}
      aria-hidden="true"
    >
      <g transform="rotate(-8 78 62)">
        <path
          d="M18 104 L74 16 L136 104 Z"
          fill="#FFB000"
          stroke="#1A120B"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M74 16 L84 104" stroke="#1A120B" strokeWidth="3" />
        <circle cx="52" cy="74" r="9" fill="#FFF8E7" stroke="#1A120B" strokeWidth="3" />
        <circle cx="104" cy="64" r="7" fill="#FFF8E7" stroke="#1A120B" strokeWidth="3" />
        <circle cx="86" cy="90" r="5.5" fill="#FFF8E7" stroke="#1A120B" strokeWidth="3" />
      </g>
      <ellipse cx="36" cy="112" rx="18" ry="10" fill="#1A120B" />
      <circle cx="22" cy="106" r="8" fill="#1A120B" />
      <circle cx="14" cy="98" r="5" fill="#FF4D00" />
      <circle cx="20" cy="104" r="1.4" fill="#FFF8E7" />
      <path d="M30 116 Q40 122 48 112" fill="none" stroke="#1A120B" strokeWidth="3" />
    </svg>
  );
}
