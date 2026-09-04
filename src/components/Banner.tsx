import Link from "next/link";
import type { Banner as BannerCopy } from "@/data/banners";
import styles from "./Banner.module.css";

/**
 * A strip between two sections: one claim, one line of evidence, one way in.
 *
 * It is an `aside` rather than a `section` on purpose. A banner is beside the
 * argument of the page rather than a step in it, and the sections it sits
 * between still read as consecutive with it removed. If a banner ever needs
 * more than the three lines this holds, it has stopped being a banner and wants
 * to be a page.
 */
export default function Banner({ banner }: { banner: BannerCopy }) {
  return (
    <aside
      id={banner.id}
      className={`${styles.banner} ${banner.tone === "ember" ? styles.ember : styles.gold}`}
    >
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.kicker}>{banner.kicker}</p>
          <h2 className={styles.title}>{banner.title}</h2>
          <p className={styles.body}>{banner.body}</p>
        </div>

        <Link href={banner.href} className={styles.link}>
          {banner.label} →
        </Link>
      </div>
    </aside>
  );
}
