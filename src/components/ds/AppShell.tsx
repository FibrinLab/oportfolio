"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./AppShell.module.css";

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  tenantName,
  roleLabel,
  navItems,
  accountHref,
  children,
}: {
  tenantName: string;
  roleLabel: string;
  navItems: NavItem[];
  accountHref: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className={styles.rail}>
        <div className={styles.brand}>
          <span>oPortfolio</span>
          <button
            type="button"
            className={styles.menuToggle}
            aria-expanded={menuOpen}
            aria-controls="shell-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
        </div>
        <p className={styles.context}>
          {tenantName} / {roleLabel}
        </p>
        <nav id="shell-nav" className={styles.nav} aria-label="Primary" data-open={menuOpen}>
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
          <Link href={accountHref} className={styles.navLink}>
            Account
          </Link>
        </nav>
      </header>
      <main id="main-content" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
