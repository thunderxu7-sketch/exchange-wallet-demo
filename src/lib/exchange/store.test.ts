import { describe, expect, it } from "vitest";

import {
  createServerRouteSnapshot,
  listTransactions,
} from "./store";

describe("server route snapshots", () => {
  it("summarizes the current in-memory transactions", () => {
    const transactions = listTransactions();
    const snapshot = createServerRouteSnapshot();

    expect(snapshot.renderId).toMatch(/^[A-F0-9]{6}$/);
    expect(Date.parse(snapshot.renderedAt)).not.toBeNaN();
    expect(snapshot.transactionCount).toBe(transactions.length);
    expect(snapshot.activeCount + snapshot.completedCount).toBe(
      snapshot.transactionCount,
    );
  });

  it("creates a new render marker for each route request", () => {
    const first = createServerRouteSnapshot();
    const second = createServerRouteSnapshot();

    expect(second.renderId).not.toBe(first.renderId);
  });
});
