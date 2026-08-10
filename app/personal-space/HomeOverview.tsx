"use client";

import { isDatabase } from "./model";
import { useLanguage } from "./i18n";
import type { Item } from "./types";

type HomeOverviewProps = {
  items: Item[];
  onOpen: (id: string) => void;
};

export function HomeOverview({ items, onOpen }: HomeOverviewProps) {
  const { t } = useLanguage();
  const databases = items.filter(isDatabase);
  const pageCount = items.length - databases.length;
  const rows = databases.flatMap((database) => database.rows);
  const openProjects = rows.filter((row) => row.values.complete === false).length;
  const openTodos = [
    ...items.flatMap((item) => (item.kind === "page" ? item.blocks : [])),
    ...rows.flatMap((row) => row.blocks),
  ].filter((block) => block.type === "todo" && !block.checked).length;
  const readingNow = rows.filter((row) => row.values.status === "Reading").length;
  const quickLinks = [
    { id: "projects", eyebrow: t("overview.build"), title: "Project tracker", note: t("overview.activeRecords", { count: openProjects }), icon: "▦", tone: "purple" },
    { id: "reading", eyebrow: t("overview.learn"), title: "Reading list", note: t("overview.currentlyReading", { count: readingNow }), icon: "▤", tone: "blue" },
    { id: "travel", eyebrow: t("overview.explore"), title: "Spring route", note: t("overview.keepAdventure"), icon: "✈", tone: "amber" },
  ].filter((link) => items.some((item) => item.id === link.id));

  return (
    <section className="home-overview" aria-label={t("overview.aria")}>
      <div className="home-hero">
        <div className="hero-copy">
          <h1>{t("overview.headline")}<br /><em>{t("overview.headlineEmphasis")}</em></h1>
          <p>{t("overview.description")}</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit-ring ring-one" />
          <span className="orbit-ring ring-two" />
          <span className="orbit-dot dot-amber" />
          <span className="orbit-dot dot-blue" />
          <span className="orbit-dot dot-purple" />
          <span className="orbit-core">P</span>
        </div>
        <div className="hero-stats">
          <div><strong>{openTodos}</strong><span>{t("overview.openTodos")}</span></div>
          <div><strong>{pageCount}</strong><span>{t("overview.livingPages")}</span></div>
          <div><strong>{rows.length}</strong><span>{t("overview.databaseRows")}</span></div>
        </div>
      </div>
      <div className="quick-heading">
        <strong>{t("overview.openCorner")}</strong>
        <span>{t("overview.places", { count: items.length })}</span>
      </div>
      <div className="quick-grid">
        {quickLinks.map((link) => (
          <button className={`quick-card tone-${link.tone}`} key={link.id} onClick={() => onOpen(link.id)}>
            <span className="quick-icon">{link.icon}</span>
            <span className="quick-copy"><small>{link.eyebrow}</small><strong>{link.title}</strong><span>{link.note}</span></span>
            <span className="quick-arrow">↗</span>
          </button>
        ))}
      </div>
    </section>
  );
}
