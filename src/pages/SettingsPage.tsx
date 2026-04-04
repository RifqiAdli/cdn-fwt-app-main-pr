import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBytes } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Key, Copy, Trash2, Plus, Eye, EyeOff, Loader2, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [justCreatedKey, setJustCreatedKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    loadKeys();
    supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setStats(data));
  }, [user]);

  const loadKeys = async () => {
    if (!user) return;
    const { data } = await supabase.from('api_keys').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setApiKeys(data || []);
    setLoading(false);
  };

  const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'fcdn_';
    for (let i = 0; i < 40; i++) key += chars[Math.floor(Math.random() * chars.length)];
    return key;
  };

  const createApiKey = async () => {
    if (!user || !keyName.trim()) return;
    setCreating(true);
    const rawKey = generateKey();
    const keyHash = btoa(rawKey); // Simple hash for demo

    const { error } = await supabase.from('api_keys').insert({
      user_id: user.id,
      name: keyName,
      key_hash: keyHash,
      key_prefix: rawKey.slice(0, 12),
      scopes: ['read', 'upload', 'delete'],
    });

    if (error) {
      toast.error(error.message);
    } else {
      setJustCreatedKey(rawKey);
      setKeyName('');
      loadKeys();
      toast.success('API key created');
    }
    setCreating(false);
  };

  const deleteKey = async (id: string) => {
    await supabase.from('api_keys').delete().eq('id', id);
    loadKeys();
    toast.success('API key deleted');
  };

  const toggleKeyActive = async (key: any) => {
    await supabase.from('api_keys').update({ is_active: !key.is_active }).eq('id', key.id);
    loadKeys();
  };

  const apiBaseUrl = `${window.location.origin}/api/v1`;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-display font-bold">Settings</h1>

      {/* Storage */}
      {stats && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <h2 className="text-sm font-medium mb-4">Storage Usage</h2>
          <div className="flex justify-between text-sm mb-2">
            <span>{formatBytes(Number(stats.total_storage))}</span>
            <span className="text-muted-foreground">of {formatBytes(Number(stats.storage_limit))}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full accent-gradient rounded-full" style={{ width: `${Math.min((Number(stats.total_storage) / Number(stats.storage_limit)) * 100, 100)}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 text-center">
            <div><p className="text-lg font-bold">{stats.total_files}</p><p className="text-xs text-muted-foreground">Files</p></div>
            <div><p className="text-lg font-bold">{stats.total_downloads}</p><p className="text-xs text-muted-foreground">Downloads</p></div>
            <div><p className="text-lg font-bold">{formatBytes(Number(stats.total_bandwidth))}</p><p className="text-xs text-muted-foreground">Bandwidth</p></div>
          </div>
        </motion.div>
      )}

      {/* API Keys */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium flex items-center gap-2"><Key className="w-4 h-4" /> API Keys</h2>
        </div>

        {/* Create key */}
        <div className="flex gap-2 mb-4">
          <input
            placeholder="Key name (e.g., Production)"
            value={keyName}
            onChange={e => setKeyName(e.target.value)}
            className="glass-input flex-1 px-3 py-2 text-sm"
          />
          <button
            onClick={createApiKey}
            disabled={creating || !keyName.trim()}
            className="px-4 py-2 accent-gradient text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create
          </button>
        </div>

        {/* Just created key */}
        {justCreatedKey && (
          <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">⚠️ Copy this key now — it won't be shown again</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono flex-1 truncate">
                {showKey ? justCreatedKey : '•'.repeat(40)}
              </code>
              <button onClick={() => setShowKey(!showKey)} className="text-muted-foreground hover:text-foreground">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(justCreatedKey); toast.success('Key copied!'); }} className="text-primary hover:text-primary/80">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Keys list */}
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
        ) : apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No API keys yet</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map(k => (
              <div key={k.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-3">
                  <Shield className={`w-4 h-4 ${k.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{k.key_prefix}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleKeyActive(k)}
                    className={`px-2 py-1 rounded text-xs ${k.is_active ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}
                  >
                    {k.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => deleteKey(k.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* API Documentation */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
        <h2 className="text-sm font-medium mb-4">API Usage</h2>
        <div className="space-y-3">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Upload a file</p>
            <code className="text-xs font-mono block whitespace-pre-wrap text-foreground">{`curl -X POST ${apiBaseUrl}/upload \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@image.png"`}</code>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">List files</p>
            <code className="text-xs font-mono block text-foreground">{`curl ${apiBaseUrl}/files -H "Authorization: Bearer YOUR_API_KEY"`}</code>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Delete a file</p>
            <code className="text-xs font-mono block text-foreground">{`curl -X DELETE ${apiBaseUrl}/files/FILE_ID -H "Authorization: Bearer YOUR_API_KEY"`}</code>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
