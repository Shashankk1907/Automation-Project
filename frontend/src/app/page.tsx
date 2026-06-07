"use client";

import React, { useState, useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  source: string;
  message: string;
  classification: "Hot" | "Warm" | "Cold";
  suggested_reply: string;
  status: "New" | "Contacted";
  created_at: string;
}

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  
  // UI States
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [draftText, setDraftText] = useState("");
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Fetch leads on mount
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/leads`);
      if (!res.ok) {
        throw new Error(`Error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setLeads(data);
      setError(null);
    } catch (err: any) {
      console.error("Fetch leads failed:", err);
      setError(`Failed to load leads from backend API. Make sure the FastAPI server is running at ${API_BASE_URL}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Update draft text when selected lead changes
  useEffect(() => {
    if (selectedLead) {
      setDraftText(selectedLead.suggested_reply || "");
    } else {
      setDraftText("");
    }
  }, [selectedLead]);

  // Update lead status to Contacted
  const handleMarkAsContacted = async (id: number, currentStatus: "New" | "Contacted") => {
    setUpdatingId(id);
    try {
      const nextStatus = currentStatus === "New" ? "Contacted" : "New";
      const res = await fetch(`${API_BASE_URL}/leads/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      const updatedLead = await res.json();
      setLeads((prevLeads) =>
        prevLeads.map((l) => (l.id === id ? updatedLead : l))
      );
      
      // Update selected lead details if open
      if (selectedLead && selectedLead.id === id) {
        setSelectedLead(updatedLead);
      }
    } catch (err) {
      alert("Error updating lead status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Copy reply to clipboard
  const handleCopyReply = (reply: string, leadId: number) => {
    navigator.clipboard.writeText(reply);
    setCopyingId(leadId);
    setTimeout(() => {
      setCopyingId(null);
    }, 2000);
  };

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.message.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesClassification =
      classificationFilter === "All" || lead.classification === classificationFilter;
      
    const matchesStatus =
      statusFilter === "All" || lead.status === statusFilter;
      
    return matchesSearch && matchesClassification && matchesStatus;
  });

  // Calculate statistics
  const totalCount = leads.length;
  const hotCount = leads.filter((l) => l.classification === "Hot").length;
  const warmCount = leads.filter((l) => l.classification === "Warm").length;
  const coldCount = leads.filter((l) => l.classification === "Cold").length;
  const contactedCount = leads.filter((l) => l.status === "Contacted").length;

  // Helpers to get initials and class colors
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="h-screen bg-zinc-50/50 text-zinc-900 flex flex-col font-sans overflow-hidden antialiased">
      {/* Top Header */}
      <header className="border-b border-zinc-200/50 bg-white/80 backdrop-blur-md h-14 flex items-center justify-between px-6 shrink-0 z-20 shadow-2xs">
        <div className="flex items-center space-x-3.5">
          <div className="h-7 w-7 rounded-lg bg-zinc-900 flex items-center justify-center font-bold text-white shadow-xs">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[15px] font-bold text-zinc-900 tracking-tight">
              LeadFlow AI
            </span>
            <span className="text-[9px] font-semibold tracking-wide text-zinc-500 uppercase bg-zinc-100 border border-zinc-200/40 px-2 py-0.5 rounded-md">
              CRM Sandbox
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={fetchLeads} 
            className="flex items-center space-x-2 text-xs font-semibold text-zinc-650 hover:text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200/80 rounded-lg px-3.5 py-1.5 shadow-2xs transition-all duration-150 active:scale-97"
          >
            <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin text-zinc-800" : "text-zinc-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18.7" />
            </svg>
            <span>Refresh Workspace</span>
          </button>
        </div>
      </header>

      {/* Main Split-Pane Workspace */}
      <div className="flex-1 flex overflow-hidden relative justify-center bg-zinc-50/20 p-4 lg:p-6 gap-6">
        {/* Left Feed Pane */}
        <aside className={`premium-transition bg-white border border-zinc-200/50 flex flex-col h-full overflow-hidden shrink-0 shadow-2xs rounded-2xl ${
          selectedLead 
            ? "w-full lg:w-[380px] lg:max-w-[380px]" 
            : "w-full max-w-2xl"
        } ${selectedLead ? "hidden lg:flex" : "flex"}`}>
          {/* Header Controls */}
          <div className="p-4 border-b border-zinc-150 bg-white shrink-0 space-y-3">
            {/* Search leads */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by name, email, query keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50/50 border border-zinc-200/80 rounded-lg pl-9 pr-3.5 py-2 text-xs focus:outline-none focus:bg-white focus:border-zinc-400 text-zinc-850 placeholder-zinc-450 transition-all duration-150"
              />
              <svg className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Quick dropdown filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value)}
                  className="w-full bg-zinc-50/50 border border-zinc-200/60 hover:border-zinc-300 rounded-lg px-2.5 py-1.5 pr-7 text-[11px] font-medium text-zinc-650 focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="All">All Triage</option>
                  <option value="Hot">🔥 Hot</option>
                  <option value="Warm">☀️ Warm</option>
                  <option value="Cold">❄️ Cold</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                  <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>

              <div className="relative flex-1">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-zinc-50/50 border border-zinc-200/60 hover:border-zinc-300 rounded-lg px-2.5 py-1.5 pr-7 text-[11px] font-medium text-zinc-650 focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                  <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Inline Stats pills */}
          <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-zinc-150 bg-zinc-50/40 shrink-0 select-none">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-white text-zinc-600 border border-zinc-200/30 font-medium">
              Total: {totalCount}
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100 font-semibold">
              Hot: {hotCount}
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/40 font-semibold">
              Warm: {warmCount}
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200/40 font-medium">
              Cold: {coldCount}
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 font-semibold">
              ✓ {contactedCount}
            </span>
          </div>

          {/* Leads Feed List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-[11px] space-y-1.5">
                <p className="font-semibold">Connection issue:</p>
                <p className="text-zinc-600">{error}</p>
                <button onClick={fetchLeads} className="text-rose-700 underline font-bold hover:text-rose-900 block">
                  Retry connection
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2.5">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-zinc-800 border-t-transparent"></div>
                <span className="text-[11px] text-zinc-450 font-medium">Refreshing list...</span>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="py-16 text-center">
                <svg className="mx-auto h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2 text-xs font-semibold text-zinc-700">No leads found</p>
                <p className="text-[10px] text-zinc-450 mt-1 max-w-[200px] mx-auto leading-relaxed">
                  Try adjusting filters or checking the search query.
                </p>
              </div>
            ) : (
              filteredLeads.map((lead) => {
                const isSelected = selectedLead && selectedLead.id === lead.id;
                const isContacted = lead.status === "Contacted";
                
                // Determine card color styles based on classification and selected status
                let cardClass = "";
                let avatarColor = "";
                
                if (lead.classification === "Hot") {
                  avatarColor = isSelected ? "bg-rose-600 text-white border-rose-600" : "bg-rose-50 text-rose-700 border-rose-200/50";
                  cardClass = isSelected 
                    ? "bg-rose-100/50 border-rose-350 ring-1 ring-rose-200 shadow-sm border-l-4 border-l-rose-500"
                    : `bg-rose-50/15 hover:bg-rose-50/30 border-rose-100/70 border-l-4 border-l-rose-500/80 ${isContacted ? "opacity-60" : ""}`;
                } else if (lead.classification === "Warm") {
                  avatarColor = isSelected ? "bg-amber-550 text-white border-amber-550" : "bg-amber-50 text-amber-850 border-amber-200/40";
                  cardClass = isSelected 
                    ? "bg-amber-100/50 border-amber-350 ring-1 ring-amber-200 shadow-sm border-l-4 border-l-amber-500"
                    : `bg-amber-50/15 hover:bg-amber-50/30 border-amber-150/60 border-l-4 border-l-amber-500/80 ${isContacted ? "opacity-60" : ""}`;
                } else { // Cold
                  avatarColor = isSelected ? "bg-zinc-600 text-white border-zinc-650" : "bg-zinc-50 text-zinc-600 border-zinc-200/60";
                  cardClass = isSelected 
                    ? "bg-zinc-150/60 border-zinc-350 ring-1 ring-zinc-250 shadow-sm border-l-4 border-l-zinc-500"
                    : `bg-zinc-50/25 hover:bg-zinc-50/45 border-zinc-200/60 border-l-4 border-l-zinc-400/80 ${isContacted ? "opacity-60" : ""}`;
                }

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`flex items-start space-x-3 p-3 rounded-xl border transition-all duration-150 cursor-pointer ${cardClass}`}
                  >
                    {/* Initials Avatar */}
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 border select-none ${avatarColor}`}>
                      {getInitials(lead.name)}
                    </div>

                    {/* Meta Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold truncate text-zinc-900">
                          {lead.name}
                        </span>
                        
                        {/* Status indicators */}
                        {isContacted ? (
                          <span className="text-[9px] font-semibold tracking-wide shrink-0 text-zinc-400">
                            Contacted
                          </span>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" title="New message"></span>
                        )}
                      </div>

                      {/* Source and snippet */}
                      <div className="flex items-center space-x-2 text-[10px]">
                        <span className={`px-1.5 py-0.2 rounded font-medium border uppercase tracking-wider text-[8px] ${
                          lead.source === "website_form" ? "bg-purple-100/50 text-purple-700 border-purple-200/50" :
                          lead.source === "whatsapp" ? "bg-emerald-100/50 text-emerald-700 border-emerald-200/50" :
                          "bg-sky-100/50 text-sky-700 border-sky-200/50"
                        }`}>
                          {lead.source}
                        </span>
                        <span className="text-zinc-400">•</span>
                        <span className="truncate text-zinc-500">
                          {lead.message}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Active Lead Workspace */}
        <main className={`premium-transition bg-white border border-zinc-200/50 rounded-2xl shadow-2xs h-full flex flex-col overflow-hidden ${
          selectedLead 
            ? "flex-1 max-w-[800px] opacity-100 translate-x-0" 
            : "max-w-0 opacity-0 translate-x-12 overflow-hidden pointer-events-none border-transparent"
        }`}>
          {selectedLead && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 min-w-[380px] sm:min-w-[480px] w-full flex flex-col justify-between h-full">
              <div className="max-w-3xl w-full mx-auto space-y-6 flex-1 flex flex-col justify-between">
                
                {/* Top Triage Section */}
                <div className="space-y-4">
                  {/* Close Button */}
                  <button 
                    onClick={() => setSelectedLead(null)} 
                    className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 bg-white hover:bg-zinc-50 border border-zinc-200/80 rounded-xl px-3 py-1.5 shadow-2xs transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Close Details</span>
                  </button>

                  {/* Main Identity Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                        <h2 className="text-2xl font-bold text-zinc-950 tracking-tight leading-none">
                          {selectedLead.name}
                        </h2>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider shadow-2xs ${
                          selectedLead.classification === "Hot"
                            ? "bg-rose-50 text-rose-700 border-rose-200/60"
                            : selectedLead.classification === "Warm"
                            ? "bg-amber-50 text-amber-850 border-amber-200/40"
                            : "bg-slate-50 text-slate-655 border-slate-200/40"
                        }`}>
                          {selectedLead.classification} Lead
                        </span>
                      </div>
                      
                      <p className="text-xs text-zinc-450 font-medium">
                        Inbound channel: <span className="font-semibold text-zinc-650 uppercase">{selectedLead.source}</span>
                      </p>
                    </div>

                    {/* Status Toggle Action */}
                    <div className="shrink-0 flex items-center">
                      <button
                        onClick={() => handleMarkAsContacted(selectedLead.id, selectedLead.status)}
                        disabled={updatingId === selectedLead.id}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-150 flex items-center space-x-2 active:scale-97 shadow-2xs ${
                          selectedLead.status === "Contacted"
                            ? "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                            : "bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800"
                        }`}
                      >
                        {updatingId === selectedLead.id ? (
                          <>
                            <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-zinc-400 border-t-transparent"></span>
                            <span>Updating...</span>
                          </>
                        ) : selectedLead.status === "Contacted" ? (
                          <>
                            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Mark Uncontacted</span>
                          </>
                        ) : (
                          <span>Mark as Contacted</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Metadata Contact Details */}
                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4.5 rounded-2xl border border-zinc-200/40 text-xs shadow-2xs border-t-3 ${
                  selectedLead.classification === "Hot" ? "border-t-rose-500" :
                  selectedLead.classification === "Warm" ? "border-t-amber-500" :
                  "border-t-zinc-400"
                }`}>
                  <div>
                    <span className="text-zinc-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Email Address</span>
                    <a href={`mailto:${selectedLead.email}`} className="text-zinc-700 hover:text-indigo-650 font-semibold transition-colors break-all">
                      {selectedLead.email}
                    </a>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Phone Number</span>
                    <a href={`tel:${selectedLead.phone}`} className="text-zinc-700 hover:text-indigo-650 font-semibold transition-colors">
                      {selectedLead.phone}
                    </a>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-bold text-[9px] uppercase tracking-wider mb-0.5">Captured Date</span>
                    <span className="text-zinc-700 font-semibold">
                      {new Date(selectedLead.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Message Context */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Inbound Message</span>
                  <div className="bg-white p-5 rounded-2xl border border-zinc-200/50 shadow-2xs relative">
                    <div className="absolute top-4 left-4 h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-[10px] text-zinc-600 uppercase select-none">
                      {getInitials(selectedLead.name)}
                    </div>
                    <div className="pl-8 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-450">
                        <span className="font-semibold text-zinc-700">{selectedLead.name}</span>
                        <span>{new Date(selectedLead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-zinc-750 leading-relaxed whitespace-pre-wrap pt-1.5">
                        {selectedLead.message}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Suggested response panel */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Draft Response</span>
                    {selectedLead.suggested_reply && (
                      <button
                        onClick={() => handleCopyReply(draftText, selectedLead.id)}
                        className="text-xs font-semibold text-zinc-800 hover:text-zinc-950 flex items-center space-x-1.5 transition-colors bg-white hover:bg-zinc-50 border border-zinc-200/80 rounded-lg px-2.5 py-1 shadow-2xs"
                      >
                        {copyingId === selectedLead.id ? (
                          <>
                            <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-emerald-600 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span>Copy Draft</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-zinc-200/50 shadow-2xs overflow-hidden flex flex-col">
                    {/* Editor Frame header */}
                    <div className="px-4 py-2 border-b border-zinc-150 bg-zinc-50/50 flex items-center justify-between text-[10px] text-zinc-450">
                      <div className="flex items-center space-x-2">
                        <span className="h-2 w-2 rounded-full bg-violet-500"></span>
                        <span className="font-semibold text-zinc-700">AI Reply Generator</span>
                      </div>
                      <span>Editable Draft</span>
                    </div>
                    
                    {/* Textarea Composer */}
                    <div className="p-4 bg-white">
                      {selectedLead.suggested_reply ? (
                        <textarea
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          rows={4}
                          className="w-full text-xs text-zinc-750 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none leading-relaxed resize-none font-sans"
                        />
                      ) : (
                        <div className="py-6 text-center text-xs text-zinc-450 italic">
                          No auto-reply suggested for this lead.
                        </div>
                      )}
                    </div>

                    {/* Editor actions footer */}
                    {selectedLead.suggested_reply && (
                      <div className="px-4 py-3 border-t border-zinc-150 bg-zinc-50/30 flex items-center justify-between shrink-0">
                        <div className="text-[10px] text-zinc-450 italic">
                          Click text to tweak this response manually.
                        </div>
                        
                        <a
                          href={`mailto:${selectedLead.email}?body=${encodeURIComponent(draftText)}`}
                          className="flex items-center space-x-1.5 text-xs font-semibold bg-zinc-950 text-white hover:bg-zinc-800 rounded-lg px-4.5 py-1.5 shadow-xs transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span>Send Email</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom footer metadata */}
              <div className="pt-6 border-t border-zinc-200/50 text-[10px] text-zinc-400 text-center shrink-0">
                LeadFlow ID: {selectedLead.id} • Processed by automated local LLM agent pipeline.
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
