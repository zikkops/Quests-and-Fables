"use client";

/**
 * A deadline for anything that talks to Firestore.
 *
 * The SDK does not fail fast. Point it at a database that does not exist, or a
 * phone that has wandered off the network, and it retries quietly and forever:
 * the promise never settles, so a component waiting on it sits on its loading
 * state until the tab is closed. That is worse than an error, because an error
 * can at least be read.
 *
 * Found the honest way, by pointing a finished build at a real Firebase project
 * whose Firestore database had not been created yet. `/parties` said "Looking
 * for tables." indefinitely.
 *
 * Eight seconds is chosen to be longer than any healthy read on a bad
 * connection and shorter than somebody's patience.
 */

export const REACH_TIMEOUT = 8000;

export class Unreachable extends Error {
  constructor() {
    super("Could not reach the database. Check your connection and try again.");
    this.name = "Unreachable";
  }
}

export function withTimeout<T>(work: Promise<T>, ms = REACH_TIMEOUT): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Unreachable()), ms);

    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (problem) => {
        clearTimeout(timer);
        reject(problem);
      },
    );
  });
}
