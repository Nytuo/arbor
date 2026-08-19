import { test, expect } from "@playwright/test";
import { importTree, personCard, dragTo } from "./helpers";

test.describe("canvas interactions", () => {
  test("clicking a card opens it in the sidebar", async ({ page }) => {
    // Regression test: Rete's own drag handler consumes the pointer
    // sequence before a native 'click' event synthesizes, so a plain
    // onClick handler on the card silently never fired. Fixed by moving
    // the handler to onPointerDown; this guards against it coming back.
    await page.goto("/");
    await importTree(page, {
      people: [{ id: "p1", firstName: "Alice", lastName: "Smith", gender: "F", position: { x: 0, y: 0 } }],
      relationships: [],
      groups: [],
    });

    await personCard(page, "Alice").click();
    await expect(page.locator("h2").first()).toHaveText("Alice Smith");
    await expect(page.locator("#firstName")).toHaveValue("Alice");
  });

  test("dragging a card persists its new position", async ({ page }) => {
    await page.goto("/");
    await importTree(page, {
      people: [{ id: "p1", firstName: "Alice", lastName: "Smith", gender: "F", position: { x: 0, y: 0 } }],
      relationships: [],
      groups: [],
    });

    const card = personCard(page, "Alice");
    const before = await card.boundingBox();
    if (!before) throw new Error("card not found");

    await dragTo(page, { x: before.x + 20, y: before.y + 20 }, { x: before.x + 220, y: before.y + 120 });

    const after = await card.boundingBox();
    if (!after) throw new Error("card not found after drag");
    expect(after.x).not.toBeCloseTo(before.x, 0);

    // Reload from scratch (not just re-render) to prove the position was
    // actually persisted to storage, not just moved in local React state.
    await page.reload();
    await expect(personCard(page, "Alice")).toBeVisible();
    const afterReload = await personCard(page, "Alice").boundingBox();
    expect(afterReload!.x).toBeCloseTo(after.x, 0);
  });

  test("drag-connecting two cards creates a spouse relationship", async ({ page }) => {
    await page.goto("/");
    await importTree(page, {
      people: [
        { id: "p1", firstName: "Alice", lastName: "Smith", gender: "F", position: { x: 0, y: 0 } },
        { id: "p2", firstName: "Bob", lastName: "Smith", gender: "M", position: { x: 400, y: 0 } },
      ],
      relationships: [],
      groups: [],
    });

    const aliceBox = await personCard(page, "Alice").boundingBox();
    const bobBox = await personCard(page, "Bob").boundingBox();
    if (!aliceBox || !bobBox) throw new Error("cards not found");

    // spouse-out socket sits on the card's right edge, vertically centered
    const from = { x: aliceBox.x + aliceBox.width, y: aliceBox.y + aliceBox.height / 2 };
    const to = { x: bobBox.x, y: bobBox.y + bobBox.height / 2 };
    await dragTo(page, from, to, 15);

    // A perfectly horizontal <path> (this is a spouse connector, no
    // arrowhead marker) has a zero-height geometric bounding box, which
    // toBeVisible()'s positive-area heuristic can flag as "hidden" even
    // though it's a real, rendered, non-empty line - count is the
    // reliable signal here.
    await expect(page.locator('svg[data-testid="connection"] path')).toHaveCount(1);
  });

  test("Delete key removes the selected card", async ({ page }) => {
    await page.goto("/");
    await importTree(page, {
      people: [{ id: "p1", firstName: "Alice", lastName: "Smith", gender: "F", position: { x: 0, y: 0 } }],
      relationships: [],
      groups: [],
    });

    page.on("dialog", (dialog) => dialog.accept());
    await personCard(page, "Alice").click();
    await page.keyboard.press("Delete");
    await expect(personCard(page, "Alice")).toHaveCount(0);
  });
});
