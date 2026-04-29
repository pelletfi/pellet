import { NextResponse } from "next/server";
import { dashboardSnapshot } from "@/lib/oli/queries";

export const runtime = "nodejs";
// Cache the JSON response at the edge for 5 minutes. Cron only writes new
// data every 6 hours, so 5m staleness is invisible to users and cuts
// function invocations on hot endpoints (marketing landing, /oli, agents)
// to roughly one per 5 minutes per region instead of one per page load.
export const revalidate = 300;

const ALLOWED_WINDOWS = [24, 168, 720, 8760]; // 24h, 7d, 30d, 1y (used as "all" proxy)

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("windowHours") ?? 24);
  const windowHours = ALLOWED_WINDOWS.includes(raw) ? raw : 24;
  const snap = await dashboardSnapshot(windowHours);
  return NextResponse.json(snap, {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
