import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import WherePlay from "@/components/WherePlay";
import Banner from "@/components/Banner";
import Tavern from "@/components/Tavern";
import HowItWorks from "@/components/HowItWorks";
import AtTheTable from "@/components/AtTheTable";
import Footer from "@/components/Footer";
import { CHARACTER, SAFETY } from "@/data/banners";

/**
 * Section order matters. The hero asks one question, and everything below it
 * sits under that question rather than competing with it.
 *
 * Every section ends in a link to the feature it describes, so the homepage
 * doubles as the map of what is built and what is still a stub.
 *
 * The tavern sits between the two literal sections on purpose. Where you play
 * is the concrete answer (Beirut to Jbeil), the journey is the mechanical one,
 * and the fable goes between them: the same promise told as a room before it is
 * told as a line with stops on it.
 *
 * **The two banners are interruptions, not sections.** Safety and the character
 * builder used to be full sections at the end, which is the worst place for
 * either: a free builder and a safety stance want to be run into on the way
 * past, not scrolled to. Each one now sits next to the thing it argues with.
 * Safety goes under the map, where the reader has just been told they will meet
 * strangers somewhere real. The builder goes under the journey, where it was
 * just described as the thing you can do before you have a party at all.
 */
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <WherePlay />
        <Banner banner={SAFETY} />
        <Tavern />
        <HowItWorks />
        <Banner banner={CHARACTER} />
        <AtTheTable />
      </main>
      <Footer />
    </>
  );
}
