import type { Metadata } from "next";
import AccountShell from "@/components/account/AccountShell";
import OpenTables from "@/components/parties/OpenTables";
import AreaPanel from "@/components/AreaPanel";
import { findArea } from "@/data/lebanon";

export const metadata: Metadata = {
  title: "Find a party",
  description:
    "Open tables of four to six players, put together from people whose evenings "
    + "and areas actually overlap, then matched with a game master. In person, "
    + "across Lebanon.",
};

/**
 * The tables that are open, and the area a visitor arrived asking about.
 *
 * `searchParams` is a promise in this version of Next, so the page is async.
 * Reading it makes this route dynamic rather than static, which is the right
 * trade: the area picked on the homepage is the whole point of the redirect,
 * and echoing it back is what proves the picker did something.
 *
 * The list below it is client-side, because what a visitor may see depends
 * entirely on who they are — see `OpenTables` and `src/lib/match.ts`.
 */
export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).area;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  const found = findArea(slug);

  return (
    <AccountShell
      eyebrow={found ? `Tables near ${found.area.name}` : "Find a party"}
      title="Four to six players, and a game master who fits."
      lede={
        "A party is four players minimum and six maximum, never more. Below four it "
        + "cannot be given a game master; at six it closes. The game master is not "
        + "one of the six, so a table is five to seven people in a room."
      }
    >
      {found ? (
        <AreaPanel
          area={{
            name: found.area.name,
            governorate: found.governorate.name,
            live: Boolean(found.area.live),
          }}
        />
      ) : null}
      <OpenTables area={found?.area.slug} />
    </AccountShell>
  );
}
