"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to: the answer changes exactly once, at hydration. */
const subscribe = () => () => {};

/**
 * False during server render and the hydrating paint, true afterwards.
 *
 * This is how a component reads something that only exists in the browser, such
 * as a draft in localStorage, without either lying to the server or calling
 * setState from an effect. React swaps the value itself as part of hydration, so
 * there is no cascading render and no mismatch between the server HTML and the
 * first client paint.
 */
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);
