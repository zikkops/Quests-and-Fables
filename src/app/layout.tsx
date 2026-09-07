import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/firebase/session";
import EmulatorBadge from "@/components/EmulatorBadge";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

// House style: "Quests & Fables" in product and marketing, "Quests and Fables"
// spoken and in alt text. See Naming.md: pick one written form, use it always.
export const metadata: Metadata = {
  title: {
    default: "Quests & Fables: find a D&D group in Lebanon and build a character",
    template: "%s | Quests & Fables",
  },
  description:
    "The part that happens before the tabletop. Find a party of four to six, get a "
    + "game master, and play in person on the Lebanese coast from Beirut to Jbeil. "
    + "Free 5e SRD character builder, no account needed.",
  applicationName: "Quests & Fables",
  metadataBase: new URL("https://questsandfables.com"),
  openGraph: {
    title: "Quests & Fables",
    description:
      "Find a group, get a game master, play in person from Beirut to Jbeil. Free character builder, no account needed.",
    url: "https://questsandfables.com",
    siteName: "Quests & Fables",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#12100f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${cinzel.variable}`}>
      <body>
        {/* Who is signed in, read once and shared. Costs nothing when
            Firebase is unconfigured: the provider answers "nobody" and stops. */}
        <SessionProvider>{children}</SessionProvider>
        <EmulatorBadge />
      </body>
    </html>
  );
}
