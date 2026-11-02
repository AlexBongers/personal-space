import { dialog, Notification, shell } from "electron";

const KEPT = 20;
const HELP = "Open Systeeminstellingen > Meldingen > Personal Space en zet 'Sta meldingen toe' aan. Staat Personal Space daar niet, bouw de app dan opnieuw met npm run desktop:build: macOS toont alleen meldingen van ondertekende apps. Een Focus-stand kan meldingen ook verbergen.";

/**
 * Shows macOS notifications. Electron removes a notification from Notification Center when its object is
 * garbage collected, so the latest ones are kept until clicked or closed; the set never exceeds KEPT.
 */
export const createNotifier = (log: (message: string) => void, defaultClick: () => void) => {
  const live = new Set<Notification>();

  const notify = (title: string, body: string, onClick: () => void = defaultClick) => {
    const notification = new Notification({ title, body });
    const forget = () => live.delete(notification);
    live.add(notification);
    if (live.size > KEPT) live.delete(live.values().next().value as Notification);
    notification.on("click", () => { forget(); onClick(); });
    notification.on("close", forget);
    notification.on("failed", (_event, error) => { forget(); log(`Melding niet getoond (${title}): ${error}`); });
    notification.show();
    return notification;
  };

  /** Reports back what macOS did with the test notification, instead of failing silently. */
  const sendTest = () => {
    if (!Notification.isSupported()) {
      void dialog.showMessageBox({ type: "warning", message: "Meldingen worden niet ondersteund op dit systeem." });
      return;
    }
    let answered = false;
    const notification = notify("Personal Space", "Meldingen werken. Je ziet herinneringen, Parro en Gmail voortaan hier.");
    notification.on("show", () => { answered = true; });
    notification.on("failed", (_event, error) => {
      answered = true;
      void dialog.showMessageBox({ type: "warning", message: "macOS weigerde de melding", detail: `${error}\n\n${HELP}` });
    });
    setTimeout(() => {
      if (answered) return;
      void dialog.showMessageBox({ type: "info", message: "Geen melding gezien?", detail: HELP, buttons: ["Open Meldingen-instellingen", "Sluit"], defaultId: 0, cancelId: 1 })
        .then(({ response }) => { if (response === 0) void shell.openExternal("x-apple.systempreferences:com.apple.Notifications-Settings.extension"); });
    }, 4000);
  };

  return { notify, sendTest };
};

export type Notify = ReturnType<typeof createNotifier>["notify"];
