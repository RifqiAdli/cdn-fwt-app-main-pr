import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatBytes } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Shield, ShieldOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [statsRes, rolesRes] = await Promise.all([
      supabase.from('user_stats').select('*'),
      supabase.from('user_roles').select('*'),
    ]);
    setUsers(statsRes.data || []);
    setRoles(rolesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getUserRole = (userId: string) => {
    const r = roles.find(r => r.user_id === userId);
    return r?.role || 'user';
  };

  const toggleAdmin = async (userId: string) => {
    const isCurrentlyAdmin = roles.some(r => r.user_id === userId && r.role === 'admin');
    if (isCurrentlyAdmin) {
      await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
      toast.success('Admin role removed');
    } else {
      await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' as any });
      toast.success('Admin role granted');
    }
    load();
  };

  if (loading) return <div className="p-6"><div className="skeleton h-64 rounded-xl" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-display font-bold">User Management</h1>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.user_id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-secondary/50">
              <div>
                <p className="text-sm font-mono">{u.user_id.slice(0, 8)}...</p>
                <p className="text-xs text-muted-foreground">
                  {u.total_files} files • {formatBytes(Number(u.total_storage))} • {formatBytes(Number(u.total_bandwidth))} BW
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded ${getUserRole(u.user_id) === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  {getUserRole(u.user_id)}
                </span>
                <button onClick={() => toggleAdmin(u.user_id)} className="text-muted-foreground hover:text-foreground transition-colors" title="Toggle admin">
                  {getUserRole(u.user_id) === 'admin' ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No users found</p>}
        </div>
      </motion.div>
    </div>
  );
}
