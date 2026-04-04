import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { copyToClipboard } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { X, Copy, Lock, Loader2, Check } from 'lucide-react';

interface Props {
  file: any;
  onClose: () => void;
}

export default function ShareFileDialog({ file, onClose }: Props) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [expiresHours, setExpiresHours] = useState('');
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const createShare = async () => {
    if (!user) return;
    setLoading(true);

    const expiresAt = expiresHours
      ? new Date(Date.now() + Number(expiresHours) * 3600000).toISOString()
      : null;

    // Simple hash for password (for demo; in production use bcrypt via edge function)
    const passwordHash = password
      ? btoa(password)
      : null;

    const { data, error } = await supabase
      .from('file_shares')
      .insert({
        file_id: file.id,
        user_id: user.id,
        password_hash: passwordHash,
        max_downloads: maxDownloads ? Number(maxDownloads) : null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else if (data) {
      const url = `${window.location.origin}/s/${data.share_token}`;
      setShareUrl(url);
      toast.success('Share link created!');
    }
    setLoading(false);
  };

  const copyShareUrl = () => {
    copyToClipboard(shareUrl);
    toast.success('Share URL copied!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="glass-card p-6 w-full max-w-md shadow-glass"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-lg">Share File</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4 truncate">
          <Lock className="w-3.5 h-3.5 inline mr-1" />
          {file.name}
        </p>

        {!shareUrl ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Password (optional)</label>
              <input
                type="password"
                placeholder="Set a password..."
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="glass-input w-full px-3 py-2.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Max Downloads</label>
                <input
                  type="number"
                  placeholder="Unlimited"
                  value={maxDownloads}
                  onChange={e => setMaxDownloads(e.target.value)}
                  className="glass-input w-full px-3 py-2.5 text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Expires in (hours)</label>
                <input
                  type="number"
                  placeholder="Never"
                  value={expiresHours}
                  onChange={e => setExpiresHours(e.target.value)}
                  className="glass-input w-full px-3 py-2.5 text-sm"
                  min="1"
                />
              </div>
            </div>
            <button
              onClick={createShare}
              disabled={loading}
              className="w-full accent-gradient text-primary-foreground py-2.5 rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Create Share Link
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 glass-input px-3 py-2.5 rounded-xl">
              <Check className="w-4 h-4 text-primary shrink-0" />
              <code className="text-xs font-mono flex-1 truncate">{shareUrl}</code>
              <button onClick={copyShareUrl} className="text-primary hover:text-primary/80">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {password && <p className="text-xs text-muted-foreground">🔒 Password protected</p>}
            <button onClick={onClose} className="w-full py-2 rounded-xl bg-secondary text-sm hover:bg-glass-hover">
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
