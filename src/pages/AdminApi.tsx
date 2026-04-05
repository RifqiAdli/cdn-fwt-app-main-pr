import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Key, Loader2 } from 'lucide-react';

export default function AdminApi() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
    setKeys(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin-api')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'api_keys' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-display font-bold">API Monitoring</h1>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-3">
                  <Key className={`w-4 h-4 ${k.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{k.key_prefix}... • User: {k.user_id.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{k.is_active ? '🟢 Active' : '🔴 Inactive'}</p>
                  <p>Scopes: {(k.scopes || []).join(', ')}</p>
                  {k.last_used_at && <p>Last used: {format(new Date(k.last_used_at), 'MMM dd, HH:mm')}</p>}
                </div>
              </div>
            ))}
            {keys.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No API keys found</p>}
          </div>
        )}
      </motion.div>
    </div>
  );
}
