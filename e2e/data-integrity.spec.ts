import { test, expect } from "@playwright/test";
import { importTree, readPersistedTree } from "./helpers";

test.describe("data integrity under virtualization", () => {
  test("relationships survive heavy zoom in/out and pan-away-and-back", async ({ page }) => {
    // This is the most important test in the suite. Viewport virtualization
    // (see getVisibleWorldRect in useTreeEditor.tsx) removes off-screen
    // connections from the Rete editor to keep large trees fast. That
    // 'connectionremoved' signal is indistinguishable from the user
    // genuinely detaching a link unless sync tags its own removals -
    // without that tag, panning/zooming used to permanently delete
    // relationships from the store (and from IndexedDB, since the store
    // is persisted). This asserts the *persisted* data, not just what's
    // currently drawn, since the bug's whole danger was that the UI could
    // look fine while the underlying data was already gone.
    await page.goto("/");
    const relationshipIds = ["r1", "r2", "r3"];
    await importTree(page, {
      people: [
        { id: "p1", firstName: "Alice", lastName: "Smith", gender: "F", position: { x: 0, y: 0 } },
        { id: "p2", firstName: "Bob", lastName: "Smith", gender: "M", position: { x: 400, y: 0 } },
        { id: "p3", firstName: "Carol", lastName: "Smith", gender: "F", position: { x: 100, y: 300 } },
      ],
      relationships: [
        { id: "r1", type: "SPOUSE", fromId: "p1", toId: "p2" },
        { id: "r2", type: "PARENT_CHILD", fromId: "p1", toId: "p3" },
        { id: "r3", type: "PARENT_CHILD", fromId: "p2", toId: "p3" },
      ],
      groups: [],
    });

    await page.mouse.move(250, 200);
    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, -200); // zoom in hard
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(300);
    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, 200); // zoom back out
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(300);

    await page.mouse.move(700, 500);
    await page.mouse.down();
    await page.mouse.move(-2000, -2000, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.mouse.move(700, 500);
    await page.mouse.down();
    await page.mouse.move(700 + 2000, 500 + 2000, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const persisted = await readPersistedTree(page);
    expect(persisted.relationships.map((r) => r.id).sort()).toEqual(relationshipIds.sort());
    expect(persisted.people).toHaveLength(3);
  });

  test("connections re-render after zooming back in on a culled area", async ({ page }) => {
    await page.goto("/");
    await importTree(page, {
      people: [
        { id: "p1", firstName: "Alice", lastName: "Smith", gender: "F", position: { x: 0, y: 0 } },
        { id: "p2", firstName: "Bob", lastName: "Smith", gender: "M", position: { x: 400, y: 0 } },
      ],
      relationships: [{ id: "r1", type: "SPOUSE", fromId: "p1", toId: "p2" }],
      groups: [],
    });

    await expect(page.locator('svg[data-testid="connection"]')).toHaveCount(1);

    // Pan far enough away that both cards - and their connection - fall
    // well outside the virtualization margin, then back.
    await page.mouse.move(700, 500);
    await page.mouse.down();
    await page.mouse.move(700 - 5000, 500 - 5000, { steps: 25 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    await expect(page.locator('svg[data-testid="connection"]')).toHaveCount(0);

    await page.mouse.move(700, 500);
    await page.mouse.down();
    await page.mouse.move(700 + 5000, 500 + 5000, { steps: 25 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    await expect(page.locator('svg[data-testid="connection"]')).toHaveCount(1);
  });
});
