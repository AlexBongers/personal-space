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
  const rows = databases.flatMap((database) => database.rows);
  const openProjects = rows.filter((row) => row.values.complete === false).length;
  const readingNow = rows.filter((row) => row.values.status === "Reading").length;
  const quickLinks = [
    { id: "projects", eyebrow: t("overview.build"), title: "Project tracker", note: t("overview.activeRecords", { count: openProjects }), icon: "▦", tone: "purple" },
    { id: "reading", eyebrow: t("overview.learn"), title: "Reading list", note: t("overview.currentlyReading", { count: readingNow }), icon: "▤", tone: "blue" },
    { id: "travel", eyebrow: t("overview.explore"), title: "Spring route", note: t("overview.keepAdventure"), icon: "✈", tone: "amber" },
  ].filter((link) => items.some((item) => item.id === link.id));

  return (
    <section className="home-overview" aria-label={t("overview.aria")}>
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
