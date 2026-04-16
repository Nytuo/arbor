export type Gender = "M" | "F" | "O" | "U";

export interface Person {
  id: string;
  firstName?: string;
  lastName?: string;
  maidenName?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  gender?: Gender;
  notes?: string;
  position?: { x: number; y: number };
}

export type RelationshipType = "PARENT_CHILD" | "SPOUSE";

export interface Relationship {
  id: string;
  type: RelationshipType;
  fromId: string;
  toId: string;
  metadata?: {
    status?: "married" | "divorced" | "partnered";
    date?: string;
    relationshipType?: "biological" | "adopted" | "step";
  };
}

export interface FamilyTreeData {
  people: Person[];
  relationships: Relationship[];
}
