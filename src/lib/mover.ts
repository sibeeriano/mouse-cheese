import { spawn } from "node:child_process";

const NUDGE_PAUSE_MS = 550;
const COMMAND_TIMEOUT_MS = 5000;

type RunResult = { stdout: string; stderr: string };

class CommandError extends Error {
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
  readonly spawnCode: string | null;

  constructor(
    message: string,
    details: { status: number | null; stderr: string; stdout: string; spawnCode: string | null },
  ) {
    super(message);
    this.name = "CommandError";
    this.status = details.status;
    this.stderr = details.stderr;
    this.stdout = details.stdout;
    this.spawnCode = details.spawnCode;
  }
}

const toolCache = new Map<string, boolean>();

function run(
  command: string,
  args: string[],
  options?: { input?: string; timeoutMs?: number },
): Promise<RunResult> {
  const timeoutMs = options?.timeoutMs ?? COMMAND_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve({ stdout, stderr });
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(
        new CommandError("Tiempo de espera agotado al mover el puntero.", {
          status: null,
          stderr,
          stdout,
          spawnCode: "ETIMEDOUT",
        }),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish(
        new CommandError(error.message, {
          status: null,
          stderr,
          stdout,
          spawnCode: error.code ?? null,
        }),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        finish();
        return;
      }
      finish(
        new CommandError(stderr.trim() || stdout.trim() || `El comando terminó con código ${code}`, {
          status: code,
          stderr,
          stdout,
          spawnCode: null,
        }),
      );
    });

    child.stdin.write(options?.input ?? "");
    child.stdin.end();
  });
}

function commandExists(command: "xdotool" | "ydotool" | "cliclick"): Promise<boolean> {
  const cached = toolCache.get(command);
  if (cached !== undefined) return Promise.resolve(cached);

  return run("bash", ["-c", 'command -v "$1"', "lookup", command], { timeoutMs: 2000 })
    .then(() => {
      toolCache.set(command, true);
      return true;
    })
    .catch(() => {
      toolCache.set(command, false);
      return false;
    });
}

function assertDelta(dx: number, dy: number) {
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) > 40 || Math.abs(dy) > 40) {
    throw new Error("El desplazamiento del puntero no es válido.");
  }
}

function outputOf(error: unknown): string {
  if (error instanceof CommandError) return `${error.stderr}\n${error.message}`;
  if (error instanceof Error) return error.message;
  return "";
}

function isMissing(error: unknown): boolean {
  if (error instanceof CommandError) {
    return error.spawnCode === "ENOENT" || error.status === 127;
  }
  return false;
}

const MAC_SCRIPT = `
import sys
import time

dx = int(sys.argv[1])
dy = int(sys.argv[2])

def load():
    try:
        import Quartz
        return Quartz
    except ImportError:
        pass
    try:
        import Quartz.CoreGraphics as quartz
        return quartz
    except ImportError:
        return None

quartz = load()
if quartz is None:
    sys.stderr.write("QUARTZ_MISSING\\n")
    sys.exit(42)

def shift(delta_x, delta_y):
    event = quartz.CGEventCreate(None)
    loc = quartz.CGEventGetLocation(event)
    point = quartz.CGPointMake(loc.x + delta_x, loc.y + delta_y)
    moved = quartz.CGEventCreateMouseEvent(None, quartz.kCGEventMouseMoved, point, 0)
    quartz.CGEventPost(quartz.kCGHIDEventTap, moved)

shift(dx, dy)
time.sleep(0.55)
shift(-dx, -dy)
`;

function windowsScript(dx: number, dy: number): string {
  return `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MouseCheeseMover {
  [DllImport("user32.dll", EntryPoint="mouse_event")]
  public static extern void MouseEvent(uint flags, int dx, int dy, uint data, UIntPtr extra);
}
"@
[MouseCheeseMover]::MouseEvent(0x0001, ${dx}, ${dy}, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds ${NUDGE_PAUSE_MS}
[MouseCheeseMover]::MouseEvent(0x0001, ${-dx}, ${-dy}, 0, [UIntPtr]::Zero)
`.trim();
}

function cliclickToken(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

async function nudgeWindows(dx: number, dy: number): Promise<string> {
  try {
    await run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      windowsScript(dx, dy),
    ]);
    return "powershell";
  } catch (error) {
    console.error("[mouse&cheese] windows", outputOf(error));
    throw new Error(
      "No se pudo mover el puntero con PowerShell. Revisa que powershell.exe pueda ejecutarse en tu sesión.",
    );
  }
}

