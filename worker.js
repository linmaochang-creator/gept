// Cloudflare Worker：保護 API 金鑰的 Claude 代理
// 部署：Cloudflare Dashboard → Workers → 建立 → 貼上此檔
// 設定 Secret：ANTHROPIC_API_KEY（必要）、ALLOW_ORIGIN（你的 App 網址，例如 https://xxx.github.io）
export default {
  async fetch(req, env) {
    const origin = env.ALLOW_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

    let body;
    try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors }); }
    const messages = (body.messages || []).slice(-20).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 3000),
    }));
    if (!messages.length) return new Response("No messages", { status: 400, headers: cors });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 1000,
        system: String(body.system || "").slice(0, 2000),
        messages,
      }),
    });
    const data = await r.json();
    if (!r.ok) return new Response(JSON.stringify({ error: data }), { status: r.status, headers: { ...cors, "content-type": "application/json" } });
    const text = (data.content || []).map(c => c.text || "").join("");
    return new Response(JSON.stringify({ text }), { headers: { ...cors, "content-type": "application/json" } });
  },
};
