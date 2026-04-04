import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUpload } from '@/hooks/useUpload';
import { formatBytes, copyToClipboard } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Check, AlertCircle, Copy, Loader2, FileText } from 'lucide-react';

export default function UploadPage() {
  const { queue, uploading, addFiles, startUpload, clearQueue, removeItem } = useUpload();
  const [isPublic, setIsPublic] = useState(true);

  const onDrop = useCallback((accepted: File[]) => {
    addFiles(accepted);
  }, [addFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 104857600,
    multiple: true,
  });

  const doneFiles = queue.filter(i => i.status === 'done');
  const allDone = queue.length > 0 && queue.every(i => i.status === 'done' || i.status === 'error');

  const copyAllUrls = () => {
    const urls = doneFiles.map(i => i.result?.public_url).filter(Boolean).join('\n');
    copyToClipboard(urls);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold">Upload</h1>
        <p className="text-sm text-muted-foreground mt-1">Drag and drop files to your CDN</p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`glass-card p-12 text-center cursor-pointer transition-all border-2 border-dashed ${
          isDragActive
            ? 'border-primary bg-primary/5 shadow-glow'
            : 'border-border hover:border-muted-foreground'
        }`}
      >
        <input {...getInputProps()} />
        <motion.div
          animate={isDragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
          className="inline-flex"
        >
          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
        </motion.div>
        <p className="font-medium">Drop files here, or click to browse</p>
        <p className="text-sm text-muted-foreground mt-1">Supports any file • Max 100MB per file</p>
      </div>

      {/* Options */}
      {queue.length > 0 && !allDone && (
        <div className="glass-card p-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
              className="rounded border-border" />
            Public files
          </label>
          <div className="flex gap-2">
            <button onClick={clearQueue} className="px-3 py-1.5 text-sm rounded-lg bg-secondary text-muted-foreground hover:text-foreground">
              Clear
            </button>
            <button
              onClick={() => startUpload({ isPublic })}
              disabled={uploading}
              className="px-4 py-1.5 text-sm rounded-lg accent-gradient text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Upload {queue.filter(i => i.status === 'pending').length} files
            </button>
          </div>
        </div>
      )}

      {/* Queue */}
      <AnimatePresence>
        {queue.map((item, i) => (
          <motion.div
            key={`${item.file.name}-${i}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 flex items-center gap-4"
          >
            <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
              {item.status === 'uploading' && (
                <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full accent-gradient rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                </div>
              )}
            </div>

            {item.status === 'pending' && (
              <span className="text-xs text-muted-foreground">Pending</span>
            )}
            {item.status === 'uploading' && (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
            {item.status === 'done' && (
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <button onClick={() => copyToClipboard(item.result?.public_url || '')}
                  className="p-1 text-muted-foreground hover:text-primary" title="Copy URL">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {item.status === 'error' && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-xs text-destructive">{item.error}</span>
              </div>
            )}

            <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Post-upload */}
      {allDone && doneFiles.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Upload Complete — {doneFiles.length} files</h3>
            <button onClick={copyAllUrls} className="text-sm text-primary hover:underline flex items-center gap-1">
              <Copy className="w-3.5 h-3.5" /> Copy All URLs
            </button>
          </div>
          <div className="space-y-1">
            {doneFiles.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1">
                <span className="truncate max-w-[300px]">{item.file.name}</span>
                <code className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">{item.result?.public_url}</code>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
