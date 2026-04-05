import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Share2, Lock, Loader2 } from 'lucide-react';

export default function AdminShares() {
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from('file_shares').select('*, files(name, mime_type)').order('created_at', { ascending: false });
    setShares(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin-shares')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'file_shares' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-display font-bold">Share Links</h1>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-2">
            {shares.map(s => {
              const expired = s.expires_at && new Date(s.expires_at) < new Date();
              const limitReached = s.max_downloads && s.download_count >= s.max_downloads;
              return (
                <div key={s.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <Share2 className={`w-4 h-4 ${s.is_active && !expired ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-sm font-medium">{(s as any).files?.name || 'Unknown file'}</p>
                      <p className="text-xs font-mono text-muted-foreground">/s/{s.share_token.slice(0, 12)}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {s.password_hash && <Lock className="w-3 h-3" />}
                    <span>{s.download_count || 0}{s.max_downloads ? `/${s.max_downloads}` : ''} DLs</span>
                    {expired && <span className="text-destructive">Expired</span>}
                    {limitReached && <span className="text-destructive">Limit reached</span>}
                    {!expired && !limitReached && s.is_active && <span className="text-primary">Active</span>}
                    <span>{format(new Date(s.created_at), 'MMM dd')}</span>
                  </div>
                </div>
              );
            })}
            {shares.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No share links found</p>}
          </div>
        )}
      </motion.div>
    </div>
  );
}
