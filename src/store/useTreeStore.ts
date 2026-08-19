import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { temporal } from "zundo";
import localforage from "localforage";
import type { Person, Relationship, Group, FamilyTreeData } from "../types";
import { v4 as uuidv4 } from "uuid";

const debounce = <Args extends unknown[]>(fn: (...args: Args) => void, wait: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

interface TreeState {
  people: Person[];
  relationships: Relationship[];
  groups: Group[];
  selectedPersonId: string | null;

  addPerson: (person: Omit<Person, "id">) => string;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  deletePerson: (id: string) => void;

  addRelationship: (rel: Omit<Relationship, "id">) => string;
  updateRelationship: (id: string, updates: Partial<Relationship>) => void;
  deleteRelationship: (id: string) => void;

  addGroup: (group: Omit<Group, "id">) => string;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;

  setSelectedPersonId: (id: string | null) => void;

  importData: (data: FamilyTreeData) => void;
  resetTree: () => void;
}

const storage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await localforage.getItem(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await localforage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await localforage.removeItem(name);
  },
};

export const useTreeStore = create<TreeState>()(
  temporal(
    persist(
    (set) => ({
      people: [],
      relationships: [],
      groups: [],
      selectedPersonId: null,

      addPerson: (personData) => {
        const id = uuidv4();
        set((state) => ({
          people: [...state.people, { ...personData, id }],
        }));
        return id;
      },

      updatePerson: (id, updates) => {
        set((state) => ({
          people: state.people.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        }));
      },

      deletePerson: (id) => {
        set((state) => ({
          people: state.people.filter((p) => p.id !== id),
          relationships: state.relationships.filter(
            (r) => r.fromId !== id && r.toId !== id,
          ),
          selectedPersonId:
            state.selectedPersonId === id ? null : state.selectedPersonId,
        }));
      },

      addRelationship: (relData) => {
        const id = uuidv4();
        set((state) => ({
          relationships: [...state.relationships, { ...relData, id }],
        }));
        return id;
      },

      updateRelationship: (id, updates) => {
        set((state) => ({
          relationships: state.relationships.map((r) =>
            r.id === id ? { ...r, ...updates } : r,
          ),
        }));
      },

      deleteRelationship: (id) => {
        set((state) => ({
          relationships: state.relationships.filter((r) => r.id !== id),
        }));
      },

      addGroup: (groupData) => {
        const id = uuidv4();
        set((state) => ({
          groups: [...state.groups, { ...groupData, id }],
        }));
        return id;
      },

      updateGroup: (id, updates) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === id ? { ...g, ...updates } : g,
          ),
        }));
      },

      deleteGroup: (id) => {
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
        }));
      },

      setSelectedPersonId: (id) => {
        set({ selectedPersonId: id });
      },

      importData: (data) => {
        set({
          people: data.people,
          relationships: data.relationships,
          groups: data.groups || [],
          selectedPersonId: null,
        });
      },

      resetTree: () => {
        set({
          people: [],
          relationships: [],
          groups: [],
          selectedPersonId: null,
        });
      },
    }),
    {
      name: "family-tree-storage",
      storage: createJSONStorage(() => storage),
    },
    ),
    {
      partialize: (state) => ({
        people: state.people,
        relationships: state.relationships,
        groups: state.groups,
      }),
      equality: (a, b) =>
        a.people === b.people &&
        a.relationships === b.relationships &&
        a.groups === b.groups,
      limit: 100,
      handleSet: (handleSet) => debounce(handleSet, 500),
    },
  ),
);
