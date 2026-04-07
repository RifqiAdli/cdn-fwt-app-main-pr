import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function RawCdnRedirect() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data: file } = await supabase
        .from('files')
        .select('id, public_url')
        .or(`short_code.eq.${code},id.eq.${code}`)
        .eq('is_public', true)
        .maybeSingle();

      if (file) {
        window.location.replace(file.public_url);
      } else {
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#888;font-family:sans-serif">File not found</div>';
      }
    })();
  }, [code]);

  return null;
}
