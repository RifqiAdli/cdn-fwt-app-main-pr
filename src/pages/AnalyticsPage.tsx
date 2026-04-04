import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBytes, getFileType, getFileColor } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Activity, Users, HardDrive, TrendingUp } from 'lucide-react';

const CHART_TOOLTIP_STYLE = {
  background: 'rgba(10,10,10,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#e5e5e5',
  fontSize: 13,
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState(7);
  const [logs, setLogs] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const since = subDays(new Date(), range).toISOString();

    Promise.all([
      supabase.from('access_logs')
        .select('*, files!inner(user_id, name, mime_type)')
        .eq('files.user_id', user.id)
        .gte('created_at', since)
        .order('created_at', { ascending: true }),
      supabase.from('files')
        .select('*')
        .eq('user_id', user.id)
        .order('download_count', { ascending: false })
        .limit(10),
    ]).then(([logsRes, filesRes]) => {
      setLogs(logsRes.data || []);
      setFiles(filesRes.data || []);
      setLoading(false);
    });

    // Realtime
    const channel = supabase
      .channel(`analytics-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'access_logs' },
        (payload) => setLogs(prev => [...prev, payload.new]))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, range]);

  // Bandwidth per day
  const bandwidthByDay = Array.from({ length: range }, (_, i) => {
    const date = subDays(new Date(), range - 1 - i);
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayLogs = logs.filter(l => l.created_at?.startsWith(dayStr));
    return {
      date: format(date, 'MMM dd'),
      bandwidth: dayLogs.reduce((sum: number, l: any) => sum + (Number(l.bytes_served) || 0), 0),
      requests: dayLogs.length,
    };
  });

  // Event type breakdown
  const eventBreakdown = ['view', 'download', 'copy_link'].map(type => ({
    name: type.replace('_', ' '),
    count: logs.filter(l => l.event_type === type).length,
  }));

  // File type distribution from user's files
  const typeMap: Record<string, number> = {};
  files.forEach(f => {
    const t = getFileType(f.mime_type);
    typeMap[t] = (typeMap[t] || 0) + 1;
  });
  const typeDistribution = Object.entries(typeMap).map(([name, value]) => ({
    name,
    value,
    color: getFileColor(name as any),
  }));

  // Top files
  const topFiles = files.slice(0, 10);

  const totalRequests = logs.length;
  const totalBandwidth = logs.reduce((s: number, l: any) => s + (Number(l.bytes_served) || 0), 0);
  const uniqueIps = new Set(logs.map(l => l.ip_address)).size;

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-display font-bold">Analytics</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                range === d ? 'accent-gradient text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Activity, label: 'Total Requests', value: totalRequests.toLocaleString() },
          { icon: Users, label: 'Unique Visitors', value: uniqueIps.toLocaleString() },
          { icon: HardDrive, label: 'Bandwidth Served', value: formatBytes(totalBandwidth) },
          { icon: TrendingUp, label: 'Top File', value: topFiles[0]?.name?.slice(0, 20) || '—' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card glass-card-hover p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <s.icon className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-display font-bold truncate">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Bandwidth Chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
        <h2 className="text-sm font-medium mb-4">Bandwidth Over Time</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={bandwidthByDay}>
            <defs>
              <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217,91%,68%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217,91%,68%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12 }} tickFormatter={v => formatBytes(v, 0)} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [formatBytes(v), 'Bandwidth']} />
            <Area type="monotone" dataKey="bandwidth" stroke="hsl(217,91%,68%)" fill="url(#bwGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests Breakdown */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5">
          <h2 className="text-sm font-medium mb-4">Requests by Type</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={eventBreakdown}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12 }} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="hsl(217,91%,68%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* File Type Distribution */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
          <h2 className="text-sm font-medium mb-4">File Type Distribution</h2>
          {typeDistribution.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-10">No files yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {typeDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Top Files */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-5">
        <h2 className="text-sm font-medium mb-4">Top Files by Downloads</h2>
        {topFiles.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No download data yet</p>
        ) : (
          <div className="space-y-3">
            {topFiles.map((file, i) => {
              const maxDl = topFiles[0]?.download_count || 1;
              const pct = (file.download_count / maxDl) * 100;
              return (
                <div key={file.id} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.name}</p>
                    <div className="h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
                      <div className="h-full accent-gradient rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">{file.download_count}</span>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
