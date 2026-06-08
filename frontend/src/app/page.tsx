"use client";

import React, { useState, useEffect, useCallback } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Types ───────────────────────────────────────────── */
interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  source: string;
  message: string;
  classification: "Hot" | "Warm" | "Cold" | string;
  suggested_reply: string;
  signals: string[];
  status: "New" | "Contacted";
  created_at: string;
}

/* ─── Avatar color palette ────────────────────────────── */
const AVATAR_PALETTES = [
  { bg: "#fce7f3", text: "#9d174d" },
  { bg: "#ede9fe", text: "#5b21b6" },
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#dbeafe", text: "#1e40af" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#e0e7ff", text: "#3730a3" },
  { bg: "#ccfbf1", text: "#134e4a" },
];

function getAvatarPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ─── Formatters ──────────────────────────────────────── */
function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
}
function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}
function sourceLabel(source: string) { return source.replace(/_/g, " "); }

/* ─── Classification config ───────────────────────────── */
const CLS_CONFIG = {
  Hot:          { label: "Hot Lead",      pill: "bg-rose-50 text-rose-600 border-rose-200",    pillGlow: "0 0 0 3px #fee2e2", rowBorder: "border-l-rose-500",   selBg: "bg-violet-50", selBorder: "border-l-violet-500" },
  Warm:         { label: "Warm Lead",     pill: "bg-amber-50 text-amber-700 border-amber-200", pillGlow: "0 0 0 3px #fef3c7", rowBorder: "border-l-amber-400",  selBg: "bg-violet-50", selBorder: "border-l-violet-500" },
  Cold:         { label: "Cold Lead",     pill: "bg-slate-100 text-slate-500 border-slate-200",pillGlow: "0 0 0 3px #f1f5f9", rowBorder: "border-l-slate-300",  selBg: "bg-violet-50", selBorder: "border-l-violet-500" },
  Unclassified: { label: "Unclassified",  pill: "bg-gray-100 text-gray-500 border-gray-200",   pillGlow: "0 0 0 3px #f3f4f6", rowBorder: "border-l-gray-300",   selBg: "bg-violet-50", selBorder: "border-l-violet-500" },
};
function getCls(c: string) { return CLS_CONFIG[c as keyof typeof CLS_CONFIG] ?? CLS_CONFIG["Unclassified"]; }

/* ─── Source Badge ────────────────────────────────────── */
function SourceBadge({ source }: { source: string }) {
  const s = source.toLowerCase();
  const base = "text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded border whitespace-nowrap";
  if (s.includes("whatsapp")) return <span className={`${base} bg-emerald-50 text-emerald-600 border-emerald-200`}>WhatsApp</span>;
  if (s.includes("website") || s.includes("form")) return <span className={`${base} bg-violet-50 text-violet-600 border-violet-200`}>Website</span>;
  return <span className={`${base} bg-sky-50 text-sky-600 border-sky-200`}>{sourceLabel(source)}</span>;
}

/* ─── Signal Pill ─────────────────────────────────────── */
const SIGNAL_COLORS = [
  { bg: "#f3e8ff", border: "#c084fc", text: "#7e22ce" }, // violet
  { bg: "#fff1f2", border: "#fb7185", text: "#be123c" }, // rose
  { bg: "#fffbeb", border: "#fbbf24", text: "#92400e" }, // amber
  { bg: "#ecfdf5", border: "#34d399", text: "#065f46" }, // emerald
  { bg: "#eff6ff", border: "#60a5fa", text: "#1e40af" }, // sky
];

function SignalPill({ label, index }: { label: string; index: number }) {
  const c = SIGNAL_COLORS[index % SIGNAL_COLORS.length];
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
      style={{ background: c.bg, borderColor: c.border, color: c.text }}
    >
      <svg className="h-2.5 w-2.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      {label}
    </span>
  );
}

