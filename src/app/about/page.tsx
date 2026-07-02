import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/chrome/Logo";
import { GitHubIcon, LinkedInIcon, GlobeIcon, ArrowLeftIcon } from "@/components/chrome/BrandIcons";

export const metadata: Metadata = {
  title: "About - pipcondition",
};

const REPO = "WasathTheekshana/pipcondition";

const PROFILE_LINKS = [
  { label: "Website", href: "https://wasath.site", Icon: GlobeIcon },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/wasatht/", Icon: LinkedInIcon },
  { label: "GitHub", href: "https://github.com/WasathTheekshana", Icon: GitHubIcon },
];

const REPO_BADGES = [
  { alt: "Stars", src: `https://img.shields.io/github/stars/${REPO}?style=flat-square&labelColor=171717&color=2563eb` },
  { alt: "Forks", src: `https://img.shields.io/github/forks/${REPO}?style=flat-square&labelColor=171717&color=2563eb` },
  { alt: "Open issues", src: `https://img.shields.io/github/issues/${REPO}?style=flat-square&labelColor=171717&color=d97706` },
  { alt: "License", src: `https://img.shields.io/github/license/${REPO}?style=flat-square&labelColor=171717&color=16a34a` },
  { alt: "Last commit", src: `https://img.shields.io/github/last-commit/${REPO}?style=flat-square&labelColor=171717&color=7c3aed` },
];

function SectionCard({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="rounded-xl border p-6" style={{ borderColor: "var(--pc-border)", background: "var(--pc-card-bg)" }}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/" className="flex items-center gap-1 text-sm underline" style={{ color: "var(--pc-text-secondary)" }}>
        <ArrowLeftIcon />
        Back to app
      </Link>

      <div className="flex items-center gap-3">
        <Logo size={40} />
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--pc-text)" }}>
            pipcondition
          </h1>
          <p className="text-sm" style={{ color: "var(--pc-text-secondary)" }}>
            Azure Pipeline Condition Simulator
          </p>
        </div>
      </div>

      <SectionCard title="About the project">
        <p className="text-sm leading-relaxed" style={{ color: "var(--pc-text)" }}>
          pipcondition is an open-source simulator for Azure Pipelines YAML <code>condition:</code> expressions and{" "}
          <code>dependsOn</code> graphs. Paste or drop a real <code>azure-pipelines.yml</code> (with its referenced templates),
          assign mock outcomes to stages/jobs/steps, and see exactly what would run, skip, or fail - without pushing a real
          change through Azure DevOps and collecting approvals just to find out whether a condition tweak actually works.
          Nothing executes; it&apos;s a dry-run evaluator built on Azure&apos;s own expression engine semantics.
        </p>
      </SectionCard>

      <SectionCard title="Repo stats">
        <div className="flex flex-wrap items-center gap-2">
          {REPO_BADGES.map((badge) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={badge.alt} src={badge.src} alt={badge.alt} height={20} />
          ))}
        </div>
        <a
          href={`https://github.com/${REPO}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm underline"
          style={{ color: "var(--pc-accent)" }}
        >
          <GitHubIcon size={16} />
          View source on GitHub
        </a>
      </SectionCard>

      <SectionCard title="About me">
        <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--pc-text)" }}>
          Hi, I&apos;m Wasath Theekshana - a DevOps engineer by day and an open-source contributor by night, working
          professionally with Azure cloud and Kubernetes. I built pipcondition to stop burning PR approvals just to test
          whether an Azure Pipelines condition does what I think it does. I build small, focused open-source tools like this
          one - find more of my work below.
        </p>
        <div className="flex flex-wrap gap-2">
          {PROFILE_LINKS.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
              style={{ borderColor: "var(--pc-border)", color: "var(--pc-text)" }}
            >
              <Icon size={16} />
              {label}
            </a>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Support">
        <p className="mb-3 text-sm" style={{ color: "var(--pc-text-secondary)" }}>
          If pipcondition saved you a few PR approval cycles, consider buying me a coffee.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="https://buymeacoffee.com/wasath" target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black"
              alt="Buy Me A Coffee"
              height={32}
            />
          </a>
          <a href="https://ko-fi.com/wasath" target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://img.shields.io/badge/Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Ko-fi" height={32} />
          </a>
        </div>
      </SectionCard>
    </div>
  );
}
