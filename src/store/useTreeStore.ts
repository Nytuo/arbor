import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import localforage from 'localforage';
import type { Person, Relationship, FamilyTreeData } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface TreeState {
  people: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  
  // Actions
  addPerson: (person: Omit<Person, 'id'>) => string;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  
  addRelationship: (rel: Omit<Relationship, 'id'>) => string;
  updateRelationship: (id: string, updates: Partial<Relationship>) => void;
  deleteRelationship: (id: string) => void;
  
  setSelectedPersonId: (id: string | null) => void;
  
  // Bulk actions (for import)
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
  persist(
    (set) => ({
      people: [],
      relationships: [],
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
          people: state.people.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      deletePerson: (id) => {
        set((state) => ({
          people: state.people.filter((p) => p.id !== id),
          relationships: state.relationships.filter(
            (r) => r.fromId !== id && r.toId !== id
          ),
          selectedPersonId: state.selectedPersonId === id ? null : state.selectedPersonId,
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
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      deleteRelationship: (id) => {
        set((state) => ({
          relationships: state.relationships.filter((r) => r.id !== id),
        }));
      },

      setSelectedPersonId: (id) => {
        set({ selectedPersonId: id });
      },

      importData: (data) => {
        set({
          people: data.people,
          relationships: data.relationships,
          selectedPersonId: null,
        });
      },

      resetTree: () => {
        set({
          people: [],
          relationships: [],
          selectedPersonId: null,
        });
      },
    }),
    {
      name: 'family-tree-storage',
      storage: createJSONStorage(() => storage),
    }
  )
);
