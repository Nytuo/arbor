import { test, expect } from "@playwright/test";
import { importTree, personCard } from "./helpers";

test.describe("import / export", () => {
  test("imports a JSON tree and renders every person", async ({ page }) => {
    await page.goto("/");
    await importTree(page, {
      people: [
        { id: "p1", firstName: "Alice", lastName: "Smith", gender: "F", position: { x: 0, y: 0 } },
        { id: "p2", firstName: "Bob", lastName: "Smith", gender: "M", position: { x: 400, y: 0 } },
      ],
      relationships: [{ id: "r1", type: "SPOUSE", fromId: "p1", toId: "p2" }],
      groups: [],
    });

    await expect(personCard(page, "Alice Smith")).toBeVisible();
    await expect(personCard(page, "Bob Smith")).toBeVisible();
  });

  test("round-trips through JSON export without losing data", async ({ page }) => {
    await page.goto("/");
    await importTree(page, {
      people: [
        {
          id: "p1",
          firstName: "Alice",
          lastName: "Smith",
          maidenName: "Jones",
          gender: "F",
          birthDate: "1950-01-01",
          notes: "Some notes",
          position: { x: 0, y: 0 },
        },
      ],
      relationships: [],
      groups: [],
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTitle("Export JSON").click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    expect(exported.people).toHaveLength(1);
    expect(exported.people[0]).toMatchObject({
      firstName: "Alice",
      lastName: "Smith",
      maidenName: "Jones",
      birthDate: "1950-01-01",
      notes: "Some notes",
    });
  });

  test("rejects a malformed JSON file with a toast instead of crashing", async ({ page }) => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const badFile = path.join(os.tmpdir(), `arbor-e2e-bad-${Date.now()}.json`);
    fs.writeFileSync(badFile, "{ not: valid json");

    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(badFile);
    await expect(page.getByText(/Failed to import/i)).toBeVisible();
  });
});
