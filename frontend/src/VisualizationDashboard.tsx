import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, Circle, Database, Cpu, GitBranch, RefreshCw,
  Activity, Target, Network, Tag, TrendingUp, ChevronDown, ChevronUp,
  FileText, BookOpen, Brain, Zap, Search, Upload, Layers, MessageSquare,
  Clock, AlertCircle, BarChart2, PieChart as PieChartIcon, ArrowRight,
  ExternalLink, Calendar, X, Filter, Check, Info, ShieldCheck, Sparkles
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const PALETTE = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#10b981', '#0ea5e9'];

interface VizDashboardProps {
  vizData: any;
  analyticsData: any;
  documents: any[];
  projects: any[];
  messages: any[];
  theme: 'dark' | 'light';
  onRefresh: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
}

function getCirclePos(idx: number, total: number, cx: number, cy: number, r: number) {
  const angle = (2 * Math.PI / Math.max(total, 1)) * idx - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, title, subtitle, color = 'text-indigo-500 dark:text-indigo-400' }: any) => (
  <div className="flex items-center gap-3 mb-6">
    <div className={`p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 ${color}`}>
      <Icon size={20} />
    </div>
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, message, sub }: any) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
      <Icon size={24} className="text-slate-400 dark:text-slate-300" />
    </div>
    <p className="text-slate-700 dark:text-slate-100 font-semibold text-sm">{message}</p>
    {sub && <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{sub}</p>}
  </div>
);

const STAGE_ICON_MAP: Record<string, React.ElementType> = {
  'upload': Upload, 'file-text': FileText, 'layers': Layers, 'cpu': Cpu,
  'database': Database, 'search': Search, 'git-branch': GitBranch,
  'brain': Brain, 'book-open': BookOpen,
};