async function nudgeMac(
  dx: number,
  dy: number,
  stillActive: () => boolean,
): Promise<string | null> {
  try {
    await run("python3", ["-c", MAC_SCRIPT, String(dx), String(dy)]);
    return "quartz";
  } catch (error) {
    if (!stillActive()) return null;
    const missingQuartz =
      isMissing(error) ||
      (error instanceof CommandError &&
        (error.status === 42 || error.stderr.includes("QUARTZ_MISSING")));

    if (missingQuartz && (await commandExists("cliclick"))) {
      if (!stillActive()) return null;
      try {
        await run("cliclick", [
          `m:${cliclickToken(dx)},${cliclickToken(dy)}`,
          "w:550",
          `m:${cliclickToken(-dx)},${cliclickToken(-dy)}`,
        ]);
        return "cliclick";
      } catch (cliclickError) {
        console.error("[mouse&cheese] cliclick", outputOf(cliclickError));
        throw new Error(
          "macOS bloqueó el puntero. En Ajustes del Sistema → Privacidad y seguridad → Accesibilidad, permite la terminal o la app que ejecuta este servidor.",
        );
      }
    }

    console.error("[mouse&cheese] macos", outputOf(error));

    if (missingQuartz) {
      throw new Error(
        "Python no tiene Quartz y cliclick no está disponible. Instala PyObjC o cliclick, y concede permiso de Accesibilidad.",
      );
    }

    throw new Error(
      "macOS bloqueó el puntero. En Ajustes del Sistema → Privacidad y seguridad → Accesibilidad, permite la terminal o la app que ejecuta este servidor.",
    );
  }
}

async function nudgeWithTool(
  command: "xdotool" | "ydotool",
  dx: number,
  dy: number,
): Promise<void> {
  const move =
    command === "xdotool"
      ? 'xdotool mousemove_relative -- "$1" "$2" && sleep 0.55 && xdotool mousemove_relative -- "$((-1 * $1))" "$((-1 * $2))"'
      : 'ydotool mousemove -- "$1" "$2" && sleep 0.55 && ydotool mousemove -- "$((-1 * $1))" "$((-1 * $2))"';

  await run("bash", ["-c", move, "nudge", String(dx), String(dy)]);
}

export function platformLabel(): "windows" | "macos" | "linux" | "other" {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  return "other";
}

export function defaultTool(): string {
  if (process.platform === "win32") return "powershell";
  if (process.platform === "darwin") return "quartz";
  if (process.platform === "linux") return "xdotool";
  return "ninguno";
}

export async function nudgeAndReturn(stillActive: () => boolean): Promise<string | null> {
  if (!stillActive()) return null;

  const magnitude = 32 + Math.floor(Math.random() * 9);
  const dx = Math.random() < 0.5 ? magnitude : -magnitude;
  const dy = Math.random() < 0.5 ? 18 : -18;
  assertDelta(dx, dy);

  if (process.platform === "win32") {
    if (!stillActive()) return null;
    return nudgeWindows(dx, dy);
  }
  if (process.platform === "darwin") {
    if (!stillActive()) return null;
    return nudgeMac(dx, dy, stillActive);
  }
  if (process.platform === "linux") {
    const tool = (await commandExists("xdotool"))
      ? "xdotool"
      : (await commandExists("ydotool"))
        ? "ydotool"
        : null;
    if (!stillActive()) return null;
    if (!tool) {
      throw new Error(
        "No está xdotool ni ydotool. Instala uno de los dos para mover el puntero en Linux.",
      );
    }
    try {
      await nudgeWithTool(tool, dx, dy);
      return tool;
    } catch (error) {
      console.error(`[mouse&cheese] ${tool}`, outputOf(error));
      const text = outputOf(error);
      if (/display|wayland|cannot open|can.?t open|XOpenDisplay/i.test(text)) {
        throw new Error(
          "No hay sesión gráfica a la vista. El puntero se mueve en el equipo donde corre el servidor, con la pantalla activa.",
        );
      }
      if (tool === "ydotool") {
        throw new Error(
          "ydotool no pudo mover el puntero. Comprueba que el demonio ydotoold esté en marcha.",
        );
      }
      throw new Error(
        "No se pudo mover el puntero en Linux. Revisa xdotool y que la sesión gráfica esté activa.",
      );
    }
  }

  throw new Error("Este sistema no tiene un método para mover el puntero.");
}
