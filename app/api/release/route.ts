const COMMIT_SOURCES = [
  ["vercel", process.env.VERCEL_GIT_COMMIT_SHA],
  ["github", process.env.GITHUB_SHA],
  ["cloudflare", process.env.CF_PAGES_COMMIT_SHA],
  ["configured", process.env.NEXT_PUBLIC_DEPLOY_COMMIT_SHA],
] as const;

export async function GET() {
  const selected = COMMIT_SOURCES.find(([, value]) => value && /^[a-f0-9]{7,40}$/i.test(value));
  const commit = selected?.[1] || "local";
  return Response.json(
    { commit, shortCommit: commit === "local" ? commit : commit.slice(0, 7), source: selected?.[0] || "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
