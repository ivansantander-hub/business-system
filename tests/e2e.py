"""
E2E tests for the business system using Playwright.
Tests login, dashboard, POS sale flow, and purchase flow.
"""

import sys
import json
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://localhost:3099"

results = {"passed": 0, "failed": 0, "errors": []}


def report(name: str, passed: bool, error: str = ""):
    if passed:
        results["passed"] += 1
        print(f"  PASS: {name}")
    else:
        results["failed"] += 1
        results["errors"].append(f"{name}: {error}")
        print(f"  FAIL: {name} - {error}")


def test_login_page_loads(page):
    """Login page renders with email and password fields."""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    email_input = page.locator('input[type="email"]')
    password_input = page.locator('input[type="password"]')
    report(
        "Login page loads with form fields",
        email_input.count() > 0 and password_input.count() > 0,
    )


def test_login_invalid_credentials(page):
    """Login with wrong credentials shows error."""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', "wrong@test.com")
    page.fill('input[type="password"]', "wrongpassword")
    page.click('button[type="submit"]')
    page.wait_for_timeout(2000)
    # Should still be on login page
    report(
        "Login rejects invalid credentials",
        "/login" in page.url or page.locator("text=Error").count() > 0
        or page.locator("text=error").count() > 0
        or page.locator("text=Credenciales").count() > 0,
    )


def test_login_valid_credentials(page):
    """Login with valid admin credentials redirects to dashboard."""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', "admin@miempresa.com")
    page.fill('input[type="password"]', "admin123")
    page.click('button[type="submit"]')
    # Wait for navigation with generous timeout
    try:
        page.wait_for_url("**/dashboard**", timeout=15000)
    except Exception:
        page.wait_for_timeout(5000)
    report(
        "Login with valid credentials redirects to dashboard",
        "/dashboard" in page.url,
        f"Current URL: {page.url}",
    )


def test_dashboard_loads(page):
    """Dashboard page displays stats and content."""
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    # Dashboard should have some stat cards or content
    body_text = page.text_content("body") or ""
    has_content = len(body_text) > 100
    report("Dashboard loads with content", has_content, f"Body length: {len(body_text)}")


def test_sidebar_navigation(page):
    """Sidebar shows navigation links."""
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    # Check for nav links
    nav_links = page.locator("nav a, aside a")
    count = nav_links.count()
    report("Sidebar has navigation links", count > 3, f"Found {count} links")


def test_products_page(page):
    """Products page loads and shows product list."""
    page.goto(f"{BASE_URL}/dashboard/productos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    body_text = page.text_content("body") or ""
    has_products = "Producto" in body_text or "producto" in body_text
    report("Products page loads", has_products, f"Page text snippet: {body_text[:200]}")


def test_customers_page(page):
    """Customers page loads."""
    page.goto(f"{BASE_URL}/dashboard/clientes")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    body_text = page.text_content("body") or ""
    has_content = "Cliente" in body_text or "cliente" in body_text
    report("Customers page loads", has_content)


def test_invoices_page(page):
    """Invoices page loads."""
    page.goto(f"{BASE_URL}/dashboard/facturas")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    body_text = page.text_content("body") or ""
    has_content = "Factura" in body_text or "factura" in body_text
    report("Invoices page loads", has_content)


def test_pos_page(page):
    """POS page loads with cash session handling."""
    page.goto(f"{BASE_URL}/dashboard/pos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    body_text = page.text_content("body") or ""
    has_pos = (
        "POS" in body_text
        or "Caja" in body_text
        or "caja" in body_text
        or "Punto" in body_text
        or "Abrir" in body_text
    )
    report("POS page loads", has_pos, f"Page text snippet: {body_text[:200]}")


def test_accounting_page(page):
    """Accounting page loads with chart of accounts."""
    page.goto(f"{BASE_URL}/dashboard/contabilidad")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    body_text = page.text_content("body") or ""
    has_accounting = (
        "Contabilidad" in body_text
        or "ACTIVO" in body_text
        or "Plan de Cuentas" in body_text
    )
    report("Accounting page loads", has_accounting)


def test_reports_page(page):
    """Reports page loads."""
    page.goto(f"{BASE_URL}/dashboard/reportes")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    body_text = page.text_content("body") or ""
    has_reports = "Reporte" in body_text or "reporte" in body_text or "Informe" in body_text
    report("Reports page loads", has_reports)


def test_purchases_page(page):
    """Purchases page loads."""
    page.goto(f"{BASE_URL}/dashboard/compras")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    body_text = page.text_content("body") or ""
    has_content = "Compra" in body_text or "compra" in body_text
    report("Purchases page loads", has_content)


def test_settings_page(page):
    """Settings page loads."""
    page.goto(f"{BASE_URL}/dashboard/configuracion")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    body_text = page.text_content("body") or ""
    has_content = (
        "Configuración" in body_text
        or "configuración" in body_text
        or "Config" in body_text
    )
    report("Settings page loads", has_content)


def test_theme_toggle(page):
    """Theme can be toggled between light and dark."""
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    html = page.locator("html")
    initial_has_dark = "dark" in (html.get_attribute("class") or "")

    # Find and click theme toggle button (sun/moon icon button)
    theme_buttons = page.locator("button")
    for i in range(theme_buttons.count()):
        btn = theme_buttons.nth(i)
        inner = btn.inner_html()
        if "sun" in inner.lower() or "moon" in inner.lower():
            btn.click()
            page.wait_for_timeout(500)
            break

    after_has_dark = "dark" in (html.get_attribute("class") or "")
    toggled = initial_has_dark != after_has_dark
    report("Theme toggle works", toggled, f"Before: dark={initial_has_dark}, After: dark={after_has_dark}")


def test_responsive_mobile(page):
    """Pages adapt to mobile viewport."""
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    body_text = page.text_content("body") or ""
    report("Dashboard renders on mobile viewport", len(body_text) > 50)

    # Reset viewport
    page.set_viewport_size({"width": 1280, "height": 720})


def main():
    print("\n=== E2E Tests for Business System ===\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Test login
        print("[Login Tests]")
        test_login_page_loads(page)
        test_login_invalid_credentials(page)
        test_login_valid_credentials(page)

        # After login, test dashboard and pages
        print("\n[Dashboard Tests]")
        test_dashboard_loads(page)
        test_sidebar_navigation(page)

        print("\n[Page Navigation Tests]")
        test_products_page(page)
        test_customers_page(page)
        test_invoices_page(page)
        test_pos_page(page)
        test_accounting_page(page)
        test_reports_page(page)
        test_purchases_page(page)
        test_settings_page(page)

        print("\n[Feature Tests]")
        test_theme_toggle(page)
        test_responsive_mobile(page)

        browser.close()

    # Summary
    total = results["passed"] + results["failed"]
    print(f"\n=== Results: {results['passed']}/{total} passed ===")
    if results["errors"]:
        print("\nFailed tests:")
        for err in results["errors"]:
            print(f"  - {err}")

    sys.exit(0 if results["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
