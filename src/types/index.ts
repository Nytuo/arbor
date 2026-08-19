export type Gender = "M" | "F" | "O" | "U";

export interface PersonImage {
  id: string;
  dataUrl: string;
}

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
  photo?: string;
  photoCrop?: { sourceImageId: string; x: number; y: number; size: number };
  extraImages?: PersonImage[];
  groupId?: string;
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

export interface Group {
  id: string;
  label?: string;
  color?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface FamilyTreeData {
  people: Person[];
  relationships: Relationship[];
  groups?: Group[];
}
