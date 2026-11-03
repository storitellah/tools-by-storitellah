# tools-by-storitellah — conventions for every project

These apply to every new tool added to this repo, and to changes to existing ones.

## Branding
- Give each tool a unique name, presented as **"<Tool> by Storitellah"**, with "Storitellah" linked to https://storitellah.com.
- **Show the tool name in what the tool renders**, not just the UI chrome: exported images, print sheets and PDFs carry a small, tasteful "<Tool> by Storitellah · storitellah.com" credit or mark. Give the user a toggle to turn it off, but default it on.

## Build chat
- Every project ships a downloadable record of the conversation it was built in:
  - `<Tool>/CHAT.md`: the user's messages verbatim, with Claude's replies and the work done summarised (no secrets, tokens or internal tool output).
  - Append a new section to `CHAT.md` for each follow-up conversation that changes the tool.
  - For standalone HTML tools, embed the chat in the page so it downloads even when the HTML file is used on its own. Add the marker block below, link `CHAT.md` with class `chat-dl`, and run `python3 Scripts/embed_chat.py <Tool>` after every edit to `CHAT.md`:
    ```html
    <!-- BUILD-CHAT:START (regenerate from CHAT.md) -->
    <script type="text/markdown" id="build-chat">
    </script>
    <!-- BUILD-CHAT:END -->
    ```
  - Link the chat from the tool's footer ("Download the build chat") and from its README.

## Housekeeping
- Add each tool as a row in the root `README.md` table.
- Each tool has its own folder with a `README.md`.
