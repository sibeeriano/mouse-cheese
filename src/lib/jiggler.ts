import { defaultTool, nudgeAndReturn, platformLabel } from "@/lib/mover";
import {
  isInterval,
  type IntervalSeconds,
  type JiggleStatus,
} from "@/lib/protocol";

type LoopState = {
  running: boolean;
  intervalSeconds: IntervalSeconds;
  timer: ReturnType<typeof setTimeout> | null;
  nextNudgeAt: number | null;
  lastNudgeAt: number | null;
  lastError: string | null;
  tool: string;
  generation: number;
  startPromise: Promise<JiggleStatus> | null;
  cleanupHooked: boolean;
};

const GLOBAL_KEY = Symbol.for("mouse-cheese.jiggler");

type GlobalWithJiggler = typeof globalThis & {
  [GLOBAL_KEY]?: LoopState;
};

function getState(): LoopState {
  const root = globalThis as GlobalWithJiggler;
  if (!root[GLOBAL_KEY]) {
    root[GLOBAL_KEY] = {
      running: false,
      intervalSeconds: 15,
      timer: null,
      nextNudgeAt: null,
      lastNudgeAt: null,
      lastError: null,
      tool: defaultTool(),
      generation: 0,
      startPromise: null,
      cleanupHooked: false,
    };
  }

  const state = root[GLOBAL_KEY];
  if (!state.cleanupHooked) {
    state.cleanupHooked = true;
    process.on("exit", () => {
      halt(state);
    });
  }

  return state;
}

function halt(state: LoopState) {
  state.running = false;
  state.generation += 1;
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
  state.nextNudgeAt = null;
  state.startPromise = null;
}

function snapshot(state: LoopState): JiggleStatus {
  return {
    running: state.running,
    intervalSeconds: state.intervalSeconds,
    nextNudgeAt: state.nextNudgeAt,
    lastNudgeAt: state.lastNudgeAt,
    lastError: state.lastError,
    platform: platformLabel(),
    tool: state.tool,
  };
}

function clearTimer(state: LoopState) {
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
}

function arm(state: LoopState, generation: number) {
  if (!state.running || state.generation !== generation) return;
  clearTimer(state);
  const delay = state.intervalSeconds * 1000;
  state.nextNudgeAt = Date.now() + delay;
  const timer = setTimeout(() => {
    if (!state.running || state.generation !== generation) return;
    state.timer = null;
    void tick(state, generation);
  }, delay);
  timer.unref?.();
  state.timer = timer;
}

async function performNudge(state: LoopState, generation: number): Promise<boolean> {
  if (!state.running || state.generation !== generation) return false;

  try {
    const tool = await nudgeAndReturn(
      () => state.running && state.generation === generation,
    );
    if (!state.running || state.generation !== generation || tool == null) return false;
    state.tool = tool;
    state.lastError = null;
    state.lastNudgeAt = Date.now();
    return true;
  } catch (error) {
    if (!state.running || state.generation !== generation) return false;
    state.lastError =
      error instanceof Error ? error.message : "No se pudo mover el puntero.";
    state.running = false;
    state.nextNudgeAt = null;
    clearTimer(state);
    return false;
  }
}

async function tick(state: LoopState, generation: number) {
  const ok = await performNudge(state, generation);
  if (!ok) return;
  arm(state, generation);
}

function reschedule(state: LoopState, intervalSeconds: IntervalSeconds): JiggleStatus {
  state.intervalSeconds = intervalSeconds;
  if (state.running) arm(state, state.generation);
  return snapshot(state);
}

export function getStatus(): JiggleStatus {
  return snapshot(getState());
}

export function stopJiggler(): JiggleStatus {
  const state = getState();
  halt(state);
  return snapshot(state);
}

export function startJiggler(intervalSeconds: IntervalSeconds): Promise<JiggleStatus> {
  const state = getState();

  if (!isInterval(intervalSeconds)) {
    return Promise.reject(new Error("El intervalo tiene que ser 5, 15, 30 o 60 segundos."));
  }

  if (state.running && state.startPromise) {
    return state.startPromise.then((status) => {
      if (!status.running || state.intervalSeconds === intervalSeconds) return snapshot(state);
      return reschedule(state, intervalSeconds);
    });
  }

  if (state.running) {
    if (state.intervalSeconds === intervalSeconds) return Promise.resolve(snapshot(state));
    return Promise.resolve(reschedule(state, intervalSeconds));
  }

  state.running = true;
  state.intervalSeconds = intervalSeconds;
  state.lastError = null;
  state.generation += 1;
  const generation = state.generation;

  const promise = (async () => {
    const ok = await performNudge(state, generation);
    if (state.generation !== generation) return snapshot(state);
    if (!ok) return snapshot(state);
    arm(state, generation);
    return snapshot(state);
  })();

  state.startPromise = promise;
  void promise.finally(() => {
    if (state.startPromise === promise) state.startPromise = null;
  });

  return promise;
}
