import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing API key" }, 401);
  }

  const apiKey = authHeader.replace("Bearer ", "");
  const keyHash = btoa(apiKey);

  const { data: keyData } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (!keyData) {
    return jsonResponse({ error: "Invalid API key" }, 401);
  }

  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return jsonResponse({ error: "API key expired" }, 401);
  }

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id);

  const userId = keyData.user_id;
  const action = pathParts[pathParts.length - 1] || "";
  const secondLast = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : "";

  // GET /files
  if (req.method === "GET" && action === "files") {
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 100);
    const search = url.searchParams.get("search") || "";
    const type = url.searchParams.get("type") || "";

    let query = supabase
      .from("files")
      .select("id, name, original_name, size, mime_type, public_url, short_code, is_public, download_count, view_count, tags, created_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (search) query = query.ilike("name", `%${search}%`);
    if (type) query = query.ilike("mime_type", `${type}%`);

    const { data, count, error } = await query;
    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ files: data, total: count, page, limit });
  }

  // GET /stats
  if (req.method === "GET" && action === "stats") {
    const { data } = await supabase.from("user_stats").select("*").eq("user_id", userId).maybeSingle();
    return jsonResponse({ stats: data });
  }

  // POST /upload
  if (req.method === "POST" && action === "upload") {
    if (!keyData.scopes?.includes("upload")) {
      return jsonResponse({ error: "Scope 'upload' not permitted" }, 403);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return jsonResponse({ error: "No file provided" }, 400);

    const ext = file.name.split(".").pop();
    const uniqueName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from("cdn-files")
      .upload(uniqueName, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type,
      });

    if (storageError) return jsonResponse({ error: storageError.message }, 500);

    const { data: { publicUrl } } = supabase.storage.from("cdn-files").getPublicUrl(uniqueName);

    const { data: fileRecord, error: dbError } = await supabase
      .from("files")
      .insert({
        user_id: userId,
        name: (formData.get("name") as string) || file.name,
        original_name: file.name,
        size: file.size,
        mime_type: file.type,
        storage_path: uniqueName,
        public_url: publicUrl,
        is_public: formData.get("is_public") !== "false",
        tags: formData.get("tags") ? (formData.get("tags") as string).split(",") : [],
      })
      .select()
      .single();

    if (dbError) return jsonResponse({ error: dbError.message }, 500);

    return jsonResponse({
      id: fileRecord.id,
      name: fileRecord.name,
      url: publicUrl,
      short_code: fileRecord.short_code,
      size: fileRecord.size,
    }, 201);
  }

  // PUT /files/:id (UPDATE)
  if (req.method === "PUT" && secondLast === "files") {
    const fileId = action;
    if (!keyData.scopes?.includes("read")) {
      return jsonResponse({ error: "Scope 'read' not permitted" }, 403);
    }

    const { data: file } = await supabase.from("files").select("*").eq("id", fileId).eq("user_id", userId).maybeSingle();
    if (!file) return jsonResponse({ error: "File not found" }, 404);

    const body = await req.json();
    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.is_public !== undefined) updates.is_public = body.is_public;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    if (Object.keys(updates).length === 0) {
      return jsonResponse({ error: "No fields to update" }, 400);
    }

    const { data: updated, error } = await supabase
      .from("files")
      .update(updates)
      .eq("id", fileId)
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ file: updated });
  }

  // DELETE /files/:id
  if (req.method === "DELETE" && secondLast === "files") {
    const fileId = action;
    if (!keyData.scopes?.includes("delete")) {
      return jsonResponse({ error: "Scope 'delete' not permitted" }, 403);
    }

    const { data: file } = await supabase.from("files").select("*").eq("id", fileId).eq("user_id", userId).maybeSingle();
    if (!file) return jsonResponse({ error: "File not found" }, 404);

    await supabase.storage.from("cdn-files").remove([file.storage_path]);
    await supabase.from("files").delete().eq("id", file.id);

    return jsonResponse({ deleted: true });
  }

  return jsonResponse({ error: "Not found" }, 404);
});

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
