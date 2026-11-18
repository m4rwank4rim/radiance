import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { openUpgradeCheckout } from "../lib/billing";

interface SecuritySettings {
  link_reputation_enabled: boolean;
  link_allowlist: string[];
  link_blocklist: string[];
  link_expiration_hours: number | null;
  link_preview_safe_only: boolean;
  ml_spam_detection: boolean;
  behavioral_fingerprinting: boolean;
  join_spam_correlation: boolean;
  attachment_scanning: boolean;
  adaptive_slowmode: boolean;
  velocity_tracking: boolean;
  cross_server_blacklist: boolean;
  captcha_on_links: boolean;
  phone_verification_required: boolean;
  quarantine_mode: boolean;
  predictive_raid_detection: boolean;
  auto_lockdown: boolean;
  honeytrap_enabled: boolean;
  honeytrap_channel_ids: string[];
  raid_join_threshold: number;
  raid_window_seconds: number;
}

const defaultSettings: SecuritySettings = {
  link_reputation_enabled: false,
  link_allowlist: [],
  link_blocklist: [],
  link_expiration_hours: null,
  link_preview_safe_only: false,
  ml_spam_detection: false,
  behavioral_fingerprinting: false,
  join_spam_correlation: false,
  attachment_scanning: false,
  adaptive_slowmode: false,
  velocity_tracking: false,
  cross_server_blacklist: false,
  captcha_on_links: false,
  phone_verification_required: false,
  quarantine_mode: false,
  predictive_raid_detection: false,
  auto_lockdown: false,
  honeytrap_enabled: false,
  honeytrap_channel_ids: [],
  raid_join_threshold: 8,
  raid_window_seconds: 20,
};

export default function AdvancedSecurity() {
  const { guildId } = useParams();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SecuritySettings>(defaultSettings);
  const [newAllowlistUrl, setNewAllowlistUrl] = useState("");
  const [newBlocklistUrl, setNewBlocklistUrl] = useState("");
  const [testLinkUrl, setTestLinkUrl] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testResults, setTestResults] = useState<any>(null);
  const [lockdownActive, setLockdownActive] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);

  // Fetch security settings
  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["advancedSecurity", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/security/advanced`);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    enabled: !!guildId,
  });

  // Fetch raid status
  const { data: raidStatus } = useQuery({
    queryKey: ["raidStatus", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/security/raid-status`);
      if (!res.ok) return { lockdownActive: false };
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 5000,
  });

  // Fetch channels for honeytrap selection
  const { data: channels = [] } = useQuery({
    queryKey: ["channels", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/channels`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId,
  });

  const { data: entitlements } = useQuery({
    queryKey: ["entitlements", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/entitlements`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!guildId
  });
  const aiLocked = !(entitlements?.features?.ai_moderation);

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/incidents`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 7000
  });

  const { data: riskEvents = [] } = useQuery({
    queryKey: ["riskEvents", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/moderation/risk-events`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!guildId,
    refetchInterval: 7000
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({ ...defaultSettings, ...savedSettings });
    }
  }, [savedSettings]);

  useEffect(() => {
    if (raidStatus) {
      setLockdownActive(raidStatus.lockdownActive);
    }
  }, [raidStatus]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: Partial<SecuritySettings>) => {
      const res = await fetch(`/api/guilds/${guildId}/security/advanced`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to save settings (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advancedSecurity", guildId] });
      toast.success("Security settings saved");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save settings");
      console.error("Save settings error:", err);
    },
  });

  // Test link mutation
  const testLinkMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch(`/api/guilds/${guildId}/security/check-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("Failed to check link");
      return res.json();
    },
    onSuccess: (data) => {
      setTestResults({ type: "link", data });
    },
  });

  // Test message mutation
  const testMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/guilds/${guildId}/security/analyze-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to analyze message");
      return res.json();
    },
    onSuccess: (data) => {
      setTestResults({ type: "message", data });
    },
  });

  // Lockdown mutation
  const lockdownMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const res = await fetch(`/api/guilds/${guildId}/security/lockdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed to toggle lockdown");
      return res.json();
    },
    onSuccess: (data) => {
      setLockdownActive(data.lockdownActive);
      toast.success(data.lockdownActive ? "Server locked down" : "Lockdown released");
    },
    onError: () => {
      toast.error("Failed to toggle lockdown");
    },
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch(`/api/guilds/${guildId}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, severity: "medium", playbook: "none" })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Failed to create incident" }))).error);
      return res.json();
    },
    onSuccess: () => {
      setIncidentTitle("");
      queryClient.invalidateQueries({ queryKey: ["incidents", guildId] });
      toast.success("Incident created");
    },
    onError: (err: any) => setAccessError(err?.message || "Failed to create incident")
  });

  const incidentActionMutation = useMutation({
    mutationFn: async ({ incidentId, actionType }: { incidentId: string; actionType: string }) => {
      const res = await fetch(`/api/guilds/${guildId}/incidents/${incidentId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_type: actionType })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Failed to apply incident action" }))).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", guildId] });
      toast.success("Incident action applied");
    },
    onError: (err: any) => setAccessError(err?.message || "Failed to apply incident action")
  });

  const updateSetting = <K extends keyof SecuritySettings>(
    key: K,
    value: SecuritySettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveMutation.mutate({ [key]: value });
  };

  const addToAllowlist = () => {
    if (!newAllowlistUrl.trim()) return;
    const newList = [...settings.link_allowlist, newAllowlistUrl.trim()];
    updateSetting("link_allowlist", newList);
    setNewAllowlistUrl("");
  };

  const removeFromAllowlist = (url: string) => {
    const newList = settings.link_allowlist.filter((u) => u !== url);
    updateSetting("link_allowlist", newList);
  };

  const addToBlocklist = () => {
    if (!newBlocklistUrl.trim()) return;
    const newList = [...settings.link_blocklist, newBlocklistUrl.trim()];
    updateSetting("link_blocklist", newList);
    setNewBlocklistUrl("");
  };

  const removeFromBlocklist = (url: string) => {
    const newList = settings.link_blocklist.filter((u) => u !== url);
    updateSetting("link_blocklist", newList);
  };

  const toggleHoneytrapChannel = (channelId: string) => {
    const currentIds = settings.honeytrap_channel_ids;
    const newIds = currentIds.includes(channelId)
      ? currentIds.filter((id) => id !== channelId)
      : [...currentIds, channelId];
    updateSetting("honeytrap_channel_ids", newIds);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Advanced Security</h2>
          <p className="text-on-surface-variant text-sm">Premium anti-spam, link protection, and raid prevention tools.</p>
        </div>
        <div className="flex items-center gap-4">
          {lockdownActive && (
            <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold animate-pulse">
              LOCKDOWN ACTIVE
            </span>
          )}
        </div>
      </div>

      {/* Emergency Lockdown */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/20">
              <span className="material-symbols-outlined text-red-400 text-2xl">shield_alert</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Emergency Lockdown</h3>
              <p className="text-sm text-red-300/70">
                {lockdownActive
                  ? "Server is currently locked. Only admins can send messages."
                  : "Instantly lock all channels during a raid or emergency."}
              </p>
            </div>
          </div>
          <button
            onClick={() => lockdownMutation.mutate(!lockdownActive)}
            disabled={lockdownMutation.isPending}
            className={cn(
              "px-6 py-3 rounded-xl font-bold text-sm transition-all",
              lockdownActive
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            )}
          >
            {lockdownMutation.isPending
              ? "Processing..."
              : lockdownActive
              ? "Release Lockdown"
              : "Activate Lockdown"}
          </button>
        </div>
      </div>

      {/* Incidents + risk timeline */}
      <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6 space-y-4">
        {aiLocked && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between gap-3">
            <span>AI moderation features are locked on Free plan. Upgrade to access incidents and playbooks.</span>
            <button
              onClick={() => guildId && openUpgradeCheckout(guildId, "business").catch((err) => toast.error(err?.message || "Checkout unavailable"))}
              className="px-3 py-1.5 rounded-md bg-amber-400/20 text-amber-200 text-[11px] font-bold whitespace-nowrap"
            >
              Upgrade Plan
            </button>
          </div>
        )}
        {accessError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{accessError}</div>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Incident Desk</h3>
            <p className="text-xs text-on-surface-variant">Live risk signals and incident playbook controls.</p>
          </div>
          <div className="flex gap-2">
            <input
              value={incidentTitle}
              onChange={(e) => setIncidentTitle(e.target.value)}
              placeholder="Create manual incident..."
              className="bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-xs text-white"
            />
            <button
              onClick={() => createIncidentMutation.mutate(incidentTitle)}
              disabled={aiLocked || !incidentTitle.trim() || createIncidentMutation.isPending}
              className="px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {riskEvents.slice(0, 12).map((event: any) => (
              <div key={event.id} className="p-3 rounded-lg bg-surface-container-high border border-outline-variant/10">
                <div className="text-xs font-bold text-white">{event.event_type}</div>
                <div className="text-[11px] text-on-surface-variant">{new Date(event.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {incidents.slice(0, 12).map((incident: any) => (
              <div key={incident.id} className="p-3 rounded-lg bg-surface-container-high border border-outline-variant/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-white">{incident.title}</div>
                  <span className={cn("text-[10px] uppercase font-bold", incident.status === "open" ? "text-red-400" : "text-green-400")}>{incident.status}</span>
                </div>
                <div className="text-[11px] text-on-surface-variant">Severity: {incident.severity} | Confidence: {incident.confidence || 0}%</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => incidentActionMutation.mutate({ incidentId: incident.id, actionType: "lockdown_channels" })}
                    disabled={aiLocked}
                    className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-[10px] font-bold disabled:opacity-50"
                  >
                    Lockdown
                  </button>
                  <button
                    onClick={() => incidentActionMutation.mutate({ incidentId: incident.id, actionType: "close_incident" })}
                    disabled={aiLocked}
                    className="px-2 py-1 rounded bg-green-500/20 text-green-300 text-[10px] font-bold disabled:opacity-50"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Link Protection */}
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <span className="material-symbols-outlined text-primary text-2xl">link</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Link Protection</h3>
              <p className="text-xs text-on-surface-variant">Reputation scoring and link analysis</p>
            </div>
          </div>

          <div className="space-y-4">
            <SecurityToggle
              label="Link Reputation Check"
              description="Analyze all links against threat databases"
              enabled={settings.link_reputation_enabled}
              onToggle={() => updateSetting("link_reputation_enabled", !settings.link_reputation_enabled)}
            />

            <SecurityToggle
              label="Safe Previews Only"
              description="Replace Discord embeds with safe previews"
              enabled={settings.link_preview_safe_only}
              onToggle={() => updateSetting("link_preview_safe_only", !settings.link_preview_safe_only)}
            />

            <SecurityToggle
              label="Link Expiration"
              description="Auto-delete messages with links after set hours"
              enabled={!!settings.link_expiration_hours}
              onToggle={() => updateSetting("link_expiration_hours", settings.link_expiration_hours ? null : 24)}
            />

            {!!settings.link_expiration_hours && (
              <div className="flex items-center gap-3 pl-12">
                <label className="text-sm text-on-surface-variant">Hours:</label>
                <input
                  type="number"
                  value={settings.link_expiration_hours || 24}
                  onChange={(e) => updateSetting("link_expiration_hours", parseInt(e.target.value) || 24)}
                  className="w-24 bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-1.5 text-sm text-white"
                />
              </div>
            )}
          </div>

          {/* Allowlist */}
          <div className="pt-4 border-t border-outline-variant/10">
            <h4 className="text-sm font-bold text-white mb-3">Trusted Domains (Allowlist)</h4>
            <div className="flex gap-2 mb-3">
              <input
                value={newAllowlistUrl}
                onChange={(e) => setNewAllowlistUrl(e.target.value)}
                placeholder="example.com"
                className="flex-1 bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white"
              />
              <button
                onClick={addToAllowlist}
                className="px-3 py-2 bg-primary rounded-lg text-xs font-bold text-on-primary"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.link_allowlist.map((url) => (
                <span
                  key={url}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 text-green-400 text-xs"
                >
                  {url}
                  <button onClick={() => removeFromAllowlist(url)} className="hover:text-green-300">
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Blocklist */}
          <div className="pt-4 border-t border-outline-variant/10">
            <h4 className="text-sm font-bold text-white mb-3">Blocked Domains (Blocklist)</h4>
            <div className="flex gap-2 mb-3">
              <input
                value={newBlocklistUrl}
                onChange={(e) => setNewBlocklistUrl(e.target.value)}
                placeholder="badsite.com"
                className="flex-1 bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white"
              />
              <button
                onClick={addToBlocklist}
                className="px-3 py-2 bg-error rounded-lg text-xs font-bold text-white"
              >
                Block
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.link_blocklist.map((url) => (
                <span
                  key={url}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs"
                >
                  {url}
                  <button onClick={() => removeFromBlocklist(url)} className="hover:text-red-300">
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ML Spam Detection */}
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-accent/10">
              <span className="material-symbols-outlined text-accent text-2xl">psychology</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">AI Spam Detection</h3>
              <p className="text-xs text-on-surface-variant">ML-powered message analysis</p>
            </div>
          </div>

          <div className="space-y-4">
            <SecurityToggle
              label="ML Spam Detection"
              description="Detect obfuscation, homoglyphs, and spam patterns"
              enabled={settings.ml_spam_detection}
              onToggle={() => updateSetting("ml_spam_detection", !settings.ml_spam_detection)}
            />

            <SecurityToggle
              label="Behavioral Fingerprinting"
              description="Track copy-pasta and cross-channel spam"
              enabled={settings.behavioral_fingerprinting}
              onToggle={() => updateSetting("behavioral_fingerprinting", !settings.behavioral_fingerprinting)}
            />

            <SecurityToggle
              label="Join-Spam Correlation"
              description="Detect coordinated attacks from new members"
              enabled={settings.join_spam_correlation}
              onToggle={() => updateSetting("join_spam_correlation", !settings.join_spam_correlation)}
            />

            <SecurityToggle
              label="Attachment Scanning"
              description="Scan files for malware and suspicious content"
              enabled={settings.attachment_scanning}
              onToggle={() => updateSetting("attachment_scanning", !settings.attachment_scanning)}
            />
          </div>

          {/* Test Message */}
          <div className="pt-4 border-t border-outline-variant/10">
            <h4 className="text-sm font-bold text-white mb-3">Test Message Analysis</h4>
            <div className="space-y-3">
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter a message to analyze..."
                className="w-full bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white min-h-[80px]"
              />
              <button
                onClick={() => testMessageMutation.mutate(testMessage)}
                disabled={!testMessage.trim() || testMessageMutation.isPending}
                className="w-full px-4 py-2 bg-primary rounded-lg text-xs font-bold text-on-primary disabled:opacity-50"
              >
                {testMessageMutation.isPending ? "Analyzing..." : "Analyze Message"}
              </button>
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-secondary/10">
              <span className="material-symbols-outlined text-secondary text-2xl">speed</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Adaptive Rate Limiting</h3>
              <p className="text-xs text-on-surface-variant">Smart slowmode and velocity tracking</p>
            </div>
          </div>

          <div className="space-y-4">
            <SecurityToggle
              label="Adaptive Slowmode"
              description="Auto-adjust slowmode based on activity"
              enabled={settings.adaptive_slowmode}
              onToggle={() => updateSetting("adaptive_slowmode", !settings.adaptive_slowmode)}
            />

            <SecurityToggle
              label="Velocity Tracking"
              description="Detect users sending too many messages"
              enabled={settings.velocity_tracking}
              onToggle={() => updateSetting("velocity_tracking", !settings.velocity_tracking)}
            />

            <SecurityToggle
              label="Cross-Server Blacklist"
              description="Block known spammers from other servers"
              enabled={settings.cross_server_blacklist}
              onToggle={() => updateSetting("cross_server_blacklist", !settings.cross_server_blacklist)}
            />
          </div>
        </div>

        {/* Verification Systems */}
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-tertiary/10">
              <span className="material-symbols-outlined text-tertiary text-2xl">verified_user</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Verification Systems</h3>
              <p className="text-xs text-on-surface-variant">Captcha and verification gates</p>
            </div>
          </div>

          <div className="space-y-4">
            <SecurityToggle
              label="Captcha on Links"
              description="Require captcha before posting links"
              enabled={settings.captcha_on_links}
              onToggle={() => updateSetting("captcha_on_links", !settings.captcha_on_links)}
            />

            <SecurityToggle
              label="Phone Verification Required"
              description="Require verified phone for certain actions"
              enabled={settings.phone_verification_required}
              onToggle={() => updateSetting("phone_verification_required", !settings.phone_verification_required)}
            />

            <SecurityToggle
              label="Quarantine Mode"
              description="Hold suspicious messages for review"
              enabled={settings.quarantine_mode}
              onToggle={() => updateSetting("quarantine_mode", !settings.quarantine_mode)}
            />
          </div>
        </div>

        {/* Raid Protection */}
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-8 space-y-6 lg:col-span-2">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-error/10">
              <span className="material-symbols-outlined text-error text-2xl">security</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Raid Protection</h3>
              <p className="text-xs text-on-surface-variant">Predictive detection and auto-lockdown</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SecurityToggle
              label="Predictive Raid Detection"
              description="ML model detects raids 30-60 seconds early"
              enabled={settings.predictive_raid_detection}
              onToggle={() => updateSetting("predictive_raid_detection", !settings.predictive_raid_detection)}
            />

            <SecurityToggle
              label="Auto-Lockdown"
              description="Automatically lock server during raids"
              enabled={settings.auto_lockdown}
              onToggle={() => updateSetting("auto_lockdown", !settings.auto_lockdown)}
            />

            <SecurityToggle
              label="Honeytrap Channels"
              description="Fake channels that auto-ban posters"
              enabled={settings.honeytrap_enabled}
              onToggle={() => updateSetting("honeytrap_enabled", !settings.honeytrap_enabled)}
            />
          </div>

          {/* Raid Thresholds */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/10">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Join Threshold
              </label>
              <input
                type="number"
                value={settings.raid_join_threshold}
                onChange={(e) => updateSetting("raid_join_threshold", parseInt(e.target.value) || 8)}
                className="w-full bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white"
              />
              <p className="text-xs text-on-surface-variant mt-1">Members per minute to trigger alert</p>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Window Seconds
              </label>
              <input
                type="number"
                value={settings.raid_window_seconds}
                onChange={(e) => updateSetting("raid_window_seconds", parseInt(e.target.value) || 20)}
                className="w-full bg-surface-container-high border border-outline-variant/10 rounded-lg px-3 py-2 text-sm text-white"
              />
              <p className="text-xs text-on-surface-variant mt-1">Time window for detection</p>
            </div>
          </div>

          {/* Honeytrap Channel Selection */}
          {settings.honeytrap_enabled && (
            <div className="pt-4 border-t border-outline-variant/10">
              <h4 className="text-sm font-bold text-white mb-3">Select Honeytrap Channels</h4>
              <p className="text-xs text-on-surface-variant mb-3">
                Anyone who posts in these channels will be auto-banned
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {channels
                  .filter((c: any) => c.type === 0) // Text channels only
                  .map((c: any) => (
                    <label
                      key={c.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                        settings.honeytrap_channel_ids.includes(c.id)
                          ? "bg-red-500/20 border border-red-500/30"
                          : "bg-surface-container-high border border-outline-variant/10 hover:border-outline-variant/30"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={settings.honeytrap_channel_ids.includes(c.id)}
                        onChange={() => toggleHoneytrapChannel(c.id)}
                        className="hidden"
                      />
                      <span className="material-symbols-outlined text-sm text-red-400">warning</span>
                      <span className="text-xs text-white truncate">{c.name}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Test Results</h3>
          {testResults.type === "link" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-on-surface-variant">Safety Score:</span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-bold",
                    testResults.data.score > 70
                      ? "bg-green-500/20 text-green-400"
                      : testResults.data.score > 40
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                  )}
                >
                  {testResults.data.score}/100
                </span>
              </div>
              <div className="text-sm text-on-surface-variant">
                Status: {testResults.data.safe ? "Safe" : "Dangerous"}
              </div>
              {testResults.data.reason && (
                <div className="text-sm text-on-surface-variant">
                  Reason: {testResults.data.reason}
                </div>
              )}
            </div>
          )}
          {testResults.type === "message" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-surface-container-high">
                <div className="text-2xl font-bold text-primary">{testResults.data.spamScore}</div>
                <div className="text-xs text-on-surface-variant">Spam Score</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-high">
                <div className="text-lg font-bold text-white">
                  {testResults.data.obfuscationDetected ? "Yes" : "No"}
                </div>
                <div className="text-xs text-on-surface-variant">Obfuscation</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-high">
                <div className="text-lg font-bold text-white">
                  {testResults.data.homoglyphs ? "Yes" : "No"}
                </div>
                <div className="text-xs text-on-surface-variant">Homoglyphs</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-high">
                <div className="text-lg font-bold text-white">
                  {testResults.data.excessiveEmojis ? "Yes" : "No"}
                </div>
                <div className="text-xs text-on-surface-variant">Excessive Emojis</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-high">
                <div className="text-lg font-bold text-white">
                  {Math.round(testResults.data.allCapsRatio * 100)}%
                </div>
                <div className="text-xs text-on-surface-variant">All Caps Ratio</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-high">
                <div className="text-lg font-bold text-white">
                  {testResults.data.repeatedChars ? "Yes" : "No"}
                </div>
                <div className="text-xs text-on-surface-variant">Repeated Chars</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Test Link Section */}
      <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Test Link Reputation</h3>
        <div className="flex gap-3">
          <input
            value={testLinkUrl}
            onChange={(e) => setTestLinkUrl(e.target.value)}
            placeholder="https://example.com/suspicious-link"
            className="flex-1 bg-surface-container-high border border-outline-variant/10 rounded-lg px-4 py-2.5 text-sm text-white"
          />
          <button
            onClick={() => testLinkMutation.mutate(testLinkUrl)}
            disabled={!testLinkUrl.trim() || testLinkMutation.isPending}
            className="px-6 py-2.5 bg-primary rounded-lg text-xs font-bold text-on-primary disabled:opacity-50"
          >
            {testLinkMutation.isPending ? "Checking..." : "Check Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Security Toggle Component
function SecurityToggle({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-high border border-outline-variant/10">
      <div className="flex-1">
        <div className="font-bold text-sm text-white">{label}</div>
        <div className="text-xs text-on-surface-variant mt-0.5">{description}</div>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          "w-11 h-6 rounded-full p-1 transition-all relative",
          enabled ? "bg-primary" : "bg-surface-container-highest border border-outline-variant/20"
        )}
      >
        <div
          className={cn(
            "w-4 h-4 rounded-full bg-white transition-transform",
            enabled ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
