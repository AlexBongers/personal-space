"use client";

import { isDatabase } from "./model";
import { useLanguage } from "./i18n";
import { SlashdotFeed } from "./SlashdotFeed";
import type { Item } from "./types";

type HomeOverviewProps = {
  items: Item[];
  onOpen: (id: string) => void;
};

export function HomeOverview({ items, onOpen }: HomeOverviewProps) {
  const { language, t } = useLanguage();
  const databases = items.filter(isDatabase);
  const rows = databases.flatMap((database) => database.rows);
  const openProjects = rows.filter((row) => row.values.complete === false).length;
  const readingNow = rows.filter((row) => row.values.status === "Reading").length;
  const quickLinks = [
    { id: "projects", title: t("overview.projectTracker"), note: t("overview.activeRecords", { count: openProjects }), icon: "▦", tone: "purple" },
    { id: "reading", title: t("overview.readingList"), note: t("overview.currentlyReading", { count: readingNow }), icon: "▤", tone: "blue" },
    { id: "travel", title: t("overview.springRoute"), note: t("overview.keepAdventure"), icon: "✈", tone: "amber" },
  ].filter((link) => items.some((item) => item.id === link.id));

  const today = new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <section className="home-overview" aria-label={t("overview.aria")}>
      <header className="landing-hero">
        <div>
          <span className="section-kicker">{t("overview.landingLabel")}</span>
          <h1>{t("overview.greeting")}</h1>
          <p>{t("overview.subtitle")}</p>
        </div>
        <div className="today-card">
          <span>{t("overview.today")}</span>
          <strong>{today}</strong>
          <small>{t("overview.privateSpace")}</small>
        </div>
      </header>
      <div className="landing-grid">
        <SlashdotFeed />
        <aside className="quick-panel">
          <div className="quick-heading">
            <div><span className="section-kicker">{t("overview.workspaceLabel")}</span><h2>{t("overview.openCorner")}</h2></div>
          </div>
          <div className="quick-grid">
            {quickLinks.map((link) => (
              <button className={`quick-card tone-${link.tone}`} key={link.id} onClick={() => onOpen(link.id)}>
                <span className="quick-icon">{link.icon}</span>
                <span className="quick-copy"><strong>{link.title}</strong><span>{link.note}</span></span>
                <span className="quick-arrow">↗</span>
              </button>
            ))}
          </div>
          <div className="quiet-space-note">
            <span>✦</span>
            <p>{t("overview.spaceNote")}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
