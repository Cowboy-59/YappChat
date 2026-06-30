import type { Metadata } from "next";
import { Open_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// Stack.md typography: Open Sans (sans). Mono kept for incidental code/monospace.
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Baseline metadata; the landing page overrides via generateMetadata (T005).
export const metadata: Metadata = {
  title: "YappChatt",
  description: "Your private, unified AI chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/*
         * Resolve the theme BEFORE first paint to avoid a flash: use the stored
         * choice, else the OS preference. Sets data-theme on <html>, which the
         * token CSS in globals.css keys off. Must be inline + synchronous.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
