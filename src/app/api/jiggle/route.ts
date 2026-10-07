import { getStatus, startJiggler, stopJiggler } from "@/lib/jiggler";
import { isLocalHostname, REMOTE_MOUSE_ERROR } from "@/lib/host";
import { isInterval, type IntervalSeconds } from "@/lib/protocol";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export function GET() {
  return NextResponse.json(getStatus(), { headers: noStore });
}

function runsAwayFromTheUser(request: Request) {
  return Boolean(process.env.VERCEL) || !isLocalHostname(request.headers.get("host"));
}

export async function POST(request: Request) {
  if (runsAwayFromTheUser(request)) {
    return NextResponse.json(
      { ...getStatus(), running: false, lastError: REMOTE_MOUSE_ERROR, error: REMOTE_MOUSE_ERROR },
      { status: 409, headers: noStore },
    );
  }

  let body: { action?: unknown; intervalSeconds?: unknown };
  try {
    body = (await request.json()) as { action?: unknown; intervalSeconds?: unknown };
  } catch {
    return NextResponse.json({ error: "La petición no es válida." }, { status: 400, headers: noStore });
  }

  if (body.action === "stop") {
    return NextResponse.json(stopJiggler(), { headers: noStore });
  }

  if (body.action === "start") {
    const interval = body.intervalSeconds ?? 15;
    if (typeof interval !== "number" || !isInterval(interval)) {
      return NextResponse.json(
        { error: "El intervalo tiene que ser 5, 15, 30 o 60 segundos." },
        { status: 400, headers: noStore },
      );
    }
    const status = await startJiggler(interval as IntervalSeconds);
    return NextResponse.json(status, { headers: noStore });
  }

  return NextResponse.json(
    { error: "Acción desconocida. Usa start o stop." },
    { status: 400, headers: noStore },
  );
}
