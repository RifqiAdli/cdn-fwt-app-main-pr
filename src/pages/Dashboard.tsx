import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBytes } from '@/lib/utils';
import { Cloud, HardDrive, Download, Wifi, FileText, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  delay: number;
}

function StatCard({ icon: Icon, label, value, sub, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card glass-card-hover p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <p className="text-2xl font-display font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recentFiles, setRecentFiles] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setStats(data));

    supabase.from('files').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setRecentFiles(data || []));

    // Realtime for stats
    const channel = supabase
      .channel(`dashboard-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stats', filter: `user_id=eq.${user.id}` },
        (payload) => setStats(payload.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'files', filter: `user_id=eq.${user.id}` },
        (payload) => setRecentFiles(prev => [payload.new, ...prev].slice(0, 10)))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Mock chart data
  const chartData = Array.from({ length: 7 }, (_, i) => ({
    date: format(new Date(Date.now() - (6 - i) * 86400000), 'MMM dd'),
    bandwidth: Math.floor(Math.random() * 500000000),
  }));

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your CDN</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Cloud} label="Total Files" value={String(stats?.total_files ?? 0)} sub="Across all folders" delay={0} />
        <StatCard icon={HardDrive} label="Storage Used" value={formatBytes(Number(stats?.total_storage ?? 0))} sub={`of ${formatBytes(Number(stats?.storage_limit ?? 5368709120))}`} delay={0.05} />
        <StatCard icon={Download} label="Total Downloads" value={String(stats?.total_downloads ?? 0)} sub="All time" delay={0.1} />
        <StatCard icon={Wifi} label="Bandwidth" value={formatBytes(Number(stats?.total_bandwidth ?? 0))} sub="All time" delay={0.15} />
      </div>

      {/* Chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
        <h2 className="text-sm font-medium mb-4">Bandwidth (7 days)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217,91%,68%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217,91%,68%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12 }} tickFormatter={v => formatBytes(v, 0)} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e5e5e5', fontSize: 13 }}
              formatter={(v: number) => [formatBytes(v), 'Bandwidth']}
            />
            <Area type="monotone" dataKey="bandwidth" stroke="hsl(217,91%,68%)" fill="url(#bwGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Recent Files */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
        <h2 className="text-sm font-medium mb-4">Recent Uploads</h2>
        {recentFiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No files yet. Upload your first file!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Size</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {recentFiles.map(file => (
                  <tr key={file.id} className="border-b border-border/50 hover:bg-glass-hover transition-colors">
                    <td className="py-2.5 max-w-[200px] truncate">{file.name}</td>
                    <td className="py-2.5 text-muted-foreground">{formatBytes(Number(file.size))}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                        {file.mime_type.split('/')[1]?.toUpperCase() || 'FILE'}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted-foreground">{format(new Date(file.created_at), 'MMM dd, HH:mm')}</td>
                    <td className="py-2.5">
                      <button onClick={() => copyUrl(file.public_url)} className="text-muted-foreground hover:text-primary transition-colors" title="Copy URL">
                        <Copy className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
