import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Settle",
  description:
    "Milestone payment protection for freelancers and clients: PayPal authorize and capture, AI review, AI mediation.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      data-theme={theme}
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen overflow-x-clip">
        {children}
        <Toaster
          position="bottom-center"
          duration={3200}
          theme={theme}
          style={
            {
              "--normal-bg": "var(--glass)",
              "--normal-text": "var(--text)",
              "--normal-border": "var(--line2)",
              "--border-radius": "12px",
            } as React.CSSProperties
          }
          toastOptions={{ classNames: { toast: "backdrop-blur-[16px] !shadow-card !text-[13.5px] !font-medium" } }}
        />
      </body>
    </html>
  );
}
