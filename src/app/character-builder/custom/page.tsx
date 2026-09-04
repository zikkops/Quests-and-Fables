import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CustomForm from "@/components/builder/CustomForm";

export const metadata: Metadata = {
  title: "Custom character sheet",
  description:
    "A blank sheet you fill in yourself: hit points, armour class, speed, "
    + "skills, spell slots and resources. For homebrew, or for a character from a "
    + "book you already own.",
};

/**
 * Copy rule, not a preference: this page never invites anyone to copy a book in.
 * It is a blank sheet, the user types their own numbers, and that is the entire
 * legal position. See Legal & Compliance, "Custom character sheets": no dropdown
 * of non-SRD options, no seeded autocomplete, no import.
 */
export default function CustomCharacterPage() {
  return (
    <>
      <Nav />
      <main>
        <CustomForm />
      </main>
      <Footer />
    </>
  );
}
