const SLASHDOT_FEED_URL = "https://rss.slashdot.org/Slashdot/slashdotMain";
const UPSTREAM_CACHE_TTL_MS = 15 * 60 * 1000;

export type SlashdotStory = {
  id: string;
  title: string;
  url: string;
  description: string;
  author: string;
  publishedAt: string;
  section: string;
};

export type SlashdotFeed = {
  stories: SlashdotStory[];
  fetchedAt: string;
  stale?: boolean;
  error?: string;
};

let cachedFeed: { fetchedAtMs: number; feed: SlashdotFeed } | null = null;

const decodeXml = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

const cleanText = (value: string) => decodeXml(value)
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const tagValue = (source: string, tag: string) => {
  const match = source.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
};

const safeStoryUrl = (value: string) => {
  try {
    const url = new URL(decodeXml(value));
    return url.protocol === "https:" && (url.hostname === "slashdot.org" || url.hostname.endsWith(".slashdot.org"))
      ? url.toString()
      : "";
  } catch {
    return "";
  }
};

export const parseSlashdotFeed = (xml: string, fetchedAt = new Date().toISOString()): SlashdotFeed => {
  const stories = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
    .map((match) => {
      const item = match[1];
      const title = tagValue(item, "title");
      const url = safeStoryUrl(tagValue(item, "link"));
      const publishedAt = tagValue(item, "dc:date");
      if (!title || !url || !publishedAt || Number.isNaN(Date.parse(publishedAt))) return null;
      return {
        id: url,
        title,
        url,
        description: cleanText(tagValue(item, "description")).slice(0, 240),
        author: tagValue(item, "dc:creator"),
        publishedAt: new Date(publishedAt).toISOString(),
        section: tagValue(item, "slash:section"),
      } satisfies SlashdotStory;
    })
    .filter((story): story is SlashdotStory => Boolean(story));

  if (!stories.length) throw new Error("Slashdot returned no usable stories");
  return { stories: stories.slice(0, 15), fetchedAt };
};

const fetchSlashdot = async (): Promise<SlashdotFeed> => {
  const response = await fetch(SLASHDOT_FEED_URL, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "Personal Space RSS Reader/1.0",
    },
  });
  if (!response.ok) throw new Error(`Slashdot feed request failed (${response.status})`);
  return parseSlashdotFeed(await response.text());
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  },
});

export const handleSlashdotApi = async (request: Request) => {
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });

  const now = Date.now();
  if (cachedFeed && now - cachedFeed.fetchedAtMs < UPSTREAM_CACHE_TTL_MS) return json(cachedFeed.feed);

  try {
    const feed = await fetchSlashdot();
    cachedFeed = { fetchedAtMs: Date.now(), feed };
    return json(feed);
  } catch (error) {
    if (cachedFeed) {
      return json({
        ...cachedFeed.feed,
        stale: true,
        error: "Slashdot is temporarily unavailable; showing the latest headlines we have.",
      });
    }
    console.error("Slashdot feed failed", error);
    return json({ stories: [], fetchedAt: new Date().toISOString(), error: "Slashdot is temporarily unavailable." }, 503);
  }
};
