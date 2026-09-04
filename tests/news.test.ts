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

test("news requests are read-only, coalesced and cached independently per source", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    requests++;
    const host = String(input).includes("tweakers") ? "tweakers.net" : "slashdot.org";
    return new Response(item(`https://${host}/story/1`));
  });
  const request = new Request("https://personal.test/api/tweakers");
  const [first, second] = await Promise.all([handleNewsApi(request, "tweakers"), handleNewsApi(request, "tweakers")]);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), await second.json());
  await handleNewsApi(request, "tweakers");
  assert.equal(requests, 1);
  await handleNewsApi(request, "slashdot");
  assert.equal(requests, 2);
  assert.equal((await handleNewsApi(new Request(request, { method: "POST" }), "tweakers")).status, 405);
  assert.equal(requests, 2);
  t.mock.method(Date, "now", () => new Date("2100-01-01").getTime());
  t.mock.method(globalThis, "fetch", async () => { requests++; throw new Error("offline"); });
  const stale = await handleNewsApi(request, "tweakers");
  assert.equal((await stale.json()).stale, true);
  await handleNewsApi(request, "tweakers");
  assert.equal(requests, 3, "failed refresh is backed off for fifteen minutes");
});
