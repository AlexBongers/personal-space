# Adversarial review

Review date: 2026-08-03

This record covers the final local browser walkthrough for the Sites build. The review deliberately
used awkward navigation sequences, keyboard-only editor flows, different themes, and a narrow
viewport rather than checking only the seeded happy path.

| Finding | Reproduction | Resolution |
| --- | --- | --- |
| Navigation retained the previous document scroll position | Scroll to the bottom of Home, then open Project tracker | Fixed: item and row navigation now returns to the top while the desktop sidebar remains pinned. |
| Slash insertion left the typed command in the source block | In an empty block, type `/quo` and press Enter | Fixed: cleanup and insertion now happen in one state update; the source block is empty and the new block receives focus. |
| Native multi-select fields were cramped and illegible in dark mode | Open Project tracker, switch to Table, then switch to dark mode | Fixed: multi-select values now use compact, colored toggle chips with pressed states. |
| The old collapsed mobile rail hid the workspace tree | Open the app below 720 px and try to navigate to a nested page | Fixed: mobile now uses a full slide-out tree with a scrim, explicit close control, and automatic dismissal after navigation. |
| Home exposed delete controls that intentionally did nothing | Hover the Home tree row or inspect page actions | Fixed: destructive controls are no longer rendered for the required Home root. |

## Walkthrough coverage

- Home dashboard, editable page blocks, Enter focus behavior, and slash insertion.
- Project tracker board and table views, colored values, sorting controls, row pages, and dark mode.
- Quick-find from the visible control, live row-title matching, keyboard Enter selection, and row navigation.
- Responsive home and navigation at 390 × 844, including the nested page tree.
- Persistence behavior through browser storage and the seeded-workspace migration path.

## Storage follow-up

The original browser-storage limitation was resolved in the next release. Workspace content is now
authoritative in a private D1 database behind the same-origin Worker API. Existing browser data is
migrated once when the first D1-backed version opens; only theme preference and an emergency
unsynced backup remain device-local. Theme and language preferences are intentionally device-local
presentation settings.
