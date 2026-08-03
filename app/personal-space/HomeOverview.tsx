"use client";

import { isDatabase } from "./model";
import type { Item } from "./types";

type HomeOverviewProps = {
  items: Item[];
  onOpen: (id: string) => void;
};

export function HomeOverview({ items, onOpen }: HomeOverviewProps) {
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
    { id: "projects", eyebrow: "Build", title: "Project tracker", note: `${openProjects} active records`, icon: "▦", tone: "purple" },
    { id: "reading", eyebrow: "Learn", title: "Reading list", note: `${readingNow} currently reading`, icon: "▤", tone: "blue" },
    { id: "travel", eyebrow: "Explore", title: "Spring route", note: "Keep the next adventure close", icon: "✈", tone: "amber" },
  ].filter((link) => items.some((item) => item.id === link.id));

  return (
    <section className="home-overview" aria-label="Workspace overview">
      <div className="home-hero">
        <div className="hero-copy">
          <span className="hero-kicker"><i /> Your week, at a glance</span>
          <h2>Make room for<br /><em>what matters.</em></h2>
          <p>Your plans, notes and ideas are gathered here—quietly organized and ready when inspiration arrives.</p>
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
          <div><strong>{openTodos}</strong><span>open to-dos</span></div>
          <div><strong>{pageCount}</strong><span>living pages</span></div>
          <div><strong>{rows.length}</strong><span>database rows</span></div>
        </div>
      </div>
      <div className="quick-heading">
        <div><span className="eyebrow">Continue where you left off</span><strong>Open a corner of your space</strong></div>
        <span>{items.length} places, all yours</span>
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
