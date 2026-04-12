import type { FamilyTreeData } from '../types';

export const exportToJSON = (data: FamilyTreeData) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `family-tree-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const importFromJSON = (content: string): FamilyTreeData | null => {
  try {
    const data = JSON.parse(content);
    // Basic validation
    if (Array.isArray(data.people) && Array.isArray(data.relationships)) {
      return data as FamilyTreeData;
    }
    throw new Error('Invalid JSON structure');
  } catch (error) {
    console.error('Error importing JSON:', error);
    alert('Failed to import JSON file. Please make sure it is a valid export.');
    return null;
  }
};
