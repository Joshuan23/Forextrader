---
name: find-skills
description: Discover available Claude Code skills and custom commands in this project
---

List and describe every custom command available in `.claude/commands/`, then surface any relevant built-in Claude Code skills that apply to this codebase.

Steps:
1. Read all `.md` files inside `.claude/commands/` and print each skill's name, one-line description (from the YAML front-matter `description` field), and usage hint.
2. Identify which built-in Claude Code skills (e.g. `/code-review`, `/run`, `/verify`, `/security-review`) are most useful for this Forex trading project and briefly explain when to reach for each.
3. If the user passes a keyword argument (e.g. `/find-skills design`), filter the results to skills whose name or description contains that keyword.

Output a clean Markdown table with columns: **Command**, **Source**, **Description**.
