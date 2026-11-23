"""Pagina's ophalen met een echte Chromium (Playwright), één voor één.

Bewust géén stealth-trucs of captcha-omzeiling: een gewone browser vanaf je thuisverbinding,
weinig verzoeken per dag. Wordt een winkel toch geblokkeerd, dan meldt de add-on dat.
"""
from __future__ import annotations

import logging

from playwright.sync_api import Browser, sync_playwright

log = logging.getLogger("browser")

# Elementen die vaak een actielabel bevatten. Documentvolgorde; de hoofdproductinfo staat
# meestal vóór carrousels met andere producten.
LABEL_SELECTOR = ",".join(
    [
        '[class*="promo" i]',
        '[class*="shield" i]',
        '[class*="sticker" i]',
        '[class*="badge" i]',
        '[class*="discount" i]',
        '[class*="korting" i]',
        '[class*="actie" i]',
        '[class*="deal" i]',
        '[data-testhook*="shield" i]',
        '[data-testhook*="promo" i]',
        '[data-testid*="promo" i]',
        '[data-test*="promo" i]',
    ]
)

JS_LABELS = """(sel) => {
  const main = document.querySelector('main') || document.body;
  const out = [];
  for (const el of main.querySelectorAll(sel)) {
    const t = (el.innerText || '').trim();
    if (t && t.length <= 120) out.push(t);
    if (out.length >= 60) break;
  }
  return out;
}"""


class Browser_:
    def __init__(self):
        self._pw = sync_playwright().start()
        self.browser: Browser = self._pw.chromium.launch(
            headless=True, args=["--disable-dev-shm-usage", "--no-sandbox"]
        )

    def haal(self, url: str) -> tuple[int | None, str, list[str]]:
        ctx = self.browser.new_context(
            locale="nl-NL",
            timezone_id="Europe/Amsterdam",
            viewport={"width": 1366, "height": 900},
        )
        try:
            page = ctx.new_page()
            resp = page.goto(url, wait_until="domcontentloaded", timeout=45000)
            try:
                page.wait_for_load_state("networkidle", timeout=12000)
            except Exception:  # sommige sites blijven trackers laden
                pass
            status = resp.status if resp else None
            doc = page.content()
            try:
                labels = page.evaluate(JS_LABELS, LABEL_SELECTOR)
            except Exception:
                labels = []
            return status, doc, labels
        finally:
            ctx.close()

    def sluit(self):
        try:
            self.browser.close()
        finally:
            self._pw.stop()
