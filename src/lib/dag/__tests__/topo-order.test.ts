import { describe, expect, it } from "vitest";
import { topologicalOrder } from "../topo-order";

describe("topologicalOrder", () => {
  it("orders a simple chain", () => {
    const deps: Record<string, string[]> = { A: [], B: ["A"], C: ["B"] };
    const { order, cycle } = topologicalOrder(["A", "B", "C"], (id) => deps[id]);
    expect(cycle).toBe(false);
    expect(order).toEqual(["A", "B", "C"]);
  });

  it("orders a fan-out/fan-in graph with a dependent after all its deps", () => {
    const deps: Record<string, string[]> = { A: [], B: ["A"], C: ["A"], D: ["B", "C"] };
    const { order, cycle } = topologicalOrder(["A", "B", "C", "D"], (id) => deps[id]);
    expect(cycle).toBe(false);
    expect(order.indexOf("D")).toBeGreaterThan(order.indexOf("B"));
    expect(order.indexOf("D")).toBeGreaterThan(order.indexOf("C"));
    expect(order.indexOf("B")).toBeGreaterThan(order.indexOf("A"));
  });

  it("detects a cycle", () => {
    const deps: Record<string, string[]> = { A: ["B"], B: ["A"] };
    const { cycle } = topologicalOrder(["A", "B"], (id) => deps[id]);
    expect(cycle).toBe(true);
  });

  it("ignores dependencies on unknown node ids (surfaced separately by the caller)", () => {
    const { order, cycle } = topologicalOrder(["A"], () => ["Nonexistent"]);
    expect(cycle).toBe(false);
    expect(order).toEqual(["A"]);
  });
});
