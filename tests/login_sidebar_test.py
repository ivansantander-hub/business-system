"""
One-off test: Login flow and sidebar visibility at http://localhost:3099
Captures screenshots and reports results.
"""

from pathlib import Path

from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3099"
SCREENSHOT_DIR = Path(__file__).parent / "screenshots"


def main():
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    final_url = ""
    link_texts = []
    sidebar_visible = False
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Capture console errors
        def on_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)

        page.on("console", on_console)

        print("1. Navigating to http://localhost:3099/login")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")

        print("2. Taking screenshot of login page")
        page.screenshot(path=SCREENSHOT_DIR / "01_login_page.png", full_page=True)

        print("3. Filling email: admin@miempresa.com")
        page.fill('input[type="email"]', "admin@miempresa.com")

        print("4. Filling password: admin123")
        page.fill('input[type="password"]', "admin123")

        print("5. Clicking login/submit button")
        page.click('button[type="submit"]')

        print("6. Waiting for navigation to /dashboard (up to 15 seconds)")
        try:
            page.wait_for_url("**/dashboard**", timeout=15000)
        except Exception:
            page.wait_for_timeout(5000)

        print("7. Taking screenshot of dashboard page")
        page.screenshot(path=SCREENSHOT_DIR / "02_dashboard_page.png", full_page=True)

        # Check sidebar visibility
        nav_links = page.locator("nav a, aside a, [role='navigation'] a")
        link_texts = []
        for i in range(nav_links.count()):
            t = nav_links.nth(i).text_content()
            if t and t.strip():
                link_texts.append(t.strip())

        # Also check for common sidebar text
        body_text = page.text_content("body") or ""
        sidebar_visible = (
            "Dashboard" in body_text
            or "Productos" in body_text
            or "Facturas" in body_text
            or "Punto de Venta" in body_text
            or "POS" in body_text
        )

        final_url = page.url
        browser.close()

    # Report
    print("\n" + "=" * 60)
    print("REPORT")
    print("=" * 60)
    print(f"Login succeeded: {'Yes' if '/dashboard' in final_url else 'No'}")
    print(f"URL after login: {final_url}")
    print(f"Sidebar visible: {'Yes' if sidebar_visible else 'No'}")
    print(f"Menu items found: {link_texts if link_texts else '(none)'}")
    if console_errors:
        print(f"Console errors: {console_errors}")
    else:
        print("Console errors: None")
    print(f"\nScreenshots saved to: {SCREENSHOT_DIR}")
    print("  - 01_login_page.png")
    print("  - 02_dashboard_page.png")


if __name__ == "__main__":
    main()
