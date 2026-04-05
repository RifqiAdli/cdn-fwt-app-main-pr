import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
import FilePreview from '@/components/FilePreview';

export default function PublicSharePage() {
  const { token } = useParams<{ token: string }>();
  const [share, setShare] = useState<any>(null);
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase
      .from('file_shares')
      .select('*, files(*)')
      .eq('share_token', token)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Share link not found or expired.');
        } else {
          if (data.expires_at && new Date(data.expires_at) < new Date()) {
            setError('This share link has expired.');
          } else if (data.max_downloads && data.download_count >= data.max_downloads) {
            setError('Download limit reached.');
          } else {
            setShare(data);
            setFile((data as any).files);
            if (!data.password_hash) setUnlocked(true);
          }
        }
        setLoading(false);
      });
  }, [token]);

  const checkPassword = () => {
    if (btoa(password) === share.password_hash) {
      setUnlocked(true);
      setError('');
    } else {
      setError('Incorrect password.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !share) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p className="font-medium">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden p-6">
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
        style={{ background: 'radial-gradient(circle, hsl(217 91% 68%), transparent)' }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 max-w-2xl w-full shadow-glass relative z-10">
        <div className="text-center mb-4">
          <h1 className="font-display text-xl font-bold">FOOPTRA <span className="text-gradient">CDN</span></h1>
          <p className="text-xs text-muted-foreground">Shared file</p>
        </div>

        {!unlocked ? (
          <div className="space-y-4 text-center">
            <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm">This file is password protected</p>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              className="glass-input w-full px-4 py-3 text-sm text-center"
              onKeyDown={e => e.key === 'Enter' && checkPassword()}
            />
            <button onClick={checkPassword} className="w-full accent-gradient text-primary-foreground py-3 rounded-xl font-medium text-sm">
              Unlock
            </button>
          </div>
        ) : file ? (
          <FilePreview file={file} />
        ) : null}
      </motion.div>

      <p className="text-xs text-muted-foreground mt-6">Powered by FOOPTRA CDN</p>
    </div>
  );
}
