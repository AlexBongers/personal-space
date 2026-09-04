export const NEWS_SOURCES = {
  slashdot: { name: "Slashdot", url: "https://rss.slashdot.org/Slashdot/slashdotMain", host: "slashdot.org" },
  tweakers: { name: "Tweakers", url: "https://tweakers.net/feeds/nieuws.xml", host: "tweakers.net" },
} as const;
export type NewsSource = keyof typeof NEWS_SOURCES;
export type NewsStory = { id: string; title: string; url: string; description: string; author: string; publishedAt: string; section: string };
export type NewsFeed = { stories: NewsStory[]; fetchedAt: string; stale?: boolean; error?: string };
const TTL = 15 * 60 * 1000;
const cached = new Map<NewsSource, { checkedAt: number; feed: NewsFeed }>();
const pending = new Map<NewsSource, Promise<NewsFeed>>();

export const decodeEntities = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
    const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : "�";
  })
  .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " " })[entity] || entity);

const cleanText = (value: string) => decodeEntities(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const tag = (source: string, name: string) => {
  const match = source.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? cleanText(match[1]) : "";
};

export function parseNewsFeed(xml: string, source: NewsSource, fetchedAt = new Date().toISOString()): NewsFeed {
  const host = NEWS_SOURCES[source].host;
  const seen = new Set<string>();
  const stories: NewsStory[] = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const title = tag(item, "title");
    const publishedAt = tag(item, "dc:date") || tag(item, "pubDate");
    let url: URL;
    try { url = new URL(tag(item, "link")); } catch { continue; }
    if (!title || !publishedAt || Number.isNaN(Date.parse(publishedAt)) || url.protocol !== "https:" || url.username || url.password || !(url.hostname === host || url.hostname.endsWith(`.${host}`)) || seen.has(url.href)) continue;
    seen.add(url.href);
    stories.push({ id: url.href, title, url: url.href, description: tag(item, "description").slice(0, 1200), author: tag(item, "dc:creator") || tag(item, "author"), publishedAt: new Date(publishedAt).toISOString(), section: tag(item, "slash:section") || tag(item, "category") });
    if (stories.length === 15) break;
  }
  if (!stories.length) throw new Error("No usable feed items");
  return { stories, fetchedAt };
}

async function fetchFeed(source: NewsSource): Promise<NewsFeed> {
  const response = await fetch(NEWS_SOURCES[source].url, { headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "Personal Space RSS Reader/1.0" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
  const xml = await response.text();
  if (xml.length > 2_000_000) throw new Error("Feed exceeds size limit");
  return parseNewsFeed(xml, source);
}

export async function handleNewsApi(request: Request, source: NewsSource) {
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  const json = (feed: NewsFeed, status = 200) => Response.json(feed, { status, headers: { "Cache-Control": "private, max-age=900", "X-Content-Type-Options": "nosniff" } });
  const previous = cached.get(source);
  if (previous && Date.now() - previous.checkedAt < TTL) return json(previous.feed);
  let requestPromise = pending.get(source);
  if (!requestPromise) {
    requestPromise = fetchFeed(source).then((feed) => {
      cached.set(source, { feed, checkedAt: Date.now() });
      return feed;
    }).finally(() => pending.delete(source));
    pending.set(source, requestPromise);
  }
  try { return json(await requestPromise); }
  catch {
    if (previous) {
      const feed = { ...previous.feed, stale: true };
      cached.set(source, { feed, checkedAt: Date.now() });
      return json(feed);
    }
    return json({ stories: [], fetchedAt: new Date().toISOString(), error: "Feed temporarily unavailable" }, 503);
  }
}
