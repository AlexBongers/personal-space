type IconName = "home" | "search" | "tasks" | "calendar" | "news" | "plus" | "database" | "menu" | "mail";

const paths: Record<IconName, string> = {
  mail: "M3 5h18v14H3ZM3 5l9 7 9-7",
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  tasks: "m3 6 2 2 4-4m-6 9 2 2 4-4m-6 9 2 2 4-4M13 6h8M13 13h8M13 20h8",
  calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  news: "M4 4h16v16H4ZM8 8h8M8 12h8M8 16h5",
  plus: "M12 4v16M4 12h16",
  database: "M3 7c0-5 18-5 18 0s-18 5-18 0Zm0 0v10c0 5 18 5 18 0V7M3 12c0 5 18 5 18 0",
  menu: "M4 6h16M4 12h16M4 18h16",
};

export function InterfaceIcon({ name }: { name: IconName }) {
  return <svg className="interface-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
