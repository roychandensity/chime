import { readFileSync } from "fs";
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const token = process.env.DENSITY_API_TOKEN;
const BASE = "https://api.density.io";

async function tryRequest(label: string, body: any) {
  try {
    const res = await fetch(`${BASE}/v3/analytics/metrics`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(`${label}: ${res.status}`);
    console.log(`  ${text.slice(0, 500)}\n`);
  } catch (e: any) {
    console.log(`${label}: ERROR - ${e.message}\n`);
  }
}

async function main() {
  // Use a known space from OWP
  const spaceId = "spc_1509663006617764492"; // OWP building

  // Try different time resolutions
  for (const res of ["1h", "hour", "hourly", "1d", "day", "daily", "15m", "15min"]) {
    await tryRequest(`Resolution "${res}"`, {
      space_ids: [spaceId],
      start_date: "2024-10-01T00:00:00",
      end_date: "2024-10-02T23:59:59",
      time_resolution: res,
    });
  }

  // Try the GET endpoint format instead
  console.log("\n=== Trying GET /v3/spaces/{id}/metrics ===\n");
  try {
    const res = await fetch(`${BASE}/v3/spaces/${spaceId}/metrics?start_date=2024-10-01T00:00:00&end_date=2024-10-02T23:59:59`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    console.log(`GET metrics: ${res.status} - ${text.slice(0, 1000)}\n`);
  } catch (e: any) {
    console.log(`GET metrics: ERROR - ${e.message}\n`);
  }

  // Try count endpoint
  console.log("=== Trying /v3/spaces/{id}/count ===\n");
  try {
    const res = await fetch(`${BASE}/v3/spaces/${spaceId}/count?start_date=2024-10-01T00:00:00&end_date=2024-10-02T23:59:59&time_resolution=1h`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    console.log(`Count: ${res.status} - ${text.slice(0, 1000)}\n`);
  } catch (e: any) {
    console.log(`Count: ERROR - ${e.message}\n`);
  }

  // Let's check what API endpoints exist
  console.log("=== Checking API docs / available endpoints ===\n");
  for (const endpoint of [
    "/v3/analytics",
    "/v3/analytics/metrics",
    "/v3/analytics/count",
    "/v3/analytics/occupancy",
  ]) {
    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      console.log(`GET ${endpoint}: ${res.status} - ${text.slice(0, 300)}\n`);
    } catch (e: any) {
      console.log(`GET ${endpoint}: ERROR - ${e.message}\n`);
    }
  }

  // Try the metrics POST with a desk space (not building)
  console.log("=== Finding a desk space and trying metrics ===\n");
  const { fetchAllSpaces } = await import("../src/lib/density-client");
  const spaces = await fetchAllSpaces();
  const desk = spaces.find((s: any) => s.function === "desk");
  if (desk) {
    console.log(`Desk: ${desk.name} (${desk.id})\n`);

    for (const body of [
      { space_ids: [desk.id], start_date: "2024-10-01T00:00:00", end_date: "2024-10-02T23:59:59", interval: "1h" },
      { space_ids: [desk.id], start_date: "2024-10-01", end_date: "2024-10-02", time_resolution: "1h" },
      { space_ids: [desk.id], start_date: "2024-10-01", end_date: "2024-10-02", interval: "1h" },
      { space_ids: [desk.id], start_date: "2024-10-01T00:00:00", end_date: "2024-10-02T23:59:59" },
    ]) {
      await tryRequest(`POST metrics ${JSON.stringify(body).slice(0, 100)}`, body);
    }
  }
}

main().catch(console.error);
