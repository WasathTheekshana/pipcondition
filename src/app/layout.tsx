import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/chrome/AppShell";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "pipcondition // Pipeline Condition Simulator",
  description: "Local simulator for Azure Pipelines conditions and dependsOn graphs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: some browser/antivirus extensions (e.g. Bitdefender) inject a bis_skin_checked attribute into the DOM before React hydrates, which otherwise triggers a false-positive hydration mismatch warning unrelated to app code. */}
      <body className="h-full" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
