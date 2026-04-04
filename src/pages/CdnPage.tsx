import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function CdnPage() {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;

    const lookup = async () => {
      // Try short_code first
      let { data: file } = await supabase
        .from('files')
        .select('public_url, is_public, id, size, user_id, view_count')
        .eq('short_code', code)
        .maybeSingle();

      // Fallback to id
      if (!file) {
        const { data } = await supabase
          .from('files')
          .select('public_url, is_public, id, size, user_id, view_count')
          .eq('id', code)
          .maybeSingle();
        file = data;
      }

      if (!file) {
        setError('File not found');
        return;
      }

      if (!file.is_public) {
        setError('This file is private');
        return;
      }

      // Log access & update view count (fire and forget)
      supabase.from('files').update({ view_count: (file.view_count || 0) + 1 }).eq('id', file.id).then(() => {});

      // Redirect to raw file
      window.location.replace(file.public_url);
    };

    lookup();
  }, [code]);

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
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
