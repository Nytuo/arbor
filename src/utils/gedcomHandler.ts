import type { FamilyTreeData, Person, Relationship, Gender } from "../types";
import { v4 as uuidv4 } from "uuid";

export const importFromGedcom = (content: string): FamilyTreeData | null => {
  try {
    const lines = content.split(/\r?\n/);
    const people: Person[] = [];
    const relationships: Relationship[] = [];

    const idMap: Record<string, string> = {};

    let currentEntity: any = null;
    let currentTag: string | null = null;

    const families: any[] = [];

    for (const line of lines) {
      const match = line.match(/^(\d)\s+(@\w+@|\w+)\s*(.*)$/);
      if (!match) continue;

      const level = parseInt(match[1]);
      const tagOrId = match[2];
      const value = match[3];

      if (level === 0) {
        if (value === "INDI") {
          const id = uuidv4();
          idMap[tagOrId] = id;
          currentEntity = {
            id,
            firstName: "",
            lastName: "",
            relationships: [],
          };
          people.push(currentEntity);
        } else if (value === "FAM") {
          currentEntity = {
            gedId: tagOrId,
            husb: null,
            wife: null,
            children: [],
          };
          families.push(currentEntity);
        } else {
          currentEntity = null;
        }
      } else if (currentEntity) {
        if (people.includes(currentEntity)) {
          if (tagOrId === "NAME") {
            const nameParts = value.split("/");
            currentEntity.firstName = nameParts[0]?.trim() || "";
            currentEntity.lastName = nameParts[1]?.trim() || "";
          } else if (tagOrId === "SEX") {
            currentEntity.gender = (value[0] || "U") as Gender;
          } else if (tagOrId === "BIRT" || tagOrId === "DEAT") {
            currentTag = tagOrId;
          } else if (tagOrId === "DATE" && currentTag === "BIRT") {
            currentEntity.birthDate = value;
          } else if (tagOrId === "DATE" && currentTag === "DEAT") {
            currentEntity.deathDate = value;
          } else if (tagOrId === "PLAC" && currentTag === "BIRT") {
            currentEntity.birthPlace = value;
          } else if (tagOrId === "PLAC" && currentTag === "DEAT") {
            currentEntity.deathPlace = value;
          } else if (tagOrId === "NOTE") {
            currentEntity.notes =
              (currentEntity.notes ? currentEntity.notes + " " : "") + value;
          }
        } else if (families.includes(currentEntity)) {
          if (tagOrId === "HUSB") currentEntity.husb = value;
          else if (tagOrId === "WIFE") currentEntity.wife = value;
          else if (tagOrId === "CHIL") currentEntity.children.push(value);
        }
      }
    }

    for (const fam of families) {
      const husbUuid = fam.husb ? idMap[fam.husb] : null;
      const wifeUuid = fam.wife ? idMap[fam.wife] : null;

      if (husbUuid && wifeUuid) {
        relationships.push({
          id: uuidv4(),
          type: "SPOUSE",
          fromId: husbUuid,
          toId: wifeUuid,
          metadata: { status: "married" },
        });
      }

      for (const childGedId of fam.children) {
        const childUuid = idMap[childGedId];
        if (!childUuid) continue;

        if (husbUuid) {
          relationships.push({
            id: uuidv4(),
            type: "PARENT_CHILD",
            fromId: husbUuid,
            toId: childUuid,
          });
        }
        if (wifeUuid) {
          relationships.push({
            id: uuidv4(),
            type: "PARENT_CHILD",
            fromId: wifeUuid,
            toId: childUuid,
          });
        }
      }
    }

    return { people, relationships };
  } catch (error) {
    console.error("Error importing GEDCOM:", error);
    alert("Failed to import GEDCOM file.");
    return null;
  }
};

/**
 * Basic GEDCOM Generator
 */
export const exportToGedcom = (data: FamilyTreeData) => {
  const { people, relationships } = data;
  let ged =
    "0 HEAD\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n";

  const uuidToGed: Record<string, string> = {};
  people.forEach((p, i) => {
    uuidToGed[p.id] = `@I${i + 1}@`;
  });

  people.forEach((p) => {
    const gedId = uuidToGed[p.id];
    ged += `0 ${gedId} INDI\n`;
    ged += `1 NAME ${p.firstName || ""} /${p.lastName || ""}/\n`;
    if (p.gender) ged += `1 SEX ${p.gender}\n`;
    if (p.birthDate || p.birthPlace) {
      ged += `1 BIRT\n`;
      if (p.birthDate) ged += `2 DATE ${p.birthDate}\n`;
      if (p.birthPlace) ged += `2 PLAC ${p.birthPlace}\n`;
    }
    if (p.deathDate || p.deathPlace) {
      ged += `1 DEAT\n`;
      if (p.deathDate) ged += `2 DATE ${p.deathDate}\n`;
      if (p.deathPlace) ged += `2 PLAC ${p.deathPlace}\n`;
    }
    if (p.notes) ged += `1 NOTE ${p.notes}\n`;
  });

  const familyGroups: Record<
    string,
    { husb?: string; wife?: string; children: string[] }
  > = {};

  relationships
    .filter((r) => r.type === "SPOUSE")
    .forEach((r) => {
      const famId = `F_${r.fromId}_${r.toId}`;
      familyGroups[famId] = { husb: r.fromId, wife: r.toId, children: [] };
    });

  relationships
    .filter((r) => r.type === "PARENT_CHILD")
    .forEach((r) => {
      const parentId = r.fromId;
      const childId = r.toId;

      let added = false;
      for (const famId in familyGroups) {
        const fam = familyGroups[famId];
        if (fam.husb === parentId || fam.wife === parentId) {
          if (!fam.children.includes(childId)) {
            fam.children.push(childId);
          }
          added = true;
        }
      }

      if (!added) {
        const famId = `F_SINGLE_${parentId}`;
        if (!familyGroups[famId]) {
          familyGroups[famId] = { husb: parentId, children: [] };
        }
        familyGroups[famId].children.push(childId);
      }
    });

  Object.entries(familyGroups).forEach(([_, fam], i) => {
    ged += `0 @F${i + 1}@ FAM\n`;
    if (fam.husb) ged += `1 HUSB ${uuidToGed[fam.husb]}\n`;
    if (fam.wife) ged += `1 WIFE ${uuidToGed[fam.wife]}\n`;
    fam.children.forEach((childId) => {
      ged += `1 CHIL ${uuidToGed[childId]}\n`;
    });
  });

  ged += "0 TRLR\n";

  const blob = new Blob([ged], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `family-tree-${new Date().toISOString().split("T")[0]}.ged`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
