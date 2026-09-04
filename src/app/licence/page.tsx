import type { Metadata } from "next";
import StubPage from "@/components/StubPage";

/**
 * Licence and credits: the page the attribution can live on.
 *
 * ⚠️ **This page existing does not make the footer credit optional.** CC BY 4.0
 * lets the required notice be given "in any reasonable manner based on the
 * medium, means, and context", and explicitly allows satisfying it with a link
 * to a resource that carries the information. So a short credit in the footer
 * pointing here is a defensible reading of the licence. A footer with no credit
 * and no link is not, and neither is a page that is hard to reach from where
 * the SRD content actually is.
 *
 * If the footer is ever trimmed to a one-line credit, that line has to link
 * here, and this page has to keep the notice **verbatim**. README rule 1 is the
 * rule this page serves, not the rule it replaces.
 *
 * ⚠️ Verify the exact wording against the SRD 5.2.1 PDF before launch.
 *
 * The "what we changed" step is not padding: CC BY 4.0 § 3(a)(1)(B) requires
 * indicating that the material was modified. It was. `srd-5.2.1-content.json`
 * holds SRD facts (hit dice, saves, spell levels, skill lists) alongside `blurb`
 * and `meta` strings that are our own writing, not SRD prose, which is a good
 * position to be in and worth keeping: the further the shipped text is from
 * reproducing the document, the less any of this rests on the licence alone.
 */
export const metadata: Metadata = {
  title: "Licence and credits",
  description:
    "Quests & Fables is built on the System Reference Document 5.2.1 by Wizards "
    + "of the Coast, used under CC BY 4.0. The full attribution, what the licence "
    + "covers, and what is ours rather than theirs.",
};

export default function LicencePage() {
  return (
    <StubPage
      eyebrow="Licence and credits"
      title="Built on the SRD, and saying so properly."
      lede={
        "Every class, species, background, feat and spell in the character builder comes "
        + "from a document Wizards of the Coast published under a licence that asks for "
        + "one thing in return: credit. This is that credit, in full, in the wording the "
        + "licence asks for."
      }
      stepsHeading="The details"
      steps={[
        {
          title: "The required attribution",
          body:
            "This work includes material from the System Reference Document 5.2.1 (“SRD "
            + "5.2.1”) by Wizards of the Coast LLC, available at "
            + "https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative "
            + "Commons Attribution 4.0 International License, available at "
            + "https://creativecommons.org/licenses/by/4.0/legalcode.",
        },
        {
          title: "What we changed",
          body:
            "CC BY 4.0 asks that changes be indicated, so: the SRD material has been "
            + "reorganised into structured data for the builder to work from, and the "
            + "sentence explaining each class, species and spell was written by us rather "
            + "than taken from the document. No rule, number or name has been altered. "
            + "Where the SRD says a barbarian has a d12 hit die, so do we.",
        },
        {
          title: "What the licence allows",
          body:
            "CC BY 4.0 is irrevocable. It lets anyone use, adapt and build on the material, "
            + "including commercially, so long as credit is given and any changes are noted. "
            + "It is the reason a free character builder can exist here at all, and it is "
            + "not a licence anybody can take back later.",
        },
        {
          title: "SRD 5.2.1 only, and nothing scraped",
          body:
            "The builder ships the SRD and no more: one subclass per class, because that is "
            + "what the document contains. No 2024 Player's Handbook content, nothing from "
            + "wikis, nothing from other people's datasets. Every content row carries its "
            + "source and its licence, so any question about where something came from is "
            + "answerable in one query.",
        },
        {
          title: "What is ours rather than theirs",
          body:
            "The writing on this site, the tavern artwork, the matching, the tracker and "
            + "the campaign notebook are ours. A blank custom sheet is yours: what you type "
            + "into one is your content, it stays private to your character, and we neither "
            + "supply nor distribute anything to fill it with.",
        },
        {
          title: "Not affiliated with Wizards of the Coast",
          body:
            "Quests & Fables is not affiliated with, endorsed by, or sponsored by Wizards "
            + "of the Coast. Dungeons & Dragons and D&D are their trademarks. Using the SRD "
            + "under CC BY 4.0 is not a partnership and we do not claim one.",
        },
        {
          title: "Sessions and money",
          body:
            "Sessions are paid, and they are settled between players and their game master "
            + "directly, in cash or over Whish. Quests & Fables never handles the money, "
            + "never holds it, and never takes a cut. There is no payment processor in this "
            + "product and there is not meant to be one.",
        },
      ]}
      note={{
        title: "Found something that looks wrong",
        body:
          "If any content here appears to come from somewhere it should not, write to us "
          + "and it comes down while we check. That is easier for everyone than the "
          + "alternative, and it is why every row carries its source in the first place.",
      }}
      actions={[
        { href: "https://www.dndbeyond.com/srd", label: "The SRD", primary: true },
        {
          href: "https://creativecommons.org/licenses/by/4.0/legalcode",
          label: "CC BY 4.0 in full",
        },
        { href: "/character-builder", label: "Open the builder" },
      ]}
    />
  );
}
