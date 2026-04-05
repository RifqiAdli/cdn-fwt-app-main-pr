import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatBytes } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminFiles() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    let q = supabase.from('files').select('*').order('created_at', { ascending: false }).limit(100);
    if (search) q = q.ilike('name', `%${search}%`);
    const { data } = await q;
    setFiles(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [search]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-files')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const deleteFile = async (file: any) => {
    if (!confirm(`Delete "${file.name}"?`)) return;
    await supabase.storage.from('cdn-files').remove([file.storage_path]);
    await supabase.from('files').delete().eq('id', file.id);
    toast.success('File deleted');
    load();
  };

  const togglePublic = async (file: any) => {
    await supabase.from('files').update({ is_public: !file.is_public }).eq('id', file.id);
    toast.success(file.is_public ? 'Made private' : 'Made public');
    load();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">File Moderation</h1>
        <input placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)} className="glass-input px-4 py-2 text-sm w-64" />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">Size</th>
                  <th className="text-left py-2 px-3">Type</th>
                  <th className="text-left py-2 px-3">User</th>
                  <th className="text-left py-2 px-3">Views</th>
                  <th className="text-left py-2 px-3">Public</th>
                  <th className="text-right py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-2 px-3 truncate max-w-[200px]">{f.name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{formatBytes(Number(f.size))}</td>
                    <td className="py-2 px-3 text-muted-foreground">{f.mime_type}</td>
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{f.user_id.slice(0, 8)}...</td>
                    <td className="py-2 px-3">{f.view_count}</td>
                    <td className="py-2 px-3">
                      <button onClick={() => togglePublic(f)} className={f.is_public ? 'text-primary' : 'text-muted-foreground'}>
                        {f.is_public ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button onClick={() => deleteFile(f)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {files.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No files found</p>}
          </div>
        )}
      </motion.div>
    </div>
  );
}
