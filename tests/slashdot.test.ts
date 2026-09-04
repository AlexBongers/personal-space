import assert from "node:assert/strict";
import test from "node:test";
import { parseSlashdotFeed } from "../worker/slashdot.ts";

test("Slashdot RSS parsing keeps safe headline fields and strips markup", () => {
  const feed = parseSlashdotFeed(`<?xml version="1.0"?>
    <rdf:RDF>
      <item>
        <title><![CDATA[An &amp; Interesting Headline]]></title>
        <link>https://tech.slashdot.org/story/123?utm_source=rss&amp;utm_medium=feed</link>
        <description><![CDATA[Summary &lt;p&gt;with markup&lt;/p&gt; and more.]]></description>
        <dc:creator>Reporter</dc:creator>
        <dc:date>2026-09-04T11:00:00+00:00</dc:date>
        <slash:section>tech</slash:section>
      </item>
      <item>
        <title>Unsafe URL</title>
        <link>javascript:alert(1)</link>
        <dc:date>2026-09-04T10:00:00+00:00</dc:date>
      </item>
    </rdf:RDF>`, "2026-09-04T12:00:00.000Z");

  assert.equal(feed.stories.length, 1);
  assert.equal(feed.stories[0].title, "An & Interesting Headline");
  assert.equal(feed.stories[0].url, "https://tech.slashdot.org/story/123?utm_source=rss&utm_medium=feed");
  assert.equal(feed.stories[0].description, "Summary with markup and more.");
  assert.equal(feed.stories[0].section, "tech");
});
