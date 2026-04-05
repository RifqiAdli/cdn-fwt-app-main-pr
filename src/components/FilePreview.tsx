import { useState, useEffect } from 'react';
import { Download, ExternalLink, FileText, Film, Music, Image, Code, File } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface FilePreviewProps {
  file: {
    name: string;
    original_name?: string;
    size: number;
    mime_type: string;
    public_url: string;
    created_at?: string;
    view_count?: number;
    download_count?: number;
    short_code?: string;
  };
  showMeta?: boolean;
}

const textExtensions = ['txt','md','json','xml','csv','log','yml','yaml','toml','ini','sh','py','js','ts','jsx','tsx','html','css','scss','sql','rs','go','java','c','cpp','h','rb','php','swift','dart','lua'];

function getIcon(mime: string) {
  if (mime.startsWith('image/')) return Image;
  if (mime.startsWith('video/')) return Film;
  if (mime.startsWith('audio/')) return Music;
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('javascript')) return Code;
  if (mime === 'application/pdf') return FileText;
  return File;
}

function isTextLike(mime: string, name: string) {
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('javascript') || mime.includes('typescript')) return true;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return textExtensions.includes(ext);
}

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(url)
      .then(r => r.text())
      .then(t => { setContent(t.slice(0, 10000)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [url]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading preview...</div>;
  if (!content) return <div className="p-6 text-sm text-muted-foreground">Could not load preview</div>;

  return (
    <pre className="p-4 text-xs font-mono overflow-auto max-h-[400px] text-foreground whitespace-pre-wrap">
      {content}
    </pre>
  );
}

export default function FilePreview({ file, showMeta = true }: FilePreviewProps) {
  const Icon = getIcon(file.mime_type);

  const handleDownload = async () => {
    try {
      const res = await fetch(file.public_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name || file.name;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch {
      window.open(file.public_url, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden bg-secondary/30 border border-border">
        {file.mime_type.startsWith('image/') ? (
          <img src={file.public_url} alt={file.name} className="max-h-[400px] w-auto mx-auto object-contain" loading="lazy" />
        ) : file.mime_type.startsWith('video/') ? (
          <video src={file.public_url} controls className="w-full max-h-[400px]" />
        ) : file.mime_type.startsWith('audio/') ? (
          <div className="p-8 flex flex-col items-center gap-4">
            <Music className="w-16 h-16 text-primary/50" />
            <audio src={file.public_url} controls className="w-full max-w-md" />
          </div>
        ) : file.mime_type === 'application/pdf' ? (
          <iframe src={file.public_url} className="w-full h-[500px]" title={file.name} />
        ) : isTextLike(file.mime_type, file.name) ? (
          <TextPreview url={file.public_url} />
        ) : (
          <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Icon className="w-16 h-16 opacity-50" />
            <p className="text-sm">Preview not available for this file type</p>
          </div>
        )}
      </div>

      {showMeta && (
        <div className="space-y-2">
          <h2 className="font-medium text-lg truncate">{file.name}</h2>
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{formatBytes(Number(file.size))}</span>
            <span>•</span>
            <span>{file.mime_type}</span>
            {file.view_count != null && <><span>•</span><span>{file.view_count} views</span></>}
            {file.download_count != null && <><span>•</span><span>{file.download_count} downloads</span></>}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={handleDownload} className="flex-1 accent-gradient text-primary-foreground py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
          <Download className="w-4 h-4" /> Download
        </button>
        <button onClick={() => window.open(file.public_url, '_blank')} className="px-4 py-3 rounded-xl bg-secondary hover:bg-glass-hover border border-border text-sm font-medium transition-all flex items-center gap-2">
          <ExternalLink className="w-4 h-4" /> Open Raw
        </button>
      </div>
    </div>
  );
}
