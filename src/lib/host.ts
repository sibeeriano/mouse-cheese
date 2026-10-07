export function isLocalHostname(hostHeader: string | null): boolean {
  if (!hostHeader) return false;

  let host = hostHeader.trim().toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    host = end === -1 ? host : host.slice(1, end);
  } else {
    host = host.replace(/:\d+$/, "");
  }

  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export const REMOTE_MOUSE_ERROR =
  "Este servidor no es tu computadora, así que no puede mover tu ratón. En tu equipo ejecuta npm install y npm run dev, y abre http://127.0.0.1:38471.";
