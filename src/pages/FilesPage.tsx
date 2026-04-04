import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBytes, getFileType, copyToClipboard } from '@/lib/utils';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Grid3X3, List, Search, Trash2, Copy, Lock, Unlock, Image, FileText, Film,
  Music, Code2, Archive, File, Share2,
} from 'lucide-react';
import ShareFileDialog from '@/components/files/ShareFileDialog';

const fileTypeIcons: Record<string, React.ElementType> = {
  image: Image, video: Film, audio: Music, document: FileText, code: Code2, archive: Archive, other: File,
};

export default function FilesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [shareFile, setShareFile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    loadFiles();

    const channel = supabase
      .channel(`files-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files', filter: `user_id=eq.${user.id}` },
        () => loadFiles())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadFiles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setFiles(data || []);
    setLoading(false);
  };

  const deleteFile = async (file: any) => {
    await supabase.storage.from('cdn-files').remove([file.storage_path]);
    await supabase.from('files').delete().eq('id', file.id);
    toast.success('File deleted');
  };

  const togglePublic = async (file: any) => {
    await supabase.from('files').update({ is_public: !file.is_public }).eq('id', file.id);
    toast.success(file.is_public ? 'File set to private' : 'File set to public');
    loadFiles();
  };

  const getCdnUrl = (file: any) => {
    return `${window.location.origin}/cdn/${file.short_code || file.id}`;
  };

  const copyFileUrl = (file: any) => {
    copyToClipboard(getCdnUrl(file));
    toast.success('CDN URL copied!');
  };

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (id: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    const toDelete = files.filter(f => selectedFiles.has(f.id));
    for (const file of toDelete) await deleteFile(file);
    setSelectedFiles(new Set());
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-display font-bold">Files</h1>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)} className="glass-input w-full pl-9 pr-4 py-2 text-sm" />
          </div>
          <button onClick={() => setView(view === 'grid' ? 'list' : 'grid')} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            {view === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {selectedFiles.size > 0 && (
        <div className="glass-card p-3 flex items-center justify-between">
          <span className="text-sm">{selectedFiles.size} selected</span>
          <button onClick={deleteSelected} className="flex items-center gap-1 text-destructive text-sm hover:underline">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <File className="w-14 h-14 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No files found</p>
          <p className="text-sm mt-1">Upload your first file to get started</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((file, i) => {
            const type = getFileType(file.mime_type);
            const Icon = fileTypeIcons[type];
            const isImage = type === 'image';
            const selected = selectedFiles.has(file.id);

            return (
              <motion.div key={file.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                onClick={() => toggleSelect(file.id)}
                className={`glass-card glass-card-hover p-3 cursor-pointer group relative ${selected ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="aspect-square rounded-lg mb-2 flex items-center justify-center overflow-hidden bg-secondary">
                  {isImage ? <img src={file.public_url} alt={file.name} className="w-full h-full object-cover" loading="lazy" /> : <Icon className="w-8 h-8 text-muted-foreground" />}
                </div>
                <p className="text-xs font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(Number(file.size))}</p>

                <div className="absolute inset-0 rounded-2xl bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); copyFileUrl(file); }} className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShareFile(file); }} className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); togglePublic(file); }} className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30">
                    {file.is_public ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteFile(file); }} className="p-2 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="p-3 font-medium w-8"></th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Size</th>
                <th className="p-3 font-medium">Downloads</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(file => {
                const type = getFileType(file.mime_type);
                const Icon = fileTypeIcons[type];
                const selected = selectedFiles.has(file.id);

                return (
                  <tr key={file.id} className="border-b border-border/50 hover:bg-glass-hover transition-colors">
                    <td className="p-3"><input type="checkbox" checked={selected} onChange={() => toggleSelect(file.id)} className="rounded border-border" /></td>
                    <td className="p-3 flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[200px]">{file.name}</span>
                    </td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">{type}</span></td>
                    <td className="p-3 text-muted-foreground">{formatBytes(Number(file.size))}</td>
                    <td className="p-3 text-muted-foreground">{file.download_count}</td>
                    <td className="p-3 text-muted-foreground">{format(new Date(file.created_at), 'MMM dd')}</td>
                    <td className="p-3 flex items-center gap-1">
                      <button onClick={() => copyFileUrl(file)} className="p-1.5 rounded text-muted-foreground hover:text-primary" title="Copy CDN URL">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setShareFile(file)} className="p-1.5 rounded text-muted-foreground hover:text-primary" title="Share with password">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => togglePublic(file)} className="p-1.5 rounded text-muted-foreground hover:text-primary" title="Toggle visibility">
                        {file.is_public ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => deleteFile(file)} className="p-1.5 rounded text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {shareFile && <ShareFileDialog file={shareFile} onClose={() => setShareFile(null)} />}
    </div>
  );
}