/* ─── Stat Pill ───────────────────────────────────────── */
function StatPill({ label, count, style }: { label: string; count: number; style: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style}`}>
      {label}<span className="font-bold tabular-nums">{count}</span>
    </span>
  );
}

/* ─── Send Email Button ───────────────────────────────── */
function SendEmailBtn({ status, onClick }: { status: string; onClick: () => void }) {
  const base = "flex items-center gap-1.5 text-[11px] font-semibold text-white rounded-lg px-3.5 py-1.5 transition-all active:scale-[0.97] disabled:cursor-not-allowed";
  const bg = status === "sent" ? "bg-emerald-500" : status === "error" ? "bg-rose-500" : "";
  return (
    <button
      id="send-email-btn"
      onClick={onClick}
      disabled={status === "sending" || status === "sent"}
      className={`${base} ${bg} ${!bg ? "hover:opacity-90" : ""}`}
      style={!bg ? { background: "#4f46e5" } : {}}
    >
      {status === "sending" ? (
        <><span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" /><span>Sending…</span></>
      ) : status === "sent" ? (
        <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg><span>Sent!</span></>
      ) : status === "error" ? (
        <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg><span>Failed</span></>
      ) : (
        <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span>Send Email</span></>
      )}
    </button>
  );
}

/* ════════════════════════════════════════════════════════
   Main Page
════════════════════════════════════════════════════════ */
export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selected, setSelected] = useState<Lead | null>(null);
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  /* ── Data fetching ── */
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/leads`);
      if (!res.ok) throw new Error(`${res.status}`);
      setLeads(await res.json());
      setError(null);
    } catch {
      setError(`Cannot reach backend at ${API_BASE_URL}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { setDraftText(selected?.suggested_reply ?? ""); setEmailStatus("idle"); }, [selected]);

  /* ── Handlers ── */
  const handleToggleStatus = async (lead: Lead) => {
    setUpdatingId(lead.id);
    const next = lead.status === "New" ? "Contacted" : "New";
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      const updated: Lead = await res.json();
      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l));
      if (selected?.id === lead.id) setSelected(updated);
    } catch { alert("Failed to update status."); }
    finally { setUpdatingId(null); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!selected || emailStatus === "sending") return;
    setEmailStatus("sending");
    try {
      const res = await fetch(`${API_BASE_URL}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: selected.email, to_name: selected.name, subject: `Re: Your enquiry — LeadFlow AI`, body: draftText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setEmailStatus("sent");
      if (selected.status !== "Contacted") {
        const pr = await fetch(`${API_BASE_URL}/leads/${selected.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Contacted" }),
        });
        if (pr.ok) {
          const updated: Lead = await pr.json();
          setLeads(prev => prev.map(l => l.id === selected.id ? updated : l));
          setSelected(updated);
        }
      }
      setTimeout(() => setEmailStatus("idle"), 4000);
    } catch { setEmailStatus("error"); setTimeout(() => setEmailStatus("idle"), 4000); }
  };

  /* ── Derived state ── */
  const filtered = leads.filter(l => {
    const q = searchQuery.toLowerCase();
    return (!q || l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.message.toLowerCase().includes(q))
      && (classFilter === "All" || l.classification === classFilter)
      && (statusFilter === "All" || l.status === statusFilter);
  });

  const hotN = leads.filter(l => l.classification === "Hot").length;
  const warmN = leads.filter(l => l.classification === "Warm").length;
  const coldN = leads.filter(l => l.classification === "Cold").length;
  const contactedN = leads.filter(l => l.status === "Contacted").length;
  const hasSplit = selected !== null;

  /* ════════════════════════════════════════════════════
     Render
  ════════════════════════════════════════════════════ */
  return (
    <div className="h-screen flex flex-col bg-[#f5f5f5] overflow-hidden" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>

      {/* ── Top Header ── */}
      <header className="shrink-0 h-11 flex items-center justify-between px-5 border-b border-[#ebebeb] bg-white z-20">
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-md bg-violet-600 flex items-center justify-center shadow-sm">
            <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-[13px] font-bold tracking-tight text-gray-900">LeadFlow AI</span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-violet-500 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">CRM</span>
        </div>
        <button
          id="refresh-btn"
          onClick={fetchLeads}
          className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 hover:text-gray-800 bg-white hover:bg-gray-50 border border-[#e8e8e8] rounded-md px-3 py-1.5 transition-all active:scale-[0.97]"
        >
          <svg className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18.7" />
          </svg>
          Refresh
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══ LEFT PANEL ══ */}
        <aside className={`shrink-0 flex flex-col bg-white border-r border-[#ebebeb] overflow-hidden transition-all duration-300 ease-in-out ${hasSplit ? "w-[290px]" : "w-full max-w-xl mx-auto border-x border-[#ebebeb]"}`}>
          {/* Search + Filters */}
          <div className="shrink-0 px-3 pt-3 pb-2.5 space-y-2 border-b border-[#f0f0f0]">
            <div className="relative">
              <svg className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="lead-search" type="text" placeholder="Search leads…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-[12px] bg-[#f9f9f9] border border-[#ebebeb] rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-300 focus:bg-white placeholder-gray-400 transition"
              />
            </div>
            <div className="flex gap-2">
              {[
                { id: "triage-filter",  val: classFilter,  set: setClassFilter,  opts: ["All Triage","🔥 Hot","☀️ Warm","❄️ Cold"],        vals: ["All","Hot","Warm","Cold"] },
                { id: "status-filter",  val: statusFilter, set: setStatusFilter, opts: ["All Statuses","New","Contacted"],                 vals: ["All","New","Contacted"] },
              ].map(({ id, val, set, opts, vals }) => (
                <div key={id} className="relative flex-1">
                  <select id={id} value={val} onChange={e => set(e.target.value)}
                    className="w-full appearance-none bg-[#f9f9f9] border border-[#ebebeb] rounded-md px-2.5 py-1.5 pr-6 text-[11px] font-medium text-gray-600 focus:outline-none cursor-pointer">
                    {opts.map((o, i) => <option key={o} value={vals[i]}>{o}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-2 top-2.5 h-3 w-3 text-gray-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              ))}
            </div>
          </div>

          {/* Stat strip */}
          <div className="shrink-0 flex flex-wrap gap-1.5 px-3 py-2 border-b border-[#f0f0f0] bg-[#fafafa]">
            <StatPill label="Total"  count={leads.length} style="bg-white text-gray-600 border-gray-200" />
            <StatPill label="Hot"    count={hotN}         style="bg-rose-50 text-rose-600 border-rose-200" />
            <StatPill label="Warm"   count={warmN}        style="bg-amber-50 text-amber-700 border-amber-200" />
            <StatPill label="Cold"   count={coldN}        style="bg-slate-100 text-slate-500 border-slate-200" />
            <StatPill label="✓"      count={contactedN}   style="bg-emerald-50 text-emerald-600 border-emerald-200" />
          </div>

          {/* Lead list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {error && !loading && (
              <div className="m-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 space-y-1">
                <p className="font-semibold">Connection error</p>
                <p className="text-rose-600">{error}</p>
                <button onClick={fetchLeads} className="underline font-semibold">Retry</button>
              </div>
            )}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <div className="h-5 w-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <span className="text-[11px] text-gray-400">Loading leads…</span>
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-400">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-[12px] font-medium">No leads found</p>
              </div>
            )}
            {!loading && filtered.map(lead => {
              const isSel = selected?.id === lead.id;
              const isContacted = lead.status === "Contacted";
              const c = getCls(lead.classification);
              const palette = getAvatarPalette(lead.name);
              return (
                <button
                  key={lead.id}
                  id={`lead-row-${lead.id}`}
                  onClick={() => setSelected(isSel ? null : lead)}
                  className={`w-full text-left flex items-start gap-3 px-3 py-3 border-b border-[#f5f5f5] border-l-[3px] transition-all duration-150 active:scale-[0.99]
                    ${isSel ? `${c.selBg} ${c.selBorder}` : `${lead.classification === "Hot" ? "bg-rose-50 border-l-rose-500" : `bg-white ${c.rowBorder}`} hover:bg-gray-50`}
                    ${isContacted ? "opacity-55" : ""}`}
                >
                  <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold uppercase select-none"
                    style={{ background: palette.bg, color: palette.text }}>
                    {getInitials(lead.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-gray-900 truncate">{lead.name}</span>
                      <div className="shrink-0">
                        {isContacted
                          ? <span className="text-[9px] font-medium text-gray-400">Contacted</span>
                          : <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 block" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <SourceBadge source={lead.source} />
                      <span className="text-[11px] text-gray-400 truncate leading-none">{lead.message}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ══ RIGHT PANEL ══ */}
        <main className={`flex-1 overflow-hidden flex flex-col bg-[#f5f5f5] transition-all duration-300 ${hasSplit ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          {selected ? (
            /* ── Fully utilised layout: header bar + 2-col grid ── */
            <div className="h-full flex flex-col px-4 py-3 gap-3">

              {/* ── Compact header bar ── */}
              <div
                className="shrink-0 bg-white border border-[#f0f0f0] rounded-xl px-4 py-2.5 flex items-center justify-between gap-3"
                style={{ background: "linear-gradient(180deg,#fafafa 0%,#ffffff 70%)" }}
              >
                {/* Left: back + avatar + name + badge + source */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setSelected(null)}
                    className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors active:scale-[0.97] p-0.5"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                  <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold uppercase select-none"
                    style={{ background: getAvatarPalette(selected.name).bg, color: getAvatarPalette(selected.name).text }}>
                    {getInitials(selected.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-[17px] font-semibold tracking-tight text-gray-950 leading-none truncate">{selected.name}</h1>
                      <span
                        className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${getCls(selected.classification).pill}`}
                        style={{ boxShadow: getCls(selected.classification).pillGlow }}
                      >{getCls(selected.classification).label}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      via <span className="text-gray-600 font-medium">{sourceLabel(selected.source)}</span>
                      <span className="mx-1 text-gray-300">·</span>
                      <span>#{selected.id}</span>
                    </p>
                  </div>
                </div>

                {/* Right: contact info + divider + button */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden lg:flex items-center gap-5">
                    {[
                      { lbl: "Email",    val: <a href={`mailto:${selected.email}`} className="text-gray-700 hover:text-violet-600 font-medium transition-colors">{selected.email}</a> },
                      { lbl: "Phone",    val: <a href={`tel:${selected.phone}`}    className="text-gray-700 hover:text-violet-600 font-medium transition-colors">{selected.phone}</a> },
                      { lbl: "Captured", val: <span className="text-gray-700 font-medium">{formatDate(selected.created_at)}</span> },
                    ].map(({ lbl, val }) => (
                      <div key={lbl}>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{lbl}</p>
                        <div className="text-[11px] mt-0.5">{val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden lg:block w-px h-8 bg-gray-100" />
                  <button
                    id={`contact-btn-${selected.id}`}
                    onClick={() => handleToggleStatus(selected)}
                    disabled={updatingId === selected.id}
                    className={`shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3.5 py-2 rounded-lg border transition-all active:scale-[0.97] ${
                      selected.status === "Contacted"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                        : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    {updatingId === selected.id
                      ? <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      : selected.status === "Contacted"
                      ? <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      : null}
                    {selected.status === "Contacted" ? "Contacted" : "Mark as Contacted"}
                  </button>
                </div>
              </div>

              {/* ── 2-col grid: Message | Draft ── */}
              <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">

                {/* LEFT — Inbound Message */}
                <div className="flex flex-col min-h-0">
                  <p className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Inbound Message</p>
                  <div className="flex-1 border border-[#f0f0f0] rounded-xl overflow-hidden flex flex-col" style={{ background: "#fffef5" }}>
                    <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#f5f0e8]">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold uppercase select-none"
                          style={{ background: getAvatarPalette(selected.name).bg, color: getAvatarPalette(selected.name).text }}>
                          {getInitials(selected.name)}
                        </div>
                        <span className="text-[11px] font-semibold text-gray-700">{selected.name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">{formatTime(selected.created_at)}</span>
                    </div>
                    <div className="flex-1 px-4 py-3 overflow-y-auto custom-scrollbar">
                      <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                    </div>
                    {selected.signals && selected.signals.length > 0 && (
                      <div className="shrink-0 px-4 py-3 border-t border-[#f5f0e8]">
                        <p className="text-[8px] font-bold uppercase tracking-widest text-amber-600 mb-2">Intent Signals</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selected.signals.map((s, i) => <SignalPill key={s} label={s} index={i} />)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT — Draft Response */}
                <div className="flex flex-col min-h-0">
                  <p className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Draft Response</p>
                  <div className="flex-1 bg-white border border-[#f0f0f0] rounded-xl overflow-hidden flex flex-col" style={{ borderTop: "2px solid #8b5cf6" }}>
                    {/* Header */}
                    <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#f5f5f5] bg-[#fafafa]">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                        </span>
                        <span className="text-[10px] font-semibold text-gray-600">AI Reply Generator</span>
                      </div>
                      <span className="text-[9px] text-gray-400">Editable draft</span>
                    </div>

                    {/* Textarea — always shown */}
                    <div className="flex-1 p-4 overflow-hidden" style={{ background: "#fafafa" }}>
                      <textarea
                        id="draft-textarea"
                        value={draftText}
                        onChange={e => setDraftText(e.target.value)}
                        placeholder={selected.suggested_reply ? "" : "Write your reply here…"}
                        className="w-full h-full text-[13px] text-gray-700 leading-relaxed bg-transparent border-0 p-0 focus:ring-0 focus:outline-none resize-none placeholder-gray-300"
                        style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
                      />
                    </div>

                    {/* Footer actions — always shown */}
                    <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-[#f0f0f0] bg-white">
                      <span className="text-[10px] text-gray-400 italic">Edit before sending.</span>
                      <div className="flex items-center gap-2">
                        <button
                          id="copy-draft-btn"
                          onClick={handleCopy}
                          className={`flex items-center gap-1.5 text-[11px] font-semibold border rounded-lg px-3 py-1.5 transition-all active:scale-[0.97] ${
                            copied ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-[#e0e0e0] text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {copied
                            ? <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                          {copied ? "Copied!" : "Copy Draft"}
                        </button>
                        <SendEmailBtn status={emailStatus} onClick={handleSendEmail} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-300">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-[13px]">Select a lead to view details</p>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
