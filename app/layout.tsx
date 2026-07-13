import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Knowledge Base",
  description: "AI-powered project knowledge management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-8 h-14 flex items-center gap-6">
            <span className="font-bold text-gray-900 text-sm">📚 Knowledge Base</span>
            <div className="flex gap-1 ml-2">
              <NavLink href="/">Upload</NavLink>
              <NavLink href="/knowledge">Knowledge Base</NavLink>
              <NavLink href="/modules">Modules</NavLink>
              <NavLink href="/timeline">Timeline</NavLink>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      {children}
    </Link>
  );
}
