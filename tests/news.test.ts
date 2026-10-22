import assert from "node:assert/strict";
import test from "node:test";
import { decodeEntities, handleNewsApi, parseNewsFeed } from "../worker/news.ts";

const item = (url: string, description = "Een korte samenvatting.") => `<item><title><![CDATA[Hardware &amp; software]]></title><link>${url}</link><description><![CDATA[${description}]]></description><pubDate>Fri, 04 Sep 2026 12:00:00 +0200</pubDate><author>Redactie</author><category>Hardware</category></item>`;

test("Tweakers RSS preserves long summaries, dates and source fields", () => {
  const description = "Een leesbare samenvatting. ".repeat(30);
  const feed = parseNewsFeed(`<rss>${item("https://tweakers.net/nieuws/1", `<p>${description}</p>`)}</rss>`, "tweakers");
  assert.equal(feed.stories[0].title, "Hardware & software");
  assert.equal(feed.stories[0].description, description.trim());
  assert.equal(feed.stories[0].publishedAt, "2026-09-04T10:00:00.000Z");
  assert.equal(feed.stories[0].author, "Redactie");
  assert.equal(feed.stories[0].section, "Hardware");
});

test("RSS rejects unsafe and wrong-source URLs and deduplicates stories", () => {
  const urls = ["https://tweakers.net/nieuws/1", "https://tweakers.net/nieuws/1", "http://tweakers.net/2", "https://tweakers.net.evil.test/3", "javascript:alert(1)", "https://user:secret@tweakers.net/4", "https://slashdot.org/5"];
  assert.equal(parseNewsFeed(urls.map((url) => item(url)).join(""), "tweakers").stories.length, 1);
  assert.throws(() => parseNewsFeed("<rss></rss>", "tweakers"), /No usable/);
  assert.equal(decodeEntities("&#x20AC; &#99999999999; &#xD800; &amp;"), "€ � � &");
});

test("NOS and Bunniks Nieuws use their own trusted article hosts", () => {
  assert.equal(parseNewsFeed(item("https://nos.nl/artikel/1"), "nos").stories[0].url, "https://nos.nl/artikel/1");
  assert.equal(parseNewsFeed(item("https://www.bunniksnieuws.nl/lokaal/1"), "bunniksnieuws").stories[0].url, "https://www.bunniksnieuws.nl/lokaal/1");
  assert.throws(() => parseNewsFeed(item("https://tweakers.net/nieuws/1"), "nos"), /No usable/);
});

test("a cold feed failure is not cached by the browser and can immediately recover", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
  const request = new Request("https://personal.test/api/nos");
  const failed = await handleNewsApi(request, "nos");
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("Cache-Control"), "no-store");
  t.mock.method(globalThis, "fetch", async () => new Response(item("https://nos.nl/artikel/recovered")));
  const recovered = await handleNewsApi(request, "nos");
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).stories.length, 1);
});

test("news requests are read-only, coalesced and cached independently per source", async (t) => {
  t.mock.method(Date, "now", () => new Date("2099-01-01").getTime());
  let requests = 0;
  const requestedUrls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    requests++;
    const inputUrl = String(input);
    requestedUrls.push(inputUrl);
    const host = inputUrl.includes("tweakers") ? "tweakers.net" : inputUrl.includes("nosnieuws") ? "nos.nl" : inputUrl.includes("bunniksnieuws") ? "bunniksnieuws.nl" : "slashdot.org";
    return new Response(item(`https://${host}/story/1`));
  });
  const request = new Request("https://personal.test/api/tweakers");
  const [first, second] = await Promise.all([handleNewsApi(request, "tweakers"), handleNewsApi(request, "tweakers")]);
  assert.equal(first.status, 200);
  assert.equal(requestedUrls[0], "https://tweakers.net/feeds/nieuws.xml/direct");
  assert.deepEqual(await first.json(), await second.json());
  await handleNewsApi(request, "tweakers");
  assert.equal(requests, 1);
  const refresh = new Request(request, { headers: { "Cache-Control": "no-cache" } });
  await Promise.all([handleNewsApi(refresh, "tweakers"), handleNewsApi(refresh, "tweakers")]);
  assert.equal(requests, 2, "manual refresh bypasses the fresh server cache and remains coalesced");
  await handleNewsApi(request, "slashdot");
  assert.equal(requests, 3);
  await handleNewsApi(request, "nos");
  await handleNewsApi(request, "bunniksnieuws");
  assert.equal(requests, 5);
  assert.equal((await handleNewsApi(new Request(request, { method: "POST" }), "tweakers")).status, 405);
  assert.equal(requests, 5);
  t.mock.method(Date, "now", () => new Date("2100-01-01").getTime());
  t.mock.method(globalThis, "fetch", async () => { requests++; throw new Error("offline"); });
  const stale = await handleNewsApi(request, "tweakers");
  assert.equal((await stale.json()).stale, true);
  assert.equal(stale.headers.get("Cache-Control"), "no-store");
  await handleNewsApi(request, "tweakers");
  assert.equal(requests, 6, "failed refresh is briefly backed off");
  await handleNewsApi(refresh, "tweakers");
  assert.equal(requests, 7, "manual retry bypasses the failure backoff");
  t.mock.method(Date, "now", () => new Date("2100-01-01T00:00:31Z").getTime());
  t.mock.method(globalThis, "fetch", async () => { requests++; return new Response(item("https://tweakers.net/nieuws/recovered")); });
  const recovered = await handleNewsApi(request, "tweakers");
  const body = await recovered.json();
  assert.equal(body.stale, undefined);
  assert.equal(body.stories[0].url, "https://tweakers.net/nieuws/recovered");
  assert.equal(requests, 8, "automatic retry recovers after thirty seconds rather than fifteen minutes");
});

