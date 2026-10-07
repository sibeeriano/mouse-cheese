"use client";

import { Button } from "@/components/ui/button";
import { type IntervalSeconds, type JiggleStatus } from "@/lib/protocol";
import { useEffect, useRef, useState } from "react";

const TICKER =
  "MOUSE&CHEESE   ·   EL RATÓN NO DUERME   ·   TU PC SIGUE DESPIERTA   ·   NADIE TE MARCA AUSENTE   ·   EL PUNTERO VUELVE A SU SITIO   ·   ";

const INTERVAL_OPTIONS: { value: IntervalSeconds; label: string; name: string }[] = [
  { value: 5, label: "5 s", name: "Cada 5 segundos" },
  { value: 15, label: "15 s", name: "Cada 15 segundos" },
  { value: 30, label: "30 s", name: "Cada 30 segundos" },
  { value: 60, label: "60 s", name: "Cada 60 segundos" },
];

const PLATFORM_NAME: Record<JiggleStatus["platform"], string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  other: "este sistema",
};

export function CheesePoster() {
  const [status, setStatus] = useState<JiggleStatus | null>(null);
  const [intervalSeconds, setIntervalSeconds] = useState<IntervalSeconds>(15);
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const epoch = useRef(0);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      const seen = epoch.current;
      try {
        const response = await fetch("/api/jiggle", { cache: "no-store" });
        if (!response.ok) throw new Error("status");
        const data = (await response.json()) as JiggleStatus;
        if (cancelled || seen !== epoch.current) return;
        setStatus(data);
        if (data.running) setIntervalSeconds(data.intervalSeconds);
        setRequestError(null);
      } catch {
        if (cancelled || seen !== epoch.current) return;
        setRequestError("No se pudo hablar con el servidor local.");
      }
    }

    void pull();
    const poll = window.setInterval(() => void pull(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, []);

  async function send(body: { action: "start"; intervalSeconds: IntervalSeconds } | { action: "stop" }) {
    const seen = ++epoch.current;
    setPending(true);
    try {
      const response = await fetch("/api/jiggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as JiggleStatus & { error?: string };
      if (seen !== epoch.current) return;
      if (!response.ok) {
        setRequestError(data.error ?? "No se pudo completar la acción.");
        return;
      }
      setStatus(data);
      setIntervalSeconds(data.intervalSeconds);
      setRequestError(null);
    } catch {
      if (seen !== epoch.current) return;
      setRequestError("No se pudo hablar con el servidor local.");
    } finally {
      if (seen === epoch.current) setPending(false);
    }
  }

  function chooseInterval(next: IntervalSeconds) {
    setIntervalSeconds(next);
    if (status?.running) {
      void send({ action: "start", intervalSeconds: next });
    }
  }

  const running = status?.running ?? false;
  const alertMessage = requestError ?? status?.lastError ?? null;
  const secondsLeft =
    running && status?.nextNudgeAt != null && now != null
      ? Math.max(0, Math.ceil((status.nextNudgeAt - now) / 1000))
      : null;
  const ready = status !== null || requestError !== null;
  const ticketClass = alertMessage && !running ? "ticket ticket-error" : running ? "ticket ticket-hot" : "ticket";
  const ticketLabel = !ready
    ? "Comprobando"
    : alertMessage && !running
      ? "Error"
      : running
        ? "En movimiento"
        : "En espera";

  return (
    <div className="cheese-body flex min-h-dvh flex-col overflow-x-hidden">
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          <span>{TICKER}</span>
          <span>{TICKER}</span>
        </div>
      </div>
      <div className="checker" aria-hidden="true" />

      <main className="flex flex-1 items-center justify-center px-3 py-8 sm:px-6 sm:py-14">
        <article className="poster" aria-labelledby="wordmark">
          <div className="poster-top">
            <p className={ticketClass} role="status" aria-live="polite">
              <span className="blink-dot" aria-hidden="true" />
              {ticketLabel}
            </p>
            <p className="stamp" aria-hidden="true">
              <small>100%</small>
              <strong>local</strong>
            </p>
          </div>

          <div className="poster-hero">
            <div>
              <p className="kicker">el ratón que mantiene el PC despierto</p>
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

          {alertMessage ? (
            <p className="alert-sticker" role="alert">
              {alertMessage}
            </p>
          ) : null}

          {running ? (
            <div className="countdown">
              <strong>{secondsLeft ?? "…"}</strong>
              <span>
                {secondsLeft === 1
                  ? "segundo para el próximo mordisco"
                  : "segundos para el próximo mordisco"}
              </span>
            </div>
          ) : null}

          <p className="lead">
            {running
              ? "El puntero está en movimiento. Cada mordisco dura un instante y el cursor vuelve solo a su sitio."
              : "Pulsa Comenzar y el puntero se desplaza unos píxeles y vuelve a su sitio, en el intervalo que elijas. Así evitas la suspensión y el «ausente» en Slack, Teams y otras apps."}
          </p>

          <fieldset className="mt-5" disabled={pending || !ready}>
            <legend className="field-label">Intervalo del mordisco</legend>
            <div className="intervals">
              {INTERVAL_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  className="interval-button"
                  aria-pressed={intervalSeconds === option.value}
                  aria-label={option.name}
                  onClick={() => chooseInterval(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </fieldset>
          <p className="hint mt-3">
            Entre 15 y 30 píxeles, ida y vuelta en una fracción de segundo. No hace clic.
          </p>

          <Button
            type="button"
            className={running ? "action-button stop" : "action-button"}
            disabled={pending || !ready}
            onClick={() =>
              void send(
                running ? { action: "stop" } : { action: "start", intervalSeconds },
              )
            }
          >
            {pending ? "Un momento…" : running ? "Detener" : "Comenzar"}
          </Button>

          <p className="footnote">
            El servidor
            {status ? ` (${PLATFORM_NAME[status.platform]})` : ""} es quien mueve el ratón, no la página.
          </p>
        </article>
      </main>

      <footer className="site-footer">
        Abre mouse&cheese en el ordenador que quieres mantener despierto. Si el servidor corre en otra máquina, el puntero de esta no se entera.
      </footer>
    </div>
  );
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
