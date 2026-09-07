"use client";

import { useEffect, useState } from "react";
import {
  answerReport,
  listReports,
  REPORT_REASONS,
  type Report,
  type ReportStatus,
} from "@/lib/firebase/report";
import styles from "./Admin.module.css";

/**
 * What people have reported, and what was done about it.
 *
 * The other half of the report button. A report control that files into a
 * collection nobody reads is worse than no control at all: it tells somebody
 * their bad evening has been heard when it has not.
 *
 * Answering a report never edits it. `firestore.rules` refuses any change to
 * who filed it, who it was about or what it said, and refuses deletion outright
 * even to an admin. The only field that moves is the status, so what somebody
 * said stays exactly as they said it.
 *
 * ⚠️ There is no automatic consequence anywhere in this, and there should not
 * be. Every one of these is a phone call or a conversation at the shop. The
 * console records what was decided; it does not decide anything.
 */
const reasonLabel = (key: string) =>
  REPORT_REASONS.find((one) => one.key === key)?.label ?? key;

const when = (stamp: number) =>
  new Date(stamp).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Reports() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnswered, setShowAnswered] = useState(false);

  useEffect(() => {
    let alive = true;

    listReports()
      .then((list) => { if (alive) setReports(list); })
      .catch((problem: Error) => {
        if (!alive) return;
        setError(problem.message);
        setReports([]);
      });

    return () => { alive = false; };
  }, [round]);

  const answer = async (report: Report, status: ReportStatus) => {
    setError(null);
    setBusy(true);
    try {
      await answerReport(report.id, status);
      setRound((n) => n + 1);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = (reports ?? []).filter((one) => one.status === "open");
  const answered = (reports ?? []).filter((one) => one.status !== "open");
  const shown = showAnswered ? answered : open;

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Reports</h2>
        <span className={open.length > 0 ? styles.tallyLoud : styles.tally}>
          {open.length} open
        </span>
      </div>

      <p className={styles.cardBody}>
        Nothing here is automatic. Each one is a conversation, and this only
        records what was decided.
      </p>

      {answered.length > 0 ? (
        <button
          type="button"
          className={styles.small}
          onClick={() => setShowAnswered((on) => !on)}
        >
          {showAnswered ? `Show the ${open.length} open` : `Show ${answered.length} answered`}
        </button>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      {reports === null ? (
        <p className={styles.cardBody}>Reading them.</p>
      ) : shown.length === 0 ? (
        <p className={styles.cardBody}>
          {showAnswered ? "None answered yet." : "Nothing reported. Good."}
        </p>
      ) : (
        <ul className={styles.list}>
          {shown.map((report) => (
            <li key={report.id} className={styles.row}>
              <div className={styles.rowMain}>
                <p className={styles.rowTitle}>
                  {report.targetName}
                  <span className={styles.rowMeta}>
                    {" "}
                    reported by {report.reporterName} · {reasonLabel(report.reason)} ·{" "}
                    {when(report.createdAt)}
                  </span>
                </p>

                {report.quoted ? (
                  <blockquote className={styles.quoted}>{report.quoted}</blockquote>
                ) : null}

                {report.detail ? <p className={styles.rowBody}>{report.detail}</p> : null}

                {report.status !== "open" ? (
                  <p className={styles.rowMeta}>Marked {report.status}.</p>
                ) : null}
              </div>

              {report.status === "open" ? (
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.small}
                    disabled={busy}
                    onClick={() => answer(report, "actioned")}
                  >
                    Dealt with
                  </button>
                  <button
                    type="button"
                    className={styles.small}
                    disabled={busy}
                    onClick={() => answer(report, "dismissed")}
                  >
                    Nothing to do
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
