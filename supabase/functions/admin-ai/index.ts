const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { prompt, context } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'prompt is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `You are FOOPTRA Admin AI Assistant. You help administrators manage a CDN file hosting platform.
You have access to platform context and can suggest terminal commands.

Available terminal commands:
- list-keys [user_id] — List API keys
- revoke <key_id> — Deactivate a key
- activate <key_id> — Activate a key
- delete-key <key_id> — Delete a key permanently
- set-scopes <key_id> <scopes> — Set scopes (read,upload,delete)
- key-info <key_id> — Show key details
- list-files [user_id] — List files
- file-info <file_id> — Show file details
- delete-file <file_id> — Delete a file
- toggle-public <file_id> — Toggle file visibility
- list-users — List all users with stats
- user-info <user_id> — Show user details
- promote <user_id> — Give admin role
- demote <user_id> — Remove admin role
- list-shares [user_id] — List share links
- revoke-share <share_id> — Deactivate a share
- platform-stats — Full platform statistics
- storage-report — Storage usage breakdown
- bandwidth-report — Bandwidth usage report
- recent-activity [n] — Recent access logs
- top-files [n] — Most accessed files
- search-files <query> — Search files by name
- export-keys — Export all keys as JSON
- export-files — Export all files as JSON
- bulk-revoke <user_id> — Revoke all keys for user
- cleanup-expired — List expired shares/files

When suggesting commands, format them in backticks. Be concise and helpful.
Answer in the same language as the user's question.`
          },
          {
            role: 'user',
            content: context ? `Platform context:\n${context}\n\nQuestion: ${prompt}` : prompt
          }
        ],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('Groq API error:', aiRes.status, errText)
      return new Response(JSON.stringify({ error: `AI error: ${aiRes.status}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const aiData = await aiRes.json()
    const reply = aiData.choices?.[0]?.message?.content || 'No response from AI.'

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('admin-ai error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})