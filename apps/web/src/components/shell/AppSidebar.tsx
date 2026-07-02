"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Users,
  MonitorPlay,
  Hash,
  ChevronRight,
  Plus,
  Menu,
  PanelLeftClose,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { ChatsNav } from "@/components/chats/ChatsNav";

/** Nav tree shape returned by GET /api/nav. */
type SpaceNode = { id: string; name: string; conversationid: string; unread: number };
type CommunityNode = { id: string; name: string; role: string; spaces: SpaceNode[] };
type ConvNode = { id: string; title: string; unread: number };
type ChannelNode = { id: string; name: string; conversations: ConvNode[] };
type NavTree = { communities: CommunityNode[]; channels: ChannelNode[] };

const POLL_MS = 20_000;

/**
 * Spec 068 shell — the collapsible accordion sidebar: Communities and Chats as
 * expandable trees (each leaf shows an unread badge) plus a Presentations link.
 * Top-level destinations (Home/Assistant/Studio) and the user avatar live in the
 * separate far-left IconRail.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSpace = searchParams.get("space");

  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["sec:communities", "sec:chats"]));
  const [tree, setTree] = useState<NavTree>({ communities: [], channels: [] });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate
    setOpen(localStorage.getItem("sidebarOpen") !== "0");
    try {
      const saved = localStorage.getItem("sidebarExpanded");
      if (saved) setExpanded(new Set(JSON.parse(saved) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  const loadTree = useCallback(async () => {
    const r = await fetch("/api/nav", { credentials: "include" });
    if (r.ok) setTree((await r.json()) as NavTree);
  }, []);

  // Reload on navigation (clears unread for what was just opened) + poll.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void loadTree();
  }, [loadTree, pathname, selectedSpace]);
  useEffect(() => {
    const t = setInterval(() => void loadTree(), POLL_MS);
    return () => clearInterval(t);
  }, [loadTree]);
  // Pages dispatch `nav:refresh` after create/join/mark-read so badges update now.
  useEffect(() => {
    const onRefresh = () => void loadTree();
    window.addEventListener("nav:refresh", onRefresh);
    return () => window.removeEventListener("nav:refresh", onRefresh);
  }, [loadTree]);

  function persistOpen(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem("sidebarOpen", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  function toggleNode(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem("sidebarExpanded", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  const isOpen = (key: string) => expanded.has(key);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => persistOpen(true)}
          aria-label="Open menu"
          className="fixed left-[68px] top-3 z-40 hidden h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted md:inline-flex"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      <aside
        className={`app-rail hidden shrink-0 overflow-hidden border-r border-border bg-card transition-[width] duration-300 ease-in-out md:flex ${
          open ? "w-64" : "w-0 border-r-0"
        }`}
      >
        <div className="flex h-full w-64 flex-col">
          <div className="flex items-center justify-between px-4 py-4">
            <Link href="/app" className="whitespace-nowrap text-lg font-bold text-foreground">
              YappChatt
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => persistOpen(false)}
                aria-label="Collapse menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
              >
                <PanelLeftClose className="h-5 w-5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
            {/* Communities accordion */}
            <SectionHeader
              label="Communities"
              icon={Users}
              open={isOpen("sec:communities")}
              onToggle={() => toggleNode("sec:communities")}
              addHref="/communities?discover=1"
              addTitle="Browse or create a community"
              active={pathname.startsWith("/communities")}
            />
            {isOpen("sec:communities") && (
              <div className="mb-1 space-y-0.5">
                {tree.communities.length === 0 && <Empty>No communities yet.</Empty>}
                {tree.communities.map((c) => (
                  <div key={c.id}>
                    <BranchRow
                      label={c.name}
                      open={isOpen(c.id)}
                      onToggle={() => toggleNode(c.id)}
                      addHref={`/communities?c=${c.id}&new=space`}
                      addTitle="New space"
                    />
                    {isOpen(c.id) && (
                      <div className="space-y-0.5">
                        {c.spaces.length === 0 && <Empty depth={3}>No spaces.</Empty>}
                        {c.spaces.map((s) => (
                          <LeafLink
                            key={s.id}
                            href={`/communities?space=${s.id}&c=${c.id}`}
                            label={s.name}
                            icon={Hash}
                            unread={s.unread}
                            active={selectedSpace === s.id}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Chats + Contacts (DM hub) */}
            <ChatsNav />

            <TopLink
              href="/presentations"
              label="Presentations"
              icon={MonitorPlay}
              active={pathname.startsWith("/presentations")}
            />
          </nav>
        </div>
      </aside>
    </>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function TopLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-lg font-bold ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionHeader({
  label,
  icon: Icon,
  open,
  onToggle,
  addHref,
  addTitle,
  active,
}: {
  label: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  addHref?: string;
  addTitle?: string;
  active: boolean;
}) {
  return (
    <div className={`group flex items-center rounded-lg ${active ? "text-foreground" : "text-muted-foreground"}`}>
      <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-lg font-bold hover:bg-muted hover:text-foreground">
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <Icon className="h-5 w-5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {addHref && (
        <Link
          href={addHref}
          title={addTitle}
          className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function BranchRow({
  label,
  open,
  onToggle,
  addHref,
  addTitle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  addHref?: string;
  addTitle?: string;
}) {
  return (
    <div className="group flex items-center">
      <button
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1.5 pl-5 pr-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="truncate font-medium">{label}</span>
      </button>
      {addHref && (
        <Link
          href={addHref}
          title={addTitle}
          className="mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          <Plus className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function LeafLink({
  href,
  label,
  icon: Icon,
  unread,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  unread: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-lg py-1.5 pl-9 pr-2 text-sm ${
        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {unread > 0 && (
        <span className="ml-1 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

function Empty({ children, depth = 2 }: { children: React.ReactNode; depth?: number }) {
  return <p className={`py-1.5 ${depth >= 3 ? "pl-9" : "pl-8"} pr-2 text-xs text-muted-foreground`}>{children}</p>;
}
