"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bot, Wrench, Shield, Users, Check, MessageCircle, type LucideIcon } from "lucide-react";
import { isSystemStaff, type OrgSummary, type SessionUser } from "@/lib/auth/shared";

/**
 * Far-left icon rail (spec 068 shell): top-level destinations (Home, Assistant,
 * Studio, + Admin for staff) and, at the bottom, the user avatar. Right-click
 * (or click) the avatar for a menu to edit the profile or sign out. Always
 * visible — independent of the collapsible accordion sidebar beside it.
 */

type RailItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export function IconRail({
  user,
  org,
  orgs,
  avatarSrc,
}: {
  user: SessionUser;
  org: OrgSummary | null;
  orgs: OrgSummary[];
  avatarSrc: string | null;
}) {
  const pathname = usePathname();
  const initial = (user.displayname.trim()[0] || "?").toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const items: RailItem[] = [
    { href: "/app", label: "Home", icon: Home, exact: true },
    { href: "/chats", label: "Chats", icon: MessageCircle },
    { href: "/assistant", label: "Assistant", icon: Bot },
    { href: "/studio", label: "Studio", icon: Wrench },
  ];
  // Corporate orgs: every member sees Members (a company directory); owners/admins
  // additionally get the invite/remove/role controls there.
  if (org?.plantype === "corporate") {
    items.push({ href: "/members", label: "Members", icon: Users });
  }
  if (isSystemStaff(user)) items.push({ href: "/admin", label: "Admin", icon: Shield });

  const active = (it: RailItem) => (it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`));

  // Close the avatar menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.assign("/");
  }

  async function switchOrg(orgid: string) {
    if (org && orgid === org.id) {
      setMenuOpen(false);
      return;
    }
    await fetch("/api/orgs/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ orgid }),
    });
    window.location.assign("/app"); // full reload so server components re-read the active org
  }

  return (
    <div className="hidden w-14 shrink-0 flex-col items-center border-r border-border bg-card py-3 md:flex">
      <nav className="flex flex-1 flex-col items-center gap-1">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              aria-label={it.label}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                active(it)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          title={`${user.displayname} — right-click for options`}
          aria-label="Account menu"
          onClick={() => setMenuOpen((v) => !v)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen(true);
          }}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-muted hover:ring-2 hover:ring-primary/40"
        >
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned/preset avatar URL
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-muted-foreground">{initial}</span>
          )}
        </button>

        {menuOpen && (
          // Open ABOVE the avatar (bottom-full + mb) so the lower items aren't
          // clipped by the viewport edge / OS taskbar at the bottom of the rail.
          <div className="absolute bottom-full left-0 z-50 mb-2 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <div className="border-b border-border px-3 py-2">
              <div className="truncate text-sm font-semibold text-foreground">{user.displayname}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
            {orgs.length > 1 && (
              <div className="border-b border-border py-1">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Workspaces
                </div>
                {orgs.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => switchOrg(o.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                  >
                    <span className="truncate">{o.name}</span>
                    {org?.id === o.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            )}
            <Link
              href="/app"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              Edit profile
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="block w-full px-3 py-2 text-left text-sm font-semibold text-destructive hover:bg-muted"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
