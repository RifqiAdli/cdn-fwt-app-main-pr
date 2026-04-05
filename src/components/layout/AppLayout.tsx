import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import {
  LayoutDashboard, FolderOpen, Upload, BarChart2, Settings, LogOut, ChevronLeft, ChevronRight, Shield,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatBytes } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: FolderOpen, label: 'Files', to: '/files' },
  { icon: Upload, label: 'Upload', to: '/upload' },
  { icon: BarChart2, label: 'Analytics', to: '/analytics' },
  { icon: Settings, label: 'Settings', to: '/settings' },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [stats, setStats] = useState<{ total_storage: number; storage_limit: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_stats').select('total_storage, storage_limit').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setStats(data); });
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };
  const usedPct = stats ? (Number(stats.total_storage) / Number(stats.storage_limit)) * 100 : 0;
  const barColor = usedPct > 85 ? 'bg-destructive' : usedPct > 60 ? 'bg-warning' : 'bg-success';

  return (
    <div className="flex min-h-screen">
      <aside className={`flex flex-col border-r border-border bg-surface transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className="flex items-center justify-between h-14 px-4 border-b border-border">
          {!collapsed && <span className="font-display text-lg font-bold">FOOPTRA <span className="text-gradient">CDN</span></span>}
          <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:text-foreground hover:bg-glass-hover'} ${collapsed ? 'justify-center' : ''}`
            }>
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:text-foreground hover:bg-glass-hover'} ${collapsed ? 'justify-center' : ''}`
            }>
              <Shield className="w-5 h-5 shrink-0" />
              {!collapsed && <span>Admin</span>}
            </NavLink>
          )}
        </nav>

        <div className="p-3 border-t border-border space-y-3">
          {!collapsed && stats && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Storage</span>
                <span>{formatBytes(Number(stats.total_storage))} / {formatBytes(Number(stats.storage_limit))}</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
              </div>
            </div>
          )}
          <button onClick={handleSignOut} className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-glass-hover transition-all ${collapsed ? 'justify-center' : ''}`}>
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  );
}
