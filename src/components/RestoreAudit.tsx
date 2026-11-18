import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

export default function RestoreAudit() {
  const { guildId } = useParams();
  const { data = [], isLoading } = useQuery({
    queryKey: ["restoreAudit", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/restore-audit`);
      if (!res.ok) throw new Error("Failed to load restore timeline");
      return res.json();
    },
    enabled: !!guildId
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Restore Audit Timeline</h2>
        <p className="text-on-surface-variant text-sm">Trace snapshot creation, restore actions, and drift warnings.</p>
      </div>

      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 space-y-3">
        {isLoading && <div className="text-xs text-on-surface-variant">Loading timeline...</div>}
        {!isLoading && data.length === 0 && <div className="text-xs text-on-surface-variant">No backup/restore events found yet.</div>}
        {data.map((entry: any) => (
          <div key={entry.id} className="p-3 rounded-xl border border-outline-variant/10 bg-surface-container-high">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-white">{String(entry.event_type || "").replaceAll("_", " ")}</div>
              <div className="text-[11px] text-on-surface-variant">{new Date(entry.created_at).toLocaleString()}</div>
            </div>
            <div className="text-xs text-on-surface-variant mt-1">Severity: {entry.severity || "info"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
