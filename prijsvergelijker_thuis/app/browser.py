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
            self.laatste_url = page.url  # na redirects (Jumbo: SKU kan wijzigen)
            doc = page.content()
            try:
                labels = page.evaluate(JS_LABELS, LABEL_SELECTOR)
            except Exception:
                labels = []
            return status, doc, labels
        finally:
            ctx.close()

    # ---- gedeelde context (cookies blijven bewaard), bv. voor Folderz: de JavaScript-check
    # wordt één keer door de browser uitgevoerd en daarna geldt het cookie voor de volgende pagina's.
    _ctx = None
    laatste_url: str | None = None

    def _pagina(self, url: str):
        if self._ctx is None:
            self._ctx = self.browser.new_context(locale="nl-NL", timezone_id="Europe/Amsterdam", viewport={"width": 1366, "height": 900})
        page = self._ctx.new_page()
        resp = page.goto(url, wait_until="domcontentloaded", timeout=45000)
        # Wacht tot de JS-check klaar is en de echte pagina geladen is (titel niet leeg).
        try:
            page.wait_for_function("document.title && document.title.length > 0", timeout=25000)
        except Exception:
            pass
        try:
            page.wait_for_load_state("networkidle", timeout=12000)
        except Exception:
            pass
        return page, resp

    def links(self, url: str, js: str) -> list[dict]:
        page, _ = self._pagina(url)
        try:
            for _ in range(4):  # lazy loading: een paar keer scrollen
                page.mouse.wheel(0, 2500)
                page.wait_for_timeout(800)
            return page.evaluate(js)
        finally:
            page.close()

    def pagina_info(self, url: str, js: str) -> tuple[int | None, str, dict]:
        page, resp = self._pagina(url)
        try:
            # na de JS-check is de eerste response de challenge (202); de status van de echte pagina
            # is dan onbekend -> None
            status = resp.status if resp and resp.status != 202 else None
            return status, page.content(), page.evaluate(js)
        finally:
            page.close()

    def sluit(self):
        try:
            if self._ctx is not None:
                self._ctx.close()
            self.browser.close()
        finally:
            self._pw.stop()
