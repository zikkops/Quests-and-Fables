import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Builder from "@/components/builder/Builder";

export const metadata: Metadata = {
  title: "Character builder",
  description:
    "A free 5e character builder. Every official SRD class, species, lineage, "
    + "background and feat, with your skills, saves and spell slots worked out as "
    + "you go. No account needed to start.",
};

export default function CharacterBuilderPage() {
  return (
    <>
      <Nav />
      <main>
        <Builder />
      </main>
      <Footer />
    </>
  );
}
