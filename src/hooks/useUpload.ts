import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UploadOptions {
  isPublic?: boolean;
  folderId?: string | null;
  tags?: string[];
  customName?: string;
}

interface UploadItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  result?: any;
}

export function useUpload() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const updateItem = (index: number, updates: Partial<UploadItem>) => {
    setQueue(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const uploadFile = async (file: File, index: number, options: UploadOptions = {}) => {
    if (!user) return;
    updateItem(index, { status: 'uploading', progress: 0 });

    const ext = file.name.split('.').pop();
    const uniqueName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    try {
      const { error: storageError } = await supabase.storage
        .from('cdn-files')
        .upload(uniqueName, file, {
          cacheControl: '31536000',
          upsert: false,
          contentType: file.type,
        });

      if (storageError) throw storageError;

      // Simulate progress since onUploadProgress isn't available
      updateItem(index, { progress: 80 });

      const { data: { publicUrl } } = supabase.storage
        .from('cdn-files')
        .getPublicUrl(uniqueName);

      const { data: fileRecord, error: dbError } = await supabase
        .from('files')
        .insert({
          user_id: user.id,
          name: options.customName || file.name,
          original_name: file.name,
          size: file.size,
          mime_type: file.type,
          storage_path: uniqueName,
          public_url: publicUrl,
          is_public: options.isPublic ?? true,
          folder_id: options.folderId ?? null,
          tags: options.tags ?? [],
        })
        .select()
        .single();

      if (dbError) throw dbError;

      updateItem(index, { status: 'done', progress: 100, result: fileRecord });
    } catch (err: any) {
      updateItem(index, { status: 'error', error: err.message });
    }
  };

  const addFiles = (files: File[]) => {
    const newItems: UploadItem[] = files.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));
    setQueue(prev => [...prev, ...newItems]);
  };

  const startUpload = async (options: UploadOptions = {}) => {
    setUploading(true);
    const startIndex = queue.findIndex(i => i.status === 'pending');
    const pending = queue.filter(i => i.status === 'pending');

    // Upload 3 at a time
    for (let i = 0; i < pending.length; i += 3) {
      const batch = pending.slice(i, i + 3);
      await Promise.all(
        batch.map((item, batchIdx) => {
          const queueIdx = startIndex + i + batchIdx;
          return uploadFile(item.file, queueIdx, options);
        })
      );
    }
    setUploading(false);
  };

  const clearQueue = () => setQueue([]);
  const removeItem = (index: number) => setQueue(prev => prev.filter((_, i) => i !== index));

  return { queue, uploading, addFiles, startUpload, clearQueue, removeItem };
}
