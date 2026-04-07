import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { formatBytes } from '@/lib/utils';
import { Key, Loader2, Terminal, Sparkles } from 'lucide-react';

interface TermLine {
  type: 'input' | 'output' | 'error' | 'ai';
  text: string;
}

export default function AdminApi() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<TermLine[]>([
    { type: 'output', text: '╔══════════════════════════════════════════╗' },
    { type: 'output', text: '║   FOOPTRA Admin Terminal v2.0            ║' },
    { type: 'output', text: '║   AI-Powered Platform Management         ║' },
    { type: 'output', text: '╚══════════════════════════════════════════╝' },
    { type: 'output', text: '' },
    { type: 'output', text: 'Type "help" for commands or "ai <question>" for AI assistant.' },
    { type: 'output', text: '' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [executing, setExecuting] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
    setKeys(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin-api')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'api_keys' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    termRef.current?.scrollTo(0, termRef.current.scrollHeight);
  }, [lines]);

  const addLine = useCallback((type: TermLine['type'], text: string) => {
    setLines(prev => [...prev, { type, text }]);
  }, []);

  const addLines = useCallback((type: TermLine['type'], texts: string[]) => {
    setLines(prev => [...prev, ...texts.map(text => ({ type, text }))]);
  }, []);

  const executeCommand = useCallback(async (cmd: string) => {
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        addLines('output', [
          '┌─── API Key Management ───────────────────────┐',
          '│ list-keys [user_id]     List API keys         │',
          '│ key-info <key_id>       Show key details       │',
          '│ revoke <key_id>         Deactivate a key       │',
          '│ activate <key_id>       Activate a key         │',
          '│ delete-key <key_id>     Delete permanently     │',
          '│ set-scopes <id> <s>     Set scopes (csv)       │',
          '│ bulk-revoke <user_id>   Revoke all user keys   │',
          '│ export-keys             Export keys as JSON     │',
          '├─── File Management ───────────────────────────┤',
          '│ list-files [user_id]    List files              │',
          '│ file-info <file_id>     Show file details       │',
          '│ delete-file <file_id>   Delete a file           │',
          '│ toggle-public <file_id> Toggle visibility       │',
          '│ search-files <query>    Search by name          │',
          '│ top-files [n]           Most viewed files       │',
          '│ export-files            Export files as JSON     │',
          '├─── User Management ───────────────────────────┤',
          '│ list-users              List all users          │',
          '│ user-info <user_id>     Show user details       │',
          '│ promote <user_id>       Grant admin role        │',
          '│ demote <user_id>        Remove admin role       │',
          '├─── Share Management ──────────────────────────┤',
          '│ list-shares [user_id]   List share links        │',
          '│ revoke-share <share_id> Deactivate share        │',
          '│ cleanup-expired         Show expired items      │',
          '├─── Analytics & Reports ───────────────────────┤',
          '│ platform-stats          Full platform stats     │',
          '│ storage-report          Storage breakdown       │',
          '│ bandwidth-report        Bandwidth breakdown     │',
          '│ recent-activity [n]     Recent access logs      │',
          '├─── AI Assistant ──────────────────────────────┤',
          '│ ai <question>           Ask AI for help         │',
          '├─── System ────────────────────────────────────┤',
          '│ clear                   Clear terminal          │',
          '│ whoami                  Current admin info      │',
          '│ uptime                  Platform uptime info    │',
          '└───────────────────────────────────────────────┘',
        ]);
        break;

      case 'clear':
        setLines([]);
        break;

      case 'whoami': {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          addLine('output', `User: ${user.email}\nID: ${user.id}\nRole: admin\nLast sign in: ${user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'yyyy-MM-dd HH:mm') : 'N/A'}`);
        }
        break;
      }

      case 'uptime': {
        addLine('output', `Platform: FOOPTRA CDN\nStatus: 🟢 Online\nTime: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\nTimezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        break;
      }

      // ── API Key commands ──────────────────────────

      case 'stats':
      case 'platform-stats': {
        const [keysRes, filesRes, sharesRes, statsRes] = await Promise.all([
          supabase.from('api_keys').select('*'),
          supabase.from('files').select('*'),
          supabase.from('file_shares').select('*'),
          supabase.from('user_stats').select('*'),
        ]);
        const k = keysRes.data || [];
        const f = filesRes.data || [];
        const s = sharesRes.data || [];
        const st = statsRes.data || [];
        const totalStorage = st.reduce((a, u) => a + Number(u.total_storage || 0), 0);
        const totalBw = st.reduce((a, u) => a + Number(u.total_bandwidth || 0), 0);
        const totalDl = st.reduce((a, u) => a + Number(u.total_downloads || 0), 0);
        addLines('output', [
          '╔══ Platform Statistics ══════════════════════╗',
          `║ Users:       ${st.length.toString().padStart(8)}                      ║`,
          `║ Files:       ${f.length.toString().padStart(8)}                      ║`,
          `║ API Keys:    ${k.length.toString().padStart(8)} (${k.filter(x => x.is_active).length} active)            ║`,
          `║ Shares:      ${s.length.toString().padStart(8)} (${s.filter(x => x.is_active).length} active)            ║`,
          `║ Storage:     ${formatBytes(totalStorage).padStart(8)}                      ║`,
          `║ Bandwidth:   ${formatBytes(totalBw).padStart(8)}                      ║`,
          `║ Downloads:   ${totalDl.toString().padStart(8)}                      ║`,
          '╚═════════════════════════════════════════════╝',
        ]);
        break;
      }

      case 'list-keys': {
        let query = supabase.from('api_keys').select('*').order('created_at', { ascending: false });
        if (args[0]) query = query.eq('user_id', args[0]);
        const { data, error } = await query;
        if (error) { addLine('error', error.message); break; }
        if (!data?.length) { addLine('output', 'No keys found.'); break; }
        addLine('output', `Found ${data.length} key(s):`);
        data.forEach(k => {
          addLine('output', `  [${k.is_active ? '●' : '○'}] ${k.id.slice(0, 8)}… │ ${k.name} │ ${k.key_prefix}… │ scopes: ${(k.scopes || []).join(',')} │ user: ${k.user_id.slice(0, 8)}…`);
        });
        break;
      }

      case 'revoke': {
        if (!args[0]) { addLine('error', 'Usage: revoke <key_id>'); break; }
        const { error } = await supabase.from('api_keys').update({ is_active: false }).eq('id', args[0]);
        addLine(error ? 'error' : 'output', error ? error.message : `✓ Key ${args[0].slice(0, 8)}… revoked.`);
        break;
      }

      case 'activate': {
        if (!args[0]) { addLine('error', 'Usage: activate <key_id>'); break; }
        const { error } = await supabase.from('api_keys').update({ is_active: true }).eq('id', args[0]);
        addLine(error ? 'error' : 'output', error ? error.message : `✓ Key ${args[0].slice(0, 8)}… activated.`);
        break;
      }

      case 'delete-key': {
        if (!args[0]) { addLine('error', 'Usage: delete-key <key_id>'); break; }
        const { error } = await supabase.from('api_keys').delete().eq('id', args[0]);
        addLine(error ? 'error' : 'output', error ? error.message : `✓ Key ${args[0].slice(0, 8)}… deleted.`);
        break;
      }

      case 'set-scopes': {
        if (args.length < 2) { addLine('error', 'Usage: set-scopes <key_id> read,upload,delete'); break; }
        const scopes = args[1].split(',').map(s => s.trim());
        const { error } = await supabase.from('api_keys').update({ scopes }).eq('id', args[0]);
        addLine(error ? 'error' : 'output', error ? error.message : `✓ Scopes → [${scopes.join(', ')}]`);
        break;
      }

      case 'key-info': {
        if (!args[0]) { addLine('error', 'Usage: key-info <key_id>'); break; }
        const { data, error } = await supabase.from('api_keys').select('*').eq('id', args[0]).maybeSingle();
        if (error || !data) { addLine('error', error?.message || 'Key not found.'); break; }
        addLine('output', `Name:     ${data.name}\nID:       ${data.id}\nPrefix:   ${data.key_prefix}\nActive:   ${data.is_active ? '🟢 Yes' : '🔴 No'}\nScopes:   ${(data.scopes || []).join(', ')}\nUser:     ${data.user_id}\nCreated:  ${format(new Date(data.created_at), 'yyyy-MM-dd HH:mm')}\nLast use: ${data.last_used_at ? format(new Date(data.last_used_at), 'yyyy-MM-dd HH:mm') : 'Never'}${data.expires_at ? `\nExpires:  ${format(new Date(data.expires_at), 'yyyy-MM-dd HH:mm')}` : ''}`);
        break;
      }

      case 'bulk-revoke': {
        if (!args[0]) { addLine('error', 'Usage: bulk-revoke <user_id>'); break; }
        const { data, error } = await supabase.from('api_keys').update({ is_active: false }).eq('user_id', args[0]).select();
        addLine(error ? 'error' : 'output', error ? error.message : `✓ Revoked ${data?.length || 0} key(s) for user ${args[0].slice(0, 8)}…`);
        break;
      }

      case 'export-keys': {
        const { data } = await supabase.from('api_keys').select('*');
        addLine('output', JSON.stringify(data || [], null, 2));
        break;
      }

      // ── File commands ─────────────────────────────

      case 'list-files': {
        let query = supabase.from('files').select('*').order('created_at', { ascending: false }).limit(20);
        if (args[0]) query = query.eq('user_id', args[0]);
        const { data, error } = await query;
        if (error) { addLine('error', error.message); break; }
        if (!data?.length) { addLine('output', 'No files found.'); break; }
        addLine('output', `Showing ${data.length} file(s):`);
        data.forEach(f => {
          addLine('output', `  ${f.is_public ? '🌐' : '🔒'} ${f.id.slice(0, 8)}… │ ${f.original_name} │ ${formatBytes(f.size)} │ ${f.mime_type} │ 👁 ${f.view_count} 📥 ${f.download_count}`);
        });
        break;
      }

      case 'file-info': {
        if (!args[0]) { addLine('error', 'Usage: file-info <file_id>'); break; }
        const { data, error } = await supabase.from('files').select('*').eq('id', args[0]).maybeSingle();
        if (error || !data) { addLine('error', error?.message || 'File not found.'); break; }
        addLine('output', `Name:      ${data.original_name}\nID:        ${data.id}\nSize:      ${formatBytes(data.size)}\nMIME:      ${data.mime_type}\nPublic:    ${data.is_public ? '🌐 Yes' : '🔒 No'}\nShort:     ${data.short_code || 'N/A'}\nViews:     ${data.view_count}\nDownloads: ${data.download_count}\nBandwidth: ${formatBytes(data.bandwidth_used)}\nTags:      ${(data.tags || []).join(', ') || 'None'}\nUser:      ${data.user_id}\nCreated:   ${format(new Date(data.created_at), 'yyyy-MM-dd HH:mm')}${data.expires_at ? `\nExpires:   ${format(new Date(data.expires_at), 'yyyy-MM-dd HH:mm')}` : ''}`);
        break;
      }

      case 'delete-file': {
        if (!args[0]) { addLine('error', 'Usage: delete-file <file_id>'); break; }
        const { data: file } = await supabase.from('files').select('storage_path').eq('id', args[0]).maybeSingle();
        if (file?.storage_path) {
          await supabase.storage.from('cdn-files').remove([file.storage_path]);
        }
        const { error } = await supabase.from('files').delete().eq('id', args[0]);
        addLine(error ? 'error' : 'output', error ? error.message : `✓ File ${args[0].slice(0, 8)}… deleted.`);
        break;
      }

      case 'toggle-public': {
        if (!args[0]) { addLine('error', 'Usage: toggle-public <file_id>'); break; }
        const { data: cur } = await supabase.from('files').select('is_public').eq('id', args[0]).maybeSingle();
        if (!cur) { addLine('error', 'File not found.'); break; }
        const { error } = await supabase.from('files').update({ is_public: !cur.is_public }).eq('id', args[0]);
        addLine(error ? 'error' : 'output', error ? error.message : `✓ File → ${!cur.is_public ? '🌐 Public' : '🔒 Private'}`);
        break;
      }

      case 'search-files': {
        if (!args[0]) { addLine('error', 'Usage: search-files <query>'); break; }
        const q = args.join(' ');
        const { data, error } = await supabase.from('files').select('*').ilike('original_name', `%${q}%`).limit(20);
        if (error) { addLine('error', error.message); break; }
        if (!data?.length) { addLine('output', `No files matching "${q}".`); break; }
        addLine('output', `Found ${data.length} file(s):`);
        data.forEach(f => {
          addLine('output', `  ${f.id.slice(0, 8)}… │ ${f.original_name} │ ${formatBytes(f.size)} │ user: ${f.user_id.slice(0, 8)}…`);
        });
        break;
      }

      case 'top-files': {
        const n = parseInt(args[0]) || 10;
        const { data, error } = await supabase.from('files').select('*').order('view_count', { ascending: false }).limit(n);
        if (error) { addLine('error', error.message); break; }
        if (!data?.length) { addLine('output', 'No files.'); break; }
        addLine('output', `Top ${data.length} files by views:`);
        data.forEach((f, i) => {
          addLine('output', `  ${(i + 1).toString().padStart(2)}. ${f.original_name} │ 👁 ${f.view_count} │ 📥 ${f.download_count} │ ${formatBytes(f.size)}`);
        });
        break;
      }

      case 'export-files': {
        const { data } = await supabase.from('files').select('id,original_name,size,mime_type,is_public,view_count,download_count,user_id,created_at');
        addLine('output', JSON.stringify(data || [], null, 2));
        break;
      }

      // ── User commands ─────────────────────────────

      case 'list-users': {
        const { data, error } = await supabase.from('user_stats').select('*');
        if (error) { addLine('error', error.message); break; }
        if (!data?.length) { addLine('output', 'No users found.'); break; }
        addLine('output', `Found ${data.length} user(s):`);
        data.forEach(u => {
          addLine('output', `  ${u.user_id.slice(0, 8)}… │ ${u.total_files || 0} files │ ${formatBytes(Number(u.total_storage || 0))} │ ${u.total_downloads || 0} downloads │ BW: ${formatBytes(Number(u.total_bandwidth || 0))}`);
        });
        break;
      }

      case 'user-info': {
        if (!args[0]) { addLine('error', 'Usage: user-info <user_id>'); break; }
        const [statsRes, keysRes, filesRes, rolesRes] = await Promise.all([
          supabase.from('user_stats').select('*').eq('user_id', args[0]).maybeSingle(),
          supabase.from('api_keys').select('id').eq('user_id', args[0]),
          supabase.from('files').select('id').eq('user_id', args[0]),
          supabase.from('user_roles').select('role').eq('user_id', args[0]),
        ]);
        const s = statsRes.data;
        const roles = (rolesRes.data || []).map(r => r.role).join(', ') || 'user';
        addLine('output', `User ID:   ${args[0]}\nRoles:     ${roles}\nFiles:     ${filesRes.data?.length || 0}\nAPI Keys:  ${keysRes.data?.length || 0}\nStorage:   ${formatBytes(Number(s?.total_storage || 0))} / ${formatBytes(Number(s?.storage_limit || 0))}\nBandwidth: ${formatBytes(Number(s?.total_bandwidth || 0))}\nDownloads: ${s?.total_downloads || 0}`);
        break;
      }

      case 'promote': {
        if (!args[0]) { addLine('error', 'Usage: promote <user_id>'); break; }
        const { error } = await supabase.from('user_roles').insert({ user_id: args[0], role: 'admin' });
        addLine(error ? 'error' : 'output', error ? (error.message.includes('duplicate') ? 'User is already an admin.' : error.message) : `✓ User ${args[0].slice(0, 8)}… promoted to admin.`);
        break;
      }

      case 'demote': {
        if (!args[0]) { addLine('error', 'Usage: demote <user_id>'); break; }
        const { error } = await supabase.from('user_roles').delete().eq('user_id', args[0]).eq('role', 'admin');
        addLine(error ? 'error' : 'output', error ? error.message : `✓ Admin role removed from ${args[0].slice(0, 8)}…`);
        break;
      }

      // ── Share commands ────────────────────────────

      case 'list-shares': {
        let query = supabase.from('file_shares').select('*, files(original_name)').order('created_at', { ascending: false }).limit(20);
        if (args[0]) query = query.eq('user_id', args[0]);
        const { data, error } = await query;
        if (error) { addLine('error', error.message); break; }
        if (!data?.length) { addLine('output', 'No shares found.'); break; }
        addLine('output', `Found ${data.length} share(s):`);
        data.forEach(s => {
          const fileName = (s as any).files?.original_name || 'Unknown';
          const expired = s.expires_at && new Date(s.expires_at) < new Date();
          addLine('output', `  [${s.is_active && !expired ? '●' : '○'}] ${s.id.slice(0, 8)}… │ ${fileName} │ token: ${s.share_token.slice(0, 8)}… │ DL: ${s.download_count}/${s.max_downloads || '∞'} │ ${s.password_hash ? '🔐' : '🔓'} │ user: ${s.user_id.slice(0, 8)}…`);
        });
        break;
      }

      case 'revoke-share': {
        if (!args[0]) { addLine('error', 'Usage: revoke-share <share_id>'); break; }
        const { error } = await supabase.from('file_shares').update({ is_active: false }).eq('id', args[0]);
        addLine(error ? 'error' : 'output', error ? error.message : `✓ Share ${args[0].slice(0, 8)}… deactivated.`);
        break;
      }

      case 'cleanup-expired': {
        const now = new Date().toISOString();
        const [expFiles, expShares] = await Promise.all([
          supabase.from('files').select('id,original_name,expires_at').lt('expires_at', now).not('expires_at', 'is', null),
          supabase.from('file_shares').select('id,share_token,expires_at').lt('expires_at', now).not('expires_at', 'is', null),
        ]);
        addLine('output', `Expired files: ${expFiles.data?.length || 0}`);
        (expFiles.data || []).forEach(f => addLine('output', `  📄 ${f.id.slice(0, 8)}… │ ${f.original_name} │ expired: ${format(new Date(f.expires_at!), 'yyyy-MM-dd')}`));
        addLine('output', `Expired shares: ${expShares.data?.length || 0}`);
        (expShares.data || []).forEach(s => addLine('output', `  🔗 ${s.id.slice(0, 8)}… │ token: ${s.share_token.slice(0, 8)}… │ expired: ${format(new Date(s.expires_at!), 'yyyy-MM-dd')}`));
        break;
      }

      // ── Analytics ─────────────────────────────────

      case 'storage-report': {
        const { data } = await supabase.from('user_stats').select('*').order('total_storage', { ascending: false });
        if (!data?.length) { addLine('output', 'No data.'); break; }
        addLine('output', 'Storage usage by user:');
        data.forEach(u => {
          const pct = Math.round((Number(u.total_storage || 0) / Number(u.storage_limit || 1)) * 100);
          const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
          addLine('output', `  ${u.user_id.slice(0, 8)}… │ ${bar} ${pct}% │ ${formatBytes(Number(u.total_storage || 0))} / ${formatBytes(Number(u.storage_limit || 0))}`);
        });
        break;
      }

      case 'bandwidth-report': {
        const { data } = await supabase.from('user_stats').select('*').order('total_bandwidth', { ascending: false });
        if (!data?.length) { addLine('output', 'No data.'); break; }
        addLine('output', 'Bandwidth usage by user:');
        data.forEach(u => {
          addLine('output', `  ${u.user_id.slice(0, 8)}… │ ${formatBytes(Number(u.total_bandwidth || 0))} │ ${u.total_downloads || 0} downloads`);
        });
        break;
      }

      case 'recent-activity': {
        const n = parseInt(args[0]) || 10;
        const { data, error } = await supabase.from('access_logs').select('*, files(original_name)').order('created_at', { ascending: false }).limit(n);
        if (error) { addLine('error', error.message); break; }
        if (!data?.length) { addLine('output', 'No activity.'); break; }
        addLine('output', `Recent ${data.length} event(s):`);
        data.forEach(l => {
          const fname = (l as any).files?.original_name || l.file_id.slice(0, 8) + '…';
          addLine('output', `  ${format(new Date(l.created_at), 'HH:mm:ss')} │ ${l.event_type.padEnd(10)} │ ${fname} │ ${l.country || '??'} │ ${formatBytes(Number(l.bytes_served || 0))}`);
        });
        break;
      }

      // ── AI Assistant ──────────────────────────────

      case 'ai': {
        if (!args.length) { addLine('error', 'Usage: ai <your question>'); break; }
        const question = args.join(' ');
        addLine('output', '🤖 Thinking…');

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { addLine('error', 'Not authenticated.'); break; }

          // Gather context
          const [keysRes, filesRes, statsRes] = await Promise.all([
            supabase.from('api_keys').select('id,name,is_active,scopes,user_id,key_prefix').limit(50),
            supabase.from('files').select('id,original_name,size,is_public,view_count,user_id').order('created_at', { ascending: false }).limit(20),
            supabase.from('user_stats').select('*'),
          ]);
          const context = `API Keys (${keysRes.data?.length || 0}): ${JSON.stringify((keysRes.data || []).slice(0, 10))}\nRecent Files (${filesRes.data?.length || 0}): ${JSON.stringify((filesRes.data || []).slice(0, 10))}\nUser Stats: ${JSON.stringify(statsRes.data || [])}`;

          const res = await supabase.functions.invoke('admin-ai', {
            body: { prompt: question, context },
          });

          // Remove "Thinking…" line
          setLines(prev => prev.filter((_, i) => i !== prev.length - 1));

          if (res.error) {
            addLine('error', `AI error: ${res.error.message}`);
          } else {
            addLine('ai', `🤖 ${res.data.reply}`);
          }
        } catch (err: any) {
          setLines(prev => prev.filter((_, i) => i !== prev.length - 1));
          addLine('error', `AI error: ${err.message}`);
        }
        break;
      }

      default:
        addLine('error', `Unknown command: "${command}". Type "help" for available commands.`);
    }
  }, [addLine, addLines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || executing) return;
    addLine('input', `admin@fooptra $ ${input}`);
    setHistory(prev => [input, ...prev]);
    setHistIdx(-1);
    const cmd = input;
    setInput('');
    setExecuting(true);
    await executeCommand(cmd);
    setExecuting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      if (history[next]) setInput(history[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) { setHistIdx(-1); setInput(''); }
      else { setHistIdx(next); setInput(history[next] || ''); }
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-display font-bold">API Monitoring</h1>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2"><Key className="w-4 h-4" /> All API Keys</h2>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-3">
                  <Key className={`w-4 h-4 ${k.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{k.key_prefix}… • User: {k.user_id.slice(0, 8)}…</p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{k.is_active ? '🟢 Active' : '🔴 Inactive'}</p>
                  <p>Scopes: {(k.scopes || []).join(', ')}</p>
                  {k.last_used_at && <p>Last used: {format(new Date(k.last_used_at), 'MMM dd, HH:mm')}</p>}
                </div>
              </div>
            ))}
            {keys.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No API keys found</p>}
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium flex items-center gap-2"><Terminal className="w-4 h-4" /> Admin Terminal</h2>
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI-Powered</span>
        </div>
        <div
          ref={termRef}
          onClick={() => inputRef.current?.focus()}
          className="bg-black/80 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs leading-relaxed cursor-text border border-border"
        >
          {lines.map((line, i) => (
            <div key={i} className={`whitespace-pre-wrap ${
              line.type === 'input' ? 'text-primary' :
              line.type === 'error' ? 'text-destructive' :
              line.type === 'ai' ? 'text-accent-foreground' :
              'text-foreground/80'
            }`}>
              {line.text}
            </div>
          ))}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
            <span className="text-primary shrink-0">admin@fooptra $</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={executing}
              className="flex-1 bg-transparent outline-none text-foreground caret-primary disabled:opacity-50"
              autoFocus
              spellCheck={false}
            />
            {executing && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
          </form>
        </div>
      </motion.div>
    </div>
  );
}
