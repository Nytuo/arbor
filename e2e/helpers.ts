import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import type { FamilyTreeData } from "../src/types";

/** Imports a tree via the header's Import button. Writes to a uniquely
 * named temp file per call so parallel tests never collide on the same
 * path. */
export const importTree = async (page: Page, data: FamilyTreeData): Promise<void> => {
  const file = path.join(os.tmpdir(), `arbor-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByText("Tree imported successfully").waitFor({ state: "visible" });
  // The toast fires synchronously right after the store update, before the
  // canvas's async store->editor sync (see runSyncPass in useTreeEditor.tsx)
  // has actually created/positioned the Rete nodes - waiting on the toast
  // alone let tests read stale (pre-layout) bounding boxes.
  if (data.people.length > 0) {
    await page
      .locator('[role="button"][tabindex="0"]')
      .first()
      .waitFor({ state: "visible" });
  }
  await page.waitForTimeout(150);
};

/** Locates a person card by (partial) visible name. Matches
 * PersonNodeComponent's `role="button" tabIndex={0}` card element. */
export const personCard = (page: Page, name: string) =>
  page.locator('[role="button"][tabindex="0"]').filter({ hasText: name });

/** Locates a group container by its label text. */
export const groupBox = (page: Page, label: string) =>
  page.locator(".border-dashed").filter({ has: page.getByText(label, { exact: false }) });

/** Reads the persisted zustand/zundo store straight out of IndexedDB
 * (localforage's default store), bypassing the UI entirely - used for
 * data-integrity assertions where "does the DOM currently show it" isn't
 * enough (see e2e/data-integrity.spec.ts, which exists specifically
 * because a virtualization bug once silently deleted relationships that
 * were merely scrolled off-screen, not actually removed by the user). */
export const readPersistedTree = (page: Page): Promise<FamilyTreeData> =>
  page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("localforage");
      req.onerror = () => reject(new Error("indexedDB open failed"));
      req.onsuccess = () => {
        const db = req.result;
        const storeName = db.objectStoreNames[0];
        const tx = db.transaction(storeName, "readonly");
        const getReq = tx.objectStore(storeName).get("family-tree-storage");
        getReq.onsuccess = () => {
          const parsed = JSON.parse(getReq.result as string);
          resolve(parsed.state);
        };
        getReq.onerror = () => reject(new Error("indexedDB get failed"));
      };
    });
  });

/** Drags from (x1,y1) to (x2,y2) as a sequence of small steps rather than
 * one jump - Rete's drag handler (and connection-plugin's drag-to-connect)
 * needs real intermediate pointermove events to register the gesture, not
 * just a down/up pair at different coordinates. */
export const dragTo = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 12,
): Promise<void> => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(50);
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(50);
  await page.mouse.up();
  // Settle: the drag-stop store write still has to flow through sync()
  // (async, can coalesce a queued extra pass - see useTreeEditor.tsx) before
  // the DOM reflects the final position.
  await page.waitForTimeout(200);
};
