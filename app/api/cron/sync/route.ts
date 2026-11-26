import { handleSchedule } from "@vercel/schedules";
import { runSync } from "@/lib/sync/run";

// Privater Sync-Job: nur der Vercel-Scheduler kann diese Funktion aufrufen (schedule/v1beta-Trigger).
export const maxDuration = 300;

export const POST = handleSchedule(async (metadata) => {
  const result = await runSync({ trigger: "schedule" });
  console.log(
    "[sync]",
    metadata.name,
    metadata.executionId,
    JSON.stringify(result.results.map((r) => ({ s: r.source, ok: r.ok, c: r.created, u: r.updated, m: r.matched, rm: r.removed }))),
  );
});
