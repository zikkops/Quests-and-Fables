"use client";

import { addDoc, collection, doc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db, unavailable } from "./client";
import { withTimeout } from "./reach";

/**
 * Reporting something.
 *
 * `Legal & Compliance` lists report and block among the things that exist
 * **before** open matching rather than after, and until now neither existed
 * anywhere in the product: a player with a bad experience had no route inside
 * it at all. That is survivable while every game master is somebody Mark has
 * played with, and stops being survivable the first time one is not.
 *
 * Write-only from a player's side. You file one and can read your own back; you
 * cannot read anybody else's, edit one afterwards, or delete one. A report its
 * subject could find or make disappear would be worse than no report, and the
 * reporter cannot quietly unsay it either: the record is what was said at the
 * time. All of that is enforced in `firestore.rules`, not here.
 */

export const REPORT_REASONS = [
  {
    key: "safety",
    label: "I felt unsafe",
    hint: "Anything that made you not want to be in the room.",
  },
  {
    key: "harassment",
    label: "Harassment",
    hint: "Aimed at somebody, and not stopping when asked.",
  },
  {
    key: "content",
    label: "Content somebody ruled out",
    hint: "A line crossed at the table, or written into the notebook.",
  },
  {
    key: "noshow",
    label: "Did not turn up",
    hint: "Repeatedly, and without saying so.",
  },
  { key: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["key"];
export type ReportStatus = "open" | "actioned" | "dismissed";

export type Report = {
  id: string;
  reporterId: string;
  /** Their username, copied in, so the console does not need a second read. */
  reporterName: string;
  targetKind: "player" | "note";
  /** The uid being reported. A note report still names its author. */
  targetId: string;
  targetName: string;
  /** Where it happened, when there is a where. */
  partyId?: string;
  noteId?: string;
  /** What was written, copied in: the note itself may be edited or deleted. */
  quoted?: string;
  reason: ReportReason;
  detail: string;
  status: ReportStatus;
  createdAt: number;
};

const database = () => {
  const instance = db();
  if (!instance) throw new Error(unavailable());
  return instance;
};

const PATH = "reports";

export async function fileReport(input: {
  reporterId: string;
  reporterName: string;
  targetKind: "player" | "note";
  targetId: string;
  targetName: string;
  partyId?: string;
  noteId?: string;
  quoted?: string;
  reason: ReportReason;
  detail: string;
}): Promise<string> {
  if (input.targetId === input.reporterId) {
    throw new Error("You cannot report yourself.");
  }

  const entry = await addDoc(collection(database(), PATH), {
    ...input,
    detail: input.detail.trim().slice(0, 1000),
    /* Copied rather than referenced on purpose: a note can be edited or deleted
       after it is reported, and a report of something nobody can read any more
       is not much of a report. */
    quoted: input.quoted?.slice(0, 500) ?? "",
    status: "open" satisfies ReportStatus,
    createdAt: Date.now(),
  });

  return entry.id;
}

/** Everything filed, newest first. Admin only, and the rules say so. */
export async function listReports(status?: ReportStatus): Promise<Report[]> {
  const base = collection(database(), PATH);
  const snapshot = await withTimeout(getDocs(
    status
      ? query(base, where("status", "==", status), orderBy("createdAt", "desc"))
      : query(base, orderBy("createdAt", "desc")),
  ));

  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Report);
}

/** What was decided. The report itself is never edited, only answered. */
export async function answerReport(reportId: string, status: ReportStatus): Promise<void> {
  await updateDoc(doc(database(), PATH, reportId), { status });
}
