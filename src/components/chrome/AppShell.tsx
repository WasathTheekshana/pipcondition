import type { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { Footer } from "./Footer";

export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <TopNav />
      <main className="min-h-0 flex-1 overflow-auto" style={{ background: "var(--pc-canvas-bg)" }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
