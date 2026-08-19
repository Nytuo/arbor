import { test, expect } from "@playwright/test";
import { importTree } from "./helpers";

test.describe("connection geometry", () => {
  test("connection path endpoints land exactly on the socket dots", async ({ page }) => {
    // Regression test for two stacked bugs found by this exact technique:
    // rete-render-utils' default socket-position watcher hardcodes a
    // +/-12px offset tuned for the library's own default layout, and the
    // socket wrapper divs were centered with a CSS transform that the
    // library's offsetLeft/offsetTop-based position measurement doesn't
    // account for. Both together produced a visible gap between the line
    // and the dot it's supposedly connected to.
    await page.goto("/");
    await importTree(page, {
      people: [
        { id: "p1", firstName: "Alice", lastName: "Smith", gender: "F", position: { x: 0, y: 0 } },
        { id: "p2", firstName: "Bob", lastName: "Smith", gender: "M", position: { x: 400, y: 0 } },
      ],
      relationships: [{ id: "r1", type: "SPOUSE", fromId: "p1", toId: "p2" }],
      groups: [],
    });

    const geometry = await page.evaluate(() => {
      const svg = document.querySelector('svg[data-testid="connection"]')!;
      const svgRect = svg.getBoundingClientRect();
      const path = svg.querySelector("path:not(marker path)")!;
      const d = path.getAttribute("d")!;
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const start = { x: nums[0] + svgRect.x, y: nums[1] + svgRect.y };
      const end = { x: nums[nums.length - 2] + svgRect.x, y: nums[nums.length - 1] + svgRect.y };
      const dots = [...document.querySelectorAll(".input-socket, .output-socket")].map((el) => {
        const r = el.getBoundingClientRect();
        return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
      });
      return { start, end, dots };
    });

    const closestDotDistance = (p: { x: number; y: number }) =>
      Math.min(...geometry.dots.map((d) => Math.hypot(d.cx - p.x, d.cy - p.y)));

    expect(closestDotDistance(geometry.start)).toBeLessThan(1);
    expect(closestDotDistance(geometry.end)).toBeLessThan(1);
  });

  test("SVG export routes a couple's shared children as one family bus, not overlapping individual lines", async ({
    page,
  }) => {
    await page.goto("/");
    await importTree(page, {
      people: [
        { id: "p1", firstName: "Alice", lastName: "Smith", gender: "F", position: { x: 0, y: 0 } },
        { id: "p2", firstName: "Bob", lastName: "Smith", gender: "M", position: { x: 400, y: 0 } },
        { id: "p3", firstName: "Carol", lastName: "Smith", gender: "F", position: { x: -100, y: 300 } },
        { id: "p4", firstName: "Dave", lastName: "Smith", gender: "M", position: { x: 150, y: 300 } },
      ],
      relationships: [
        { id: "r1", type: "SPOUSE", fromId: "p1", toId: "p2" },
        { id: "r2", type: "PARENT_CHILD", fromId: "p1", toId: "p3" },
        { id: "r3", type: "PARENT_CHILD", fromId: "p2", toId: "p3" },
        { id: "r4", type: "PARENT_CHILD", fromId: "p1", toId: "p4" },
        { id: "r5", type: "PARENT_CHILD", fromId: "p2", toId: "p4" },
      ],
      groups: [],
    });

    await page.getByRole("button", { name: "Export", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export SVG" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf8");

    // 5 relationships (1 spouse + 4 parent-child, 2 of which share the same
    // two children) should collapse to 2 <path> line elements - one family
    // bus for the 4 parent-child edges, one spouse connector - plus 2
    // arrowhead paths, not one path per raw relationship.
    const pathCount = (svg.match(/<path /g) || []).length;
    expect(pathCount).toBe(4);
  });
});
