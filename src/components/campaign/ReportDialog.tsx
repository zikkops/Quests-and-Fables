"use client";

import { useState } from "react";
import { REPORT_REASONS, fileReport, type ReportReason } from "@/lib/firebase/report";
import type { SessionNote } from "@/lib/notebook";
import styles from "./ReportDialog.module.css";

/**
 * Saying that something here is wrong.
 *
 * Kept short on purpose. Somebody reaching for this has had a bad evening, and
 * a long form is one more reason to close the tab and not come back: a reason,
 * an optional sentence, done. The detail can be asked for afterwards by a human,
 * which is what actually happens next anyway.
 *
 * It says plainly what happens to it, because "report" means very different
 * things on different sites and the honest version here is unusually small: it
 * goes to the people who run this, they read it, nothing is automatic, and the
 * person reported is not told.
 */
export default function ReportDialog({
  note,
  reporterId,
  reporterName,
  partyId,
  onClose,
}: {
  note: SessionNote;
  reporterId: string;
  reporterName: string;
  partyId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) return;
    setError(null);
    setBusy(true);

    try {
      await fileReport({
        reporterId,
        reporterName,
        targetKind: "note",
        targetId: note.authorId,
        targetName: note.authorName,
        partyId,
        noteId: note.id,
        quoted: note.body,
        reason,
        detail,
      });
      setSent(true);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Report a note">
      <div className={styles.panel}>
        {sent ? (
          <>
            <h2 className={styles.title}>Sent.</h2>
            <p className={styles.body}>
              Somebody will read it. If it needs a conversation you will get one,
              and {note.authorName} is not told you sent this.
            </p>
            <button type="button" className={styles.primary} onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Report this note</h2>
            <p className={styles.body}>
              Written by <strong>{note.authorName}</strong>. It goes to the people
              who run Quests &amp; Fables and nowhere else. Nothing happens
              automatically, and they are not told who reported them.
            </p>

            <blockquote className={styles.quoted}>{note.body}</blockquote>

            <div className={styles.reasons}>
              {REPORT_REASONS.map((one) => (
                <button
                  key={one.key}
                  type="button"
                  aria-pressed={reason === one.key}
                  className={reason === one.key ? styles.reasonOn : styles.reason}
                  onClick={() => setReason(one.key)}
                >
                  <span className={styles.reasonLabel}>{one.label}</span>
                  {"hint" in one && one.hint ? (
                    <span className={styles.reasonHint}>{one.hint}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Anything you want to add</span>
              <textarea
                className={styles.textarea}
                rows={3}
                value={detail}
                maxLength={1000}
                placeholder="Optional."
                onChange={(event) => setDetail(event.target.value)}
              />
            </label>

            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={submit}
                disabled={!reason || busy}
              >
                {busy ? "Sending…" : "Send it"}
              </button>
              <button type="button" className={styles.secondary} onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
