import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "@/lib/fontawesome";
import { TopBar } from "@/components/TopBar";
import { WorkspaceProvider } from "@/components/WorkspaceContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "course-chain",
  description: "Create and open course-chain projects.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      {/* Lock the app to the viewport; inner regions do their own scrolling. */}
      <body className="flex h-full flex-col overflow-hidden bg-white text-gray-900">
        <WorkspaceProvider>
          {/* Global top bar */}
          <TopBar />

          {/* Active page */}
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