const STATUS_CONFIG = {
  completed: {
    border: 'border-emerald-400/40 dark:border-emerald-500/30',
    bg: 'bg-emerald-50/80 dark:bg-emerald-500/10',
    icon: <CheckCircle2 size={16} className="text-emerald-500" />,
    text: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    label: 'Completed',
    dot: 'bg-emerald-500',
  },
  processing: {
    border: 'border-indigo-400/50 dark:border-indigo-500/40',
    bg: 'bg-indigo-50/80 dark:bg-indigo-500/10',
    icon: <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />,
    text: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    label: 'Processing',
    dot: 'bg-indigo-500 animate-pulse',
  },
  pending: {
    border: 'border-slate-200 dark:border-slate-800',
    bg: 'bg-slate-50/50 dark:bg-slate-800/30',
    icon: <Circle size={16} className="text-slate-300 dark:text-slate-500" />,
    text: 'text-slate-500 dark:text-slate-300',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    label: 'Pending',
    dot: 'bg-slate-300 dark:bg-slate-500',
  },
  failed: {
    border: 'border-red-400/40 dark:border-red-500/30',
    bg: 'bg-red-50/80 dark:bg-red-500/10',
    icon: <XCircle size={16} className="text-red-500" />,
    text: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-100 dark:bg-red-900/40',
    label: 'Failed',
    dot: 'bg-red-500',
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────

const VisualizationDashboard: React.FC<VizDashboardProps> = ({
  vizData, analyticsData, documents, projects, messages, theme, onRefresh
}) => {
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [highlightedSource, setHighlightedSource] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const metrics = analyticsData?.metrics || {};
  const keywords = analyticsData?.keywords || [];
  const sourceDistribution = analyticsData?.source_distribution || vizData?.topic_distribution || [];
  const docsWithScores = analyticsData?.documents_with_scores || [];
  const findings = analyticsData?.findings || [];
  const stages = analyticsData?.workflow_stages || [];
  const timeline = analyticsData?.timeline || [];
  const graph = analyticsData?.graph || { nodes: [], edges: [] };

  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? '#475569' : '#e2e8f0'}`,
    borderRadius: '12px',
    color: theme === 'dark' ? '#ffffff' : '#0f172a',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
  };

  // ── 1. Top Metric Cards Data ────────────────────────────────────────────────
  const totalSources = metrics.total_sources_found ?? (documents.length + (messages.length > 0 ? 1 : 0));
  const relevantSources = metrics.relevant_sources ?? documents.filter((d: any) => (d.extracted_text || '').length > 100).length;
  const docsRetrieved = metrics.documents_retrieved ?? documents.length;
  const keyFindingsCount = metrics.key_findings ?? findings.length;
  const procTime = metrics.processing_time ?? (documents.length > 0 ? '1.4s' : '0.0s');
  const resStatus = metrics.research_status ?? (projects.length > 0 ? 'Completed' : (documents.length > 0 ? 'Processing' : 'Pending'));

  const overviewMetricCards = [
    { label: 'Total Sources Found', value: totalSources, icon: Search, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Relevant Sources', value: relevantSources, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Documents Retrieved', value: docsRetrieved, icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { label: 'Key Findings', value: keyFindingsCount, icon: TrendingUp, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10' },
    { label: 'Processing Time', value: procTime, icon: Clock, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'Research Status', value: resStatus, icon: ShieldCheck, color: resStatus === 'Completed' ? 'text-emerald-500' : 'text-amber-500', bg: resStatus === 'Completed' ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-amber-50 dark:bg-amber-500/10' },
  ];

  // ── SVG Graph Positioning Calculation ───────────────────────────────────────
  const GW = 640, GH = 320;
  const nodeCoords: Record<string, { x: number; y: number }> = {};
  
  const queryNodes = graph.nodes.filter((n: any) => n.type === 'query');
  const sourceNodes = graph.nodes.filter((n: any) => n.type === 'source');
  const findingNodes = graph.nodes.filter((n: any) => n.type === 'finding');
  const reportNodes = graph.nodes.filter((n: any) => n.type === 'report');

  // Layer 1: Query (Left)
  queryNodes.forEach((n: any, idx: number) => {
    nodeCoords[n.id] = { x: 70, y: GH / 2 };
  });

  // Layer 2: Sources (Mid-Left)
  sourceNodes.forEach((n: any, idx: number) => {
    const total = sourceNodes.length;
    const step = GH / (total + 1);
    nodeCoords[n.id] = { x: 220, y: step * (idx + 1) };
  });

  // Layer 3: Findings (Mid-Right)
  findingNodes.forEach((n: any, idx: number) => {
    const total = findingNodes.length;
    const step = GH / (total + 1);
    nodeCoords[n.id] = { x: 420, y: step * (idx + 1) };
  });

  // Layer 4: Report (Right)
  reportNodes.forEach((n: any, idx: number) => {
    nodeCoords[n.id] = { x: 570, y: GH / 2 };
  });

  // Fallback for unexpected node types
  graph.nodes.forEach((n: any, idx: number) => {
    if (!nodeCoords[n.id]) {
      nodeCoords[n.id] = getCirclePos(idx, graph.nodes.length, GW / 2, GH / 2, 100);
    }
  });

  return (
    <div className="animate-in fade-in duration-500 space-y-8 pb-12">

      {/* ─── Dashboard Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
              <Activity size={24} />
            </div>
            AI Research Pipeline Analytics
          </h2>
          <p className="text-slate-500 dark:text-slate-300 text-sm mt-1">
            Real-time visualization of query understanding, source retrieval, semantic RAG, and AI synthesis
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 self-start sm:self-auto"
        >
          <RefreshCw size={16} className="animate-spin-once" />
          Refresh Live Data
        </button>
      </div>

      {/* ─── 1. Research Overview Metric Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {overviewMetricCards.map((m, i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] group"
          >
            <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}>
              <m.icon size={20} className={m.color} />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tight">
              {m.value}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider">
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* ─── 2. Research Workflow Pipeline ─────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
        <SectionHeader
          icon={GitBranch}
          title="Interactive Research Workflow Pipeline"
          subtitle="Real-time status of the 8 autonomous research execution stages"
        />

        <div className="overflow-x-auto pb-4">
          <div className="flex items-center gap-0 min-w-max">
            {stages.map((stage: any, i: number) => {
              const cfg = STATUS_CONFIG[stage.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
              const StageIcon = STAGE_ICON_MAP[stage.icon] || Zap;
              const isLast = i === stages.length - 1;

              return (
                <div key={stage.id} className="flex items-center gap-0">
                  <div
                    onClick={() => setSelectedItem({ title: stage.name, type: 'stage', ...stage })}
                    className={`group relative border rounded-2xl p-3.5 w-36 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer ${cfg.bg} ${cfg.border}`}
                  >
                    {/* Top Row: Icon + Status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-1.5 rounded-lg bg-white dark:bg-slate-900 shadow-sm ${cfg.text}`}>
                        <StageIcon size={14} />
                      </div>
                      <div className="flex items-center gap-1">
                        {cfg.icon}
                      </div>
                    </div>

                    {/* Stage Name */}
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug mb-1 truncate" title={stage.name}>
                      {stage.name}
                    </p>

                    {/* Status & Processing Time */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800">
                      <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.label}</span>
                      {stage.time && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-semibold">{stage.time}</span>
                      )}
                    </div>

                    {/* Item count badge if available */}
                    {stage.count !== null && stage.count !== undefined && stage.count > 0 && (
                      <div className="mt-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${cfg.badgeBg} ${cfg.text}`}>
                          {stage.count} items
                        </span>
                      </div>
                    )}

                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-30 bg-slate-900 dark:bg-slate-800 text-white text-xs rounded-xl px-3 py-2.5 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl border border-slate-700">
                      <p className="font-bold text-indigo-400 mb-1">{stage.name}</p>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{stage.description}</p>
                      <div className="mt-1 text-[10px] text-slate-400 font-mono">Time: {stage.time || 'N/A'}</div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                    </div>
                  </div>

                  {/* Connecting Arrow */}
                  {!isLast && (
                    <div className="flex items-center flex-shrink-0 px-1">
                      <div className="w-4 h-0.5 bg-slate-300 dark:bg-slate-700" />
                      <ArrowRight size={12} className="text-slate-400 dark:text-slate-600 -ml-1" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 3 & 4. Source Distribution + Relevance Ranking ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 3. Source Distribution Donut Chart */}
        <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <SectionHeader
            icon={PieChartIcon}
            title="Source Distribution by Type"
            subtitle="Categorized breakdown of retrieved web & document sources"
            color="text-purple-500 dark:text-purple-400"
          />

          {sourceDistribution.length > 0 ? (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceDistribution}
                    cx="50%" cy="50%"
                    innerRadius={65} outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {sourceDistribution.map((_: any, idx: number) => (
                      <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={PieChartIcon} message="No sources indexed" sub="Upload PDFs or query research assistant to view distribution" />
          )}
        </div>

        {/* 4. Source Relevance Ranking */}
        <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
          <SectionHeader
            icon={Target}
            title="Source Relevance Ranking"
            subtitle="Ranked sources based on content richness & semantic match"
            color="text-emerald-500 dark:text-emerald-400"
          />

          {docsWithScores.length > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {docsWithScores.map((src: any) => {
                const isSelected = selectedItem?.id === src.id;
                return (
                  <div
                    key={src.id}
                    onClick={() => setSelectedItem({ type: 'source', ...src })}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/20 shadow-md'
                        : 'border-slate-100 dark:border-slate-800/80 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      #{src.ranking || src.id}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{src.filename || src.title}</p>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">{src.relevance_score}% match</span>
                      </div>

                      {/* Score Bar */}
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-500"
                          style={{ width: `${src.relevance_score}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">{src.domain || src.file_type}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Target} message="No sources ranked yet" sub="Upload research documents to view relevance scores" />
          )}
        </div>
      </div>

      {/* ─── 5. Research Timeline ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
        <SectionHeader
          icon={Clock}
          title="Chronological Research Timeline"
          subtitle="Step-by-step audit log of research events and execution durations"
          color="text-cyan-500 dark:text-cyan-400"
        />

        {timeline.length > 0 ? (
          <div className="relative pl-4">
            <div className="absolute left-7 top-3 bottom-3 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-emerald-500" />
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {timeline.map((item: any, i: number) => {
                const isQuery = item.type === 'query';
                const isDoc = item.type === 'document';
                const isRag = item.type === 'rag';

                return (
                  <div key={i} className="flex items-start gap-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs z-10 flex-shrink-0 shadow-md ${
                      isQuery ? 'bg-indigo-600' : isDoc ? 'bg-purple-600' : isRag ? 'bg-cyan-600' : 'bg-emerald-600'
                    }`}>
                      {isQuery ? <Search size={12} /> : isDoc ? <FileText size={12} /> : isRag ? <Database size={12} /> : <BookOpen size={12} />}
                    </div>

                    <div className="flex-1 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{item.event}</p>
                        {item.duration && (
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md">
                            {item.duration}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.detail}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">{formatDate(item.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState icon={Clock} message="No research timeline events yet" sub="Perform research or upload files to populate timeline" />
        )}
      </div>

      {/* ─── 6. Source Relationship Graph ───────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
        <SectionHeader
          icon={Network}
          title="Source Relationship Graph"
          subtitle="Interactive network visual connecting Query → Sources → Documents → Key Findings → Final Report"
          color="text-orange-500 dark:text-orange-400"
        />

        {graph.nodes.length > 0 ? (
          <div className="relative">
            <svg viewBox={`0 0 ${GW} ${GH}`} className="w-full h-auto max-h-[350px]">
              <defs>
                <pattern id="graph-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} strokeWidth="0.5" />
                </pattern>
                <radialGradient id="queryG" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </radialGradient>
                <radialGradient id="sourceG" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#9333ea" />
                </radialGradient>
                <radialGradient id="findingG" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </radialGradient>
                <radialGradient id="reportG" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="100%" stopColor="#e11d48" />
                </radialGradient>
              </defs>

              <rect width={GW} height={GH} fill="url(#graph-grid)" rx="16" />

              {/* Edges */}
              {graph.edges.map((edge: any, i: number) => {
                const from = nodeCoords[edge.from];
                const to = nodeCoords[edge.to];
                if (!from || !to) return null;

                const isHighlighted = hoveredNodeId === edge.from || hoveredNodeId === edge.to;
                return (
                  <g key={i}>
                    <line
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke={isHighlighted ? '#6366f1' : (theme === 'dark' ? '#334155' : '#cbd5e1')}
                      strokeWidth={isHighlighted ? 2.5 : 1.2}
                      strokeDasharray={isHighlighted ? 'none' : '4 3'}
                      opacity={isHighlighted ? 1 : 0.5}
                      className="transition-all duration-200"
                    />
                  </g>
                );
              })}

              {/* Nodes */}
              {graph.nodes.map((node: any) => {
                const pos = nodeCoords[node.id];
                if (!pos) return null;

                const isHovered = hoveredNodeId === node.id;
                const isSelected = selectedItem?.id === node.id;
                const gradientId = node.type === 'query' ? 'url(#queryG)' : node.type === 'source' ? 'url(#sourceG)' : node.type === 'finding' ? 'url(#findingG)' : 'url(#reportG)';

                return (
                  <g
                    key={node.id}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={() => setSelectedItem({ type: 'node', ...node })}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Ring glow on hover/selected */}
                    {(isHovered || isSelected) && (
                      <circle cx={pos.x} cy={pos.y} r="24" fill="none" stroke="#818cf8" strokeWidth="2" opacity="0.6" className="animate-ping" />
                    )}
                    <circle cx={pos.x} cy={pos.y} r={isHovered ? 20 : 16} fill={gradientId} opacity="0.9" className="transition-all duration-200" />
                    <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">
                      {node.type.toUpperCase().slice(0, 4)}
                    </text>

                    {/* Tooltip text */}
                    {isHovered && (
                      <g>
                        <rect x={pos.x - 55} y={pos.y - 36} width="110" height="22" rx="6" fill={theme === 'dark' ? '#1e293b' : '#ffffff'} stroke="#818cf8" strokeWidth="1" />
                        <text x={pos.x} y={pos.y - 21} textAnchor="middle" fill={theme === 'dark' ? '#f8fafc' : '#0f172a'} fontSize="8" fontWeight="bold">
                          {node.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 flex-wrap text-xs">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500" /><span className="text-slate-500 dark:text-slate-400 font-medium">Research Query</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-slate-500 dark:text-slate-400 font-medium">Retrieved Source</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-slate-500 dark:text-slate-400 font-medium">Key Finding</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500" /><span className="text-slate-500 dark:text-slate-400 font-medium">Final Report</span></div>
            </div>
          </div>
        ) : (
          <EmptyState icon={Network} message="No graph nodes available" sub="Perform research queries to construct the relationship graph" />
        )}
      </div>

      {/* ─── 7. Key Topics / Keywords Bubble Cloud ─────────────────────────── */}
      <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
        <SectionHeader
          icon={Tag}
          title="Key Topics & Extracted Keywords"
          subtitle="Top concepts discovered across documents & research queries"
          color="text-pink-500 dark:text-pink-400"
        />

        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {keywords.map((kw: any) => {
              const weight = kw.weight || 0.5;
              const isLarge = weight > 0.7;
              const isMed = weight > 0.4;

              const badgeSize = isLarge ? 'text-lg px-5 py-2.5 font-extrabold' : isMed ? 'text-sm px-4 py-2 font-bold' : 'text-xs px-3 py-1.5 font-semibold';
              const styleClass = isLarge
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                : isMed
                  ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700';

              return (
                <div
                  key={kw.word}
                  title={`Frequency: ${kw.count} occurrences`}
                  className={`rounded-full cursor-default transition-all duration-200 hover:scale-110 ${badgeSize} ${styleClass}`}
                >
                  {kw.word}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={Tag} message="No key topics extracted yet" sub="Upload research text to extract high-frequency keywords" />
        )}
      </div>

      {/* ─── 8. Research Findings Summaries ───────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a1a1e] border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
        <SectionHeader
          icon={TrendingUp}
          title="Major Research Findings"
          subtitle="Synthesized findings with confidence scores and supporting source references"
          color="text-emerald-500 dark:text-emerald-400"
        />

        {findings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {findings.map((f: any) => {
              const conf = f.confidence || 85;
              const isSelected = selectedItem?.id === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedItem({ type: 'finding', ...f })}
                  className={`border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 hover:border-indigo-300 dark:hover:border-indigo-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{f.title}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex-shrink-0">
                      {conf}% Confidence
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{f.description}</p>

                  {/* Supporting Sources */}
                  {f.supporting_sources && f.supporting_sources.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sources:</span>
                      {f.supporting_sources.map((srcName: string, idx: number) => (
                        <span key={idx} className="text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                          {srcName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={TrendingUp} message="No findings generated yet" sub="Create a Research Planner project to synthesize findings" />
        )}
      </div>

      {/* ─── 9. Interactive Details Side Drawer Panel ───────────────────────── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedItem(null)}
          />

          <div className="relative w-full max-w-md bg-white dark:bg-[#1a1a1e] border-l border-slate-200 dark:border-slate-800 shadow-2xl h-full overflow-y-auto z-10 animate-in slide-in-from-right duration-300 p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Info size={20} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {selectedItem.type === 'source' ? 'Source Details' : selectedItem.type === 'finding' ? 'Finding Details' : 'Node Details'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Title & Domain */}
            <div>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/20">
                {selectedItem.domain || selectedItem.file_type || selectedItem.type}
              </span>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-2 leading-snug">
                {selectedItem.filename || selectedItem.full_title || selectedItem.title || selectedItem.name}
              </h4>
            </div>

            {/* Match / Confidence */}
            {selectedItem.relevance_score && (
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Relevance Score</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedItem.relevance_score}%</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    style={{ width: `${selectedItem.relevance_score}%` }}
                  />
                </div>
              </div>
            )}

            {/* Content Summary / Excerpt */}
            {(selectedItem.summary || selectedItem.excerpt || selectedItem.description) && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Content Summary</p>
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans max-h-48 overflow-y-auto">
                  {selectedItem.summary || selectedItem.excerpt || selectedItem.description}
                </div>
              </div>
            )}

            {/* Why Selected */}
            {selectedItem.why_selected && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Why Selected</p>
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 p-4 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  <Sparkles size={14} className="inline-block mr-1.5 text-emerald-500 -mt-0.5" />
                  {selectedItem.why_selected}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizationDashboard;
