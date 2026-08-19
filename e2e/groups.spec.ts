import { test, expect } from "@playwright/test";
import { importTree, personCard, dragTo } from "./helpers";

test.describe("group containers", () => {
  test("dragging a card into a group joins it and grows the group to fit", async ({ page }) => {
    await page.goto("/");
    await importTree(page, {
      // Deliberately not near the bottom-right corner: the minimap widget is
      // fixed there regardless of pan/zoom, and a card whose world position
      // happens to project under it would have its drag gesture swallowed
      // by the minimap instead of the card.
      people: [{ id: "p1", firstName: "Eve", lastName: "Jones", gender: "F", position: { x: 700, y: 20 } }],
      relationships: [],
      groups: [{ id: "g1", label: "Family", color: "amber", position: { x: -40, y: -40 }, size: { width: 400, height: 300 } }],
    });

    const card = personCard(page, "Eve");
    const before = await card.boundingBox();
    if (!before) throw new Error("card not found");

    // Drag Eve well inside the group's bounds.
    await dragTo(page, { x: before.x + before.width / 2, y: before.y + before.height / 2 }, { x: 200, y: 150 }, 15);

    const groupBox = await page.locator(".border-dashed").boundingBox();
    expect(groupBox).not.toBeNull();
    const cardAfter = await card.boundingBox();
    // Card should now be fully contained within the group's box.
    expect(cardAfter!.x).toBeGreaterThanOrEqual(groupBox!.x - 1);
    expect(cardAfter!.y).toBeGreaterThanOrEqual(groupBox!.y - 1);
    expect(cardAfter!.x + cardAfter!.width).toBeLessThanOrEqual(groupBox!.x + groupBox!.width + 1);
    expect(cardAfter!.y + cardAfter!.height).toBeLessThanOrEqual(groupBox!.y + groupBox!.height + 1);
  });

  test("dragging the group moves every card inside it, tick for tick", async ({ page }) => {
    // Regression test: this used to only move member cards after mouseup
    // (container visibly moved, then cards jumped into place). Fixed by
    // following the group's live 'nodetranslated' position during the
    // drag, not just its drag-stop position.
    await page.goto("/");
    await importTree(page, {
      people: [{ id: "p1", firstName: "Alice", lastName: "Smith", gender: "F", position: { x: 0, y: 0 }, groupId: "g1" }],
      relationships: [],
      groups: [{ id: "g1", label: "Family", color: "amber", position: { x: -40, y: -40 }, size: { width: 400, height: 300 } }],
    });

    const groupLocator = page.locator(".border-dashed");
    const card = personCard(page, "Alice");
    const groupBefore = await groupLocator.boundingBox();
    const cardBefore = await card.boundingBox();
    if (!groupBefore || !cardBefore) throw new Error("elements not found");

    await dragTo(
      page,
      { x: groupBefore.x + groupBefore.width / 2, y: groupBefore.y + groupBefore.height / 2 },
      { x: groupBefore.x + groupBefore.width / 2 + 150, y: groupBefore.y + groupBefore.height / 2 + 100 },
      15,
    );

    const groupAfter = await groupLocator.boundingBox();
    const cardAfter = await card.boundingBox();
    const groupDx = groupAfter!.x - groupBefore.x;
    const groupDy = groupAfter!.y - groupBefore.y;
    const cardDx = cardAfter!.x - cardBefore.x;
    const cardDy = cardAfter!.y - cardBefore.y;

    expect(cardDx).toBeCloseTo(groupDx, 0);
    expect(cardDy).toBeCloseTo(groupDy, 0);
  });
});
