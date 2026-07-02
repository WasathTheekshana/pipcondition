"use client";

import Link from "next/link";
import { Heart16Filled } from "@fluentui/react-icons";

export function Footer() {
  return (
    <footer className="flex shrink-0 items-center justify-center gap-1 border-t px-4 py-3 text-xs" style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-secondary)" }}>
      <span>Built with</span>
      <Heart16Filled style={{ color: "var(--pc-failed)" }} />
      <span>by</span>
      <a href="https://github.com/WasathTheekshana" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: "var(--pc-text)" }}>
        Wasath Theekshana
      </a>
      <span className="mx-1">&middot;</span>
      <a href="https://github.com/WasathTheekshana/pipcondition" target="_blank" rel="noopener noreferrer" className="underline">
        Source on GitHub
      </a>
      <span className="mx-1">&middot;</span>
      <Link href="/about" className="underline">
        About
      </Link>
    </footer>
  );
}
