import Link from "next/link";

/** Shared presentational shell for the auth forms. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-xl font-bold text-primary">
            YappChatt
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          {children}
        </div>
        {footer ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}

export const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const labelClass = "mb-1.5 block text-sm font-medium text-foreground";
export const primaryBtnClass =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";
export const errorClass =
  "rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400";
