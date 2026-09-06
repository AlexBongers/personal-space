"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "./i18n";
import { useNearViewport } from "./useNearViewport";

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

const formatStoryTime = (value: string, formatter: Intl.DateTimeFormat) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatter.format(date);
};

const formatFeedTime = (value: string, formatter: Intl.DateTimeFormat) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatter.format(date);
};

export type NewsSource = "slashdot" | "tweakers" | "nos" | "bunniksnieuws";

const SOURCE_DETAILS: Record<NewsSource, { name: string; url: string }> = {
  slashdot: { name: "Slashdot", url: "https://slashdot.org/" },
  tweakers: { name: "Tweakers", url: "https://tweakers.net/" },
  nos: { name: "NOS", url: "https://nos.nl/" },
  bunniksnieuws: { name: "Bunniks Nieuws", url: "https://www.bunniksnieuws.nl/" },
};

export function SlashdotFeed({ source = "slashdot", compact = false, maxStories, hideHeading = false }: { source?: NewsSource; compact?: boolean; maxStories?: number; hideHeading?: boolean }) {
  const { language, t } = useLanguage();
  const { name: sourceName, url: sourceUrl } = SOURCE_DETAILS[source];
  const [feed, setFeed] = useState<SlashdotFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showDescriptions, setShowDescriptions] = useState(!compact);
  const requestRef = useRef<AbortController | null>(null);
  const { ref: panelRef, active } = useNearViewport<HTMLElement>();
  const locale = language === "nl" ? "nl-NL" : "en-US";
  const storyTimeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }), [locale]);
  const feedTimeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), [locale]);

  const loadFeed = useCallback(async (manual = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (manual) setRefreshing(true);
    try {
      const response = await fetch(`/api/${source}`, { cache: manual ? "reload" : "default", signal: controller.signal });
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
    if (!active) return undefined;
    const initialLoad = window.setTimeout(() => void loadFeed(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void loadFeed(); }, REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [active, loadFeed]);

  const stories = useMemo(() => feed?.stories.slice(0, maxStories ?? (compact ? 3 : 10)) || [], [compact, feed, maxStories]);

  return (
    <section ref={panelRef} className={`slashdot-panel ${compact ? "slashdot-compact" : ""}`} aria-labelledby={hideHeading ? undefined : `${source}-heading`} aria-label={hideHeading ? sourceName : undefined}>
      {!hideHeading && <div className="slashdot-heading">
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
      </div>}
      <div className="slashdot-meta">
        <span className={`live-dot ${error ? "feed-warning" : ""}`} aria-hidden="true" />
        <span>{feed?.fetchedAt ? t("overview.newsUpdated", { time: formatFeedTime(feed.fetchedAt, feedTimeFormatter) }) : t("overview.newsLoading")}</span>
        <span className="meta-divider">·</span>
        <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceName} ↗</a>
        {hideHeading && <button type="button" className="feed-refresh compact-feed-refresh" aria-label={`${sourceName}: ${t("news.refresh")}`} onClick={() => void loadFeed(true)} disabled={loading || refreshing}><span className={loading || refreshing ? "spin" : ""}>↻</span></button>}
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
                  <span className="story-meta">{story.section || t("overview.newsSection")} · {formatStoryTime(story.publishedAt, storyTimeFormatter)}</span>
                  {(!compact || showDescriptions) && story.description && <span className="story-description">{story.description}</span>}
                </span>
                <span className="story-arrow">↗</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      {error && <p className="news-status">{error}</p>}
      {compact && stories.length > 0 && <button type="button" className="text-button news-summary-toggle" onClick={() => setShowDescriptions((current) => !current)}>{showDescriptions ? t("home.hideNewsSummaries") : t("home.showNewsSummaries")}</button>}
      <div className="slashdot-footer">
        <a href={sourceUrl} target="_blank" rel="noreferrer">{t("news.open", { source: sourceName })} ↗</a>
      </div>
    </section>
  );
}
