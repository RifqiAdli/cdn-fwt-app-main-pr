import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatBytes } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Users, FolderOpen, HardDrive, Activity } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalFiles: 0, totalStorage: 0, totalBandwidth: 0 });
  const [recentFiles, setRecentFiles] = useState<any[]>([]);

  const load = async () => {
    const [usersRes, filesRes, statsRes] = await Promise.all([
      supabase.from('user_roles').select('user_id', { count: 'exact' }),
      supabase.from('files').select('id, name, size, created_at, user_id, mime_type').order('created_at', { ascending: false }).limit(10),
      supabase.from('user_stats').select('*'),
    ]);

    const allStats = statsRes.data || [];
    setStats({
      totalUsers: new Set([...allStats.map((s: any) => s.user_id), ...(filesRes.data || []).map((f: any) => f.user_id)]).size,
      totalFiles: allStats.reduce((s: number, u: any) => s + (u.total_files || 0), 0),
      totalStorage: allStats.reduce((s: number, u: any) => s + Number(u.total_storage || 0), 0),
      totalBandwidth: allStats.reduce((s: number, u: any) => s + Number(u.total_bandwidth || 0), 0),
    });
    setRecentFiles(filesRes.data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const cards = [
    { icon: Users, label: 'Total Users', value: stats.totalUsers.toString() },
    { icon: FolderOpen, label: 'Total Files', value: stats.totalFiles.toString() },
    { icon: HardDrive, label: 'Total Storage', value: formatBytes(stats.totalStorage) },
    { icon: Activity, label: 'Total Bandwidth', value: formatBytes(stats.totalBandwidth) },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-display font-bold">Admin Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card glass-card-hover p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <c.icon className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-display font-bold">{c.value}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
        <h2 className="text-sm font-medium mb-4">Recent Files (All Users)</h2>
        <div className="space-y-2">
          {recentFiles.map(f => (
            <div key={f.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50 text-sm">
              <div className="truncate flex-1 mr-4">
                <span className="font-medium">{f.name}</span>
                <span className="text-muted-foreground ml-2">{f.mime_type}</span>
              </div>
              <span className="text-muted-foreground text-xs">{formatBytes(Number(f.size))}</span>
            </div>
          ))}
          {recentFiles.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No files yet</p>}
        </div>
      </motion.div>
    </div>
  );
}
