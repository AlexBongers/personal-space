"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "./i18n";

type SlashdotStory = {
  id: string;
  title: string;
  url: string;
  description: string;
  author: string;
  publishedAt: string;
  section: string;
};

type SlashdotFeedResponse = {
  stories: SlashdotStory[];
  fetchedAt: string;
  stale?: boolean;
  error?: string;
};

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const formatStoryTime = (value: string, language: "en" | "nl") => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatFeedTime = (value: string, language: "en" | "nl") => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

type NewsSource = "slashdot" | "tweakers" | "nos" | "bunniksnieuws";

const SOURCE_DETAILS: Record<NewsSource, { name: string; url: string }> = {
  slashdot: { name: "Slashdot", url: "https://slashdot.org/" },
  tweakers: { name: "Tweakers", url: "https://tweakers.net/" },
  nos: { name: "NOS", url: "https://nos.nl/" },
  bunniksnieuws: { name: "Bunniks Nieuws", url: "https://www.bunniksnieuws.nl/" },
};

export function SlashdotFeed({ source = "slashdot" }: { source?: NewsSource }) {
  const { language, t } = useLanguage();
  const { name: sourceName, url: sourceUrl } = SOURCE_DETAILS[source];
  const [feed, setFeed] = useState<SlashdotFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const loadFeed = useCallback(async (manual = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (manual) setRefreshing(true);
    try {
      const response = await fetch(`/api/${source}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json() as SlashdotFeedResponse;
      if (requestRef.current !== controller) return;
      if (!response.ok || !body.stories?.length) throw new Error(t("overview.newsUnavailable"));
      setFeed(body);
      setError(body.stale ? t("overview.newsStale") : "");
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      if (requestRef.current !== controller) return;
      setError(requestError instanceof Error ? requestError.message : t("overview.newsUnavailable"));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [t, source]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadFeed(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void loadFeed(); }, REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [loadFeed]);

  const stories = useMemo(() => feed?.stories.slice(0, 10) || [], [feed]);

  return (
    <section className="slashdot-panel" aria-labelledby={`${source}-heading`}>
      <div className="slashdot-heading">
        <div>
          <h2 id={`${source}-heading`}>{sourceName}</h2>
        </div>
        <button
          type="button"
          className="feed-refresh"
          aria-label={`${sourceName}: ${t("news.refresh")}`}
          onClick={() => void loadFeed(true)}
          disabled={loading || refreshing}
        >
          <span className={loading || refreshing ? "spin" : ""}>↻</span>
        </button>
      </div>
      <div className="slashdot-meta">
        <span className={`live-dot ${error ? "feed-warning" : ""}`} aria-hidden="true" />
        <span>{feed?.fetchedAt ? t("overview.newsUpdated", { time: formatFeedTime(feed.fetchedAt, language) }) : t("overview.newsLoading")}</span>
        <span className="meta-divider">·</span>
        <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceName} ↗</a>
      </div>

      {loading && !feed && (
        <div className="news-skeleton" aria-hidden="true">
          {[0, 1, 2, 3].map((entry) => <span key={entry} />)}
        </div>
      )}

      {!loading && !stories.length && (
        <div className="news-empty">
          <strong>{t("overview.newsUnavailable")}</strong>
          <button type="button" className="text-button" onClick={() => void loadFeed(true)}>{t("overview.tryAgain")}</button>
        </div>
      )}

      {stories.length > 0 && (
        <ol className="news-list">
          {stories.map((story, index) => (
            <li key={story.id} className={index === 0 ? "featured-story" : ""}>
              <a href={story.url} target="_blank" rel="noreferrer">
                <span className="story-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="story-copy">
                  <strong>{story.title}</strong>
                  <span className="story-meta">{story.section || t("overview.newsSection")} · {formatStoryTime(story.publishedAt, language)}</span>
                  {story.description && <span className="story-description">{story.description}</span>}
                </span>
                <span className="story-arrow">↗</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      {error && <p className="news-status">{error}</p>}
      <div className="slashdot-footer">
        <a href={sourceUrl} target="_blank" rel="noreferrer">{t("news.open", { source: sourceName })} ↗</a>
      </div>
    </section>
  );
}
