import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import FilePreview from '@/components/FilePreview';
import { motion } from 'framer-motion';

export default function CdnPage() {
  const { code } = useParams<{ code: string }>();
  const [file, setFile] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;

    const lookup = async () => {
      let { data } = await supabase
        .from('files')
        .select('*')
        .eq('short_code', code)
        .maybeSingle();

      if (!data) {
        const res = await supabase.from('files').select('*').eq('id', code).maybeSingle();
        data = res.data;
      }

      if (!data) { setError('File not found'); setLoading(false); return; }
      if (!data.is_public) { setError('This file is private'); setLoading(false); return; }

      // Increment view count
      supabase.from('files').update({ view_count: (data.view_count || 0) + 1 }).eq('id', data.id).then(() => {});

      setFile(data);
      setLoading(false);
    };

    lookup();
  }, [code]);

  // Realtime view count
  useEffect(() => {
    if (!file) return;
    const channel = supabase
      .channel(`cdn-${file.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'files', filter: `id=eq.${file.id}` },
        (payload) => setFile((prev: any) => prev ? { ...prev, view_count: payload.new.view_count } : prev))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [file?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <p className="font-display font-bold text-xl mb-2">FOOPTRA <span className="text-gradient">CDN</span></p>
          <p className="text-destructive">{error}</p>
        </div>
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
        </div>
        <FilePreview file={file} />
      </motion.div>

      <p className="text-xs text-muted-foreground mt-6">Powered by FOOPTRA CDN</p>
    </div>
  );
}
