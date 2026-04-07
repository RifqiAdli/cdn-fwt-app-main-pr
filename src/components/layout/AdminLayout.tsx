import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LayoutDashboard, Users, FolderOpen, Key, Share2, ArrowLeft, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const adminNav = [
  { icon: LayoutDashboard, label: 'Overview', to: '/admin' },
  { icon: Users, label: 'Users', to: '/admin/users' },
  { icon: FolderOpen, label: 'Files', to: '/admin/files' },
  { icon: Key, label: 'API Keys', to: '/admin/api' },
  { icon: Share2, label: 'Shares', to: '/admin/shares' },
];

export default function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className={`flex flex-col border-r border-border bg-surface transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className="flex items-center justify-between h-14 px-4 border-b border-border">
          {!collapsed && (
            <span className="font-display text-lg font-bold">
              FOOPTRA <span className="text-gradient">ADMIN</span>
            </span>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {adminNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:text-foreground hover:bg-glass-hover'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <button onClick={() => navigate('/dashboard')} className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-glass-hover transition-all ${collapsed ? 'justify-center' : ''}`}>
            <ArrowLeft className="w-4 h-4" />
            {!collapsed && <span>Back to App</span>}
          </button>
          <button onClick={async () => { await signOut(); navigate('/auth'); }} className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-glass-hover transition-all ${collapsed ? 'justify-center' : ''}`}>
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
