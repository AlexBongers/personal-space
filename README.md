# Personal Space

A personal knowledge manager inspired by Notion — pages, blocks, databases with table / board /
list views — built autonomously by OpenCode running DeepSeek V4 Flash with the
[superpowers](https://github.com/obra/superpowers) development methodology.

- [REQUIREMENTS.md](./REQUIREMENTS.md) — what gets built, phase by phase, with success criteria.
- [AGENTS.md](./AGENTS.md) — the build rules: conventions and the defect / review records.

## Running the build

Prerequisites: Docker, and VS Code with the Dev Containers extension.

1. Put an OpenRouter API key in `.env` at the repo root (gitignored):

       OPENROUTER_API_KEY=sk-or-...

   Use a dedicated key with a spend cap — the agent runs unattended against a paid model.

2. Open this folder in VS Code and reopen it in the container: click **Reopen in Container** on
   the notification VS Code shows when it detects `.devcontainer`, or open the Command Palette
   (Cmd+Shift+P) and run **Dev Containers: Reopen in Container**. The same menu sits behind the
   `><` indicator in the bottom-left corner of the window. First build takes a few minutes:
   setup installs OpenCode and agent-browser, downloads the browser, adds the agent-browser
   skill for OpenCode, and installs the superpowers plugin (declared in `opencode.json`). The
   key is injected when the container is created, so after changing `.env`, run **Dev
   Containers: Rebuild Container** to pick it up.

   If the skill install ever needs re-running by hand:

       npx skills add vercel-labs/agent-browser -a opencode -y

3. In the container terminal, start OpenCode:

       opencode

   The model, DeepSeek V4 Flash, comes from `opencode.json` — check the status line shows it.
   To confirm superpowers is active, ask: "Tell me about your superpowers".

4. Kick it off with:

   > My business requirements are already written: REQUIREMENTS.md. Use your superpowers to
   > build it — brainstorm against that document, write the plan, then execute phase by phase.
   > Don't stop until all success criteria are met and the product is running.

   Superpowers pauses for your approval after brainstorming and again after planning; approve
   both to let the build run.

While it runs: defects appear in `DEFECTS.md`, adversarial findings in `ADVERSARIAL_REVIEW.md`,
evidence in `screenshots/`, end-to-end tests in `e2e/`. When the app starts, VS Code forwards its
port — open it in your own browser to watch and use the product.
