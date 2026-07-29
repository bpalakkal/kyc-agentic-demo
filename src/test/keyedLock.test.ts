import { describe, expect, it } from "vitest";
import { withKeyedLock } from "../../agents/utils/keyedLock.js";

describe("withKeyedLock", () => {
  it("serializes parallel work for one entity without blocking other entities", async () => {
    let activeForEntity = 0;
    let maxActiveForEntity = 0;
    const completed: number[] = [];

    await Promise.all(Array.from({ length: 12 }, (_, index) =>
      withKeyedLock("exceptions:case-a", async () => {
        activeForEntity += 1;
        maxActiveForEntity = Math.max(maxActiveForEntity, activeForEntity);
        await new Promise(resolve => setTimeout(resolve, 2));
        completed.push(index);
        activeForEntity -= 1;
      })
    ));

    expect(maxActiveForEntity).toBe(1);
    expect(completed).toEqual(Array.from({ length: 12 }, (_, index) => index));
  });
});
