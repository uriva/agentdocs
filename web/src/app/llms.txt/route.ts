const API_BASE = "https://agentdocs-api.uriva.deno.net";

export async function GET() {
  const res = await fetch(`${API_BASE}/llms.txt`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return new Response("Failed to fetch llms.txt", { status: 502 });
  }

  const text = await res.text();

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
