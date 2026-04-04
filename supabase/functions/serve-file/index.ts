import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  const code = pathParts[pathParts.length - 1];

  if (!code) {
    return new Response(JSON.stringify({ error: "Missing file code" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Try short_code first, then id
  let file = null;
  const { data: byCode } = await supabase
    .from("files")
    .select("*")
    .eq("short_code", code)
    .eq("is_public", true)
    .maybeSingle();

  if (byCode) {
    file = byCode;
  } else {
    const { data: byId } = await supabase
      .from("files")
      .select("*")
      .eq("id", code)
      .eq("is_public", true)
      .maybeSingle();
    file = byId;
  }

  if (!file) {
    return new Response(JSON.stringify({ error: "File not found or private" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Log access
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "";
  const referer = req.headers.get("referer") || "";

  await supabase.from("access_logs").insert({
    file_id: file.id,
    user_id: file.user_id,
    ip_address: ip === "unknown" ? null : ip,
    user_agent: userAgent,
    referer: referer,
    event_type: "view",
    bytes_served: file.size,
  });

  // Update view count
  await supabase.from("files").update({
    view_count: file.view_count + 1,
  }).eq("id", file.id);

  // Redirect to actual file
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: file.public_url,
      "Cache-Control": "public, max-age=31536000",
    },
  });
});
