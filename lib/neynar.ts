export interface FarcasterStats {
  casts: number;
  replies: number;
  reactionsReceived: number;
  followers: number;
}

const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY!;
const NEYNAR_BASE = "https://api.neynar.com/v2/farcaster";

export async function fetchFarcasterStats(fid: number): Promise<FarcasterStats> {
  if (!NEYNAR_API_KEY) throw new Error("Missing NEXT_PUBLIC_NEYNAR_API_KEY");

  const userRes = await fetch(`${NEYNAR_BASE}/user/bulk?fids=${fid}`, {
    headers: { api_key: NEYNAR_API_KEY },
  });
  const userJson = await userRes.json();
  const user = userJson.users?.[0];

  const castsRes = await fetch(`${NEYNAR_BASE}/feed/user?fid=${fid}&limit=30`, {
    headers: { api_key: NEYNAR_API_KEY },
  });
  const castsJson = await castsRes.json();
  const casts = castsJson.casts ?? [];

  let replies = 0;
  let reactionsReceived = 0;

  for (const cast of casts) {
    if (cast.parent_hash) replies++;
    reactionsReceived += (cast.reactions?.likes?.length || 0);
    reactionsReceived += (cast.reactions?.recasts?.length || 0);
  }

  return {
    casts: casts.length,
    replies,
    reactionsReceived,
    followers: user?.follower_count ?? 0,
  };
}
