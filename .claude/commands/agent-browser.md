---
name: agent-browser
description: Browse the web to research Forex markets, news, economic data, or competitor tools
---

Use Playwright (pre-installed at `/opt/pw-browsers/chromium`) to open a headless browser and retrieve information from the web.

Usage: `/agent-browser <url-or-topic>`

Steps:
1. If $ARGUMENTS is a URL, navigate directly to it and return the page's readable text content.
2. If $ARGUMENTS is a topic (e.g. "EUR/USD outlook this week", "FOMC minutes", "COT report release schedule"), search for it and summarise the top results.
3. For Forex-specific research tasks, also check: Forex Factory calendar, DailyFX analysis, Investing.com, and official central-bank press-release pages as appropriate.
4. Return a concise summary (≤400 words) with the key facts and source URLs.

Constraints:
- Never log in to any site or submit forms without explicit user confirmation.
- Do not store cookies or credentials between runs.
- Respect `robots.txt`; skip pages that disallow crawling.