test("public feed snapshots survive isolate replacement and failed upstream refreshes", async (t) => {
  const snapshots = new Map<string, Response>();
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
    async match(key: Request) { return snapshots.get(key.url)?.clone(); },
    async put(key: Request, response: Response) {
      assert.equal(key.headers.get("Authorization"), null);
      assert.equal(key.headers.get("oai-authenticated-user-id"), null);
      assert.equal(response.headers.get("Cache-Control"), "public, max-age=86400");
      snapshots.set(key.url, response.clone());
    },
  } } });
  t.after(() => {
    if (originalCaches) Object.defineProperty(globalThis, "caches", originalCaches);
    else Reflect.deleteProperty(globalThis, "caches");
  });
  const freshIsolate = (name: string) => import(new URL(`../worker/news.ts?isolate=${name}`, import.meta.url).href);
  const request = new Request("https://personal.test/api/tweakers", { headers: { Authorization: "Bearer visitor-secret", "oai-authenticated-user-id": "owner", "Cache-Control": "no-cache" } });
  let upstreamCalls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    upstreamCalls++;
    return new Response(item("https://tweakers.net/nieuws/shared-snapshot"));
  });
  const first = await (await freshIsolate("first")).handleNewsApi(request, "tweakers");
  assert.equal(first.status, 200);
  assert.equal(snapshots.size, 1);
  t.mock.method(globalThis, "fetch", async () => { upstreamCalls++; return new Response(null, { status: 503 }); });
  const secondIsolate = await freshIsolate("second");
  const cached = await secondIsolate.handleNewsApi(new Request("https://personal.test/api/tweakers"), "tweakers");
  assert.equal((await cached.json()).stories.length, 1);
  assert.equal(upstreamCalls, 1, "a fresh shared snapshot avoids fetching in a new isolate");
  const failedRefresh = await (await freshIsolate("third")).handleNewsApi(request, "tweakers");
  assert.equal(failedRefresh.status, 200);
  assert.equal(failedRefresh.headers.get("Cache-Control"), "no-store");
  const stale = await failedRefresh.json();
  assert.equal(stale.stale, true);
  assert.equal(stale.stories[0].url, "https://tweakers.net/nieuws/shared-snapshot");
  assert.equal(upstreamCalls, 2);
  t.mock.method(globalThis, "fetch", async () => new Response(item("https://nos.nl/artikel/separate-source")));
  const nos = await secondIsolate.handleNewsApi(new Request("https://personal.test/api/nos"), "nos");
  assert.equal((await nos.json()).stories[0].url, "https://nos.nl/artikel/separate-source");
  assert.equal(snapshots.size, 2, "public sources have independent shared snapshots");
});

test("cache storage failure never prevents serving a successful live feed", async (t) => {
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
    async match() { throw new Error("cache unavailable"); },
    async put() { throw new Error("cache unavailable"); },
  } } });
  t.after(() => {
    if (originalCaches) Object.defineProperty(globalThis, "caches", originalCaches);
    else Reflect.deleteProperty(globalThis, "caches");
  });
  t.mock.method(globalThis, "fetch", async () => new Response(item("https://tweakers.net/nieuws/live")));
  const isolate = await import(new URL("../worker/news.ts?isolate=cache-outage", import.meta.url).href);
  const response = await isolate.handleNewsApi(new Request("https://personal.test/api/tweakers"), "tweakers");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).stories[0].url, "https://tweakers.net/nieuws/live");
});
