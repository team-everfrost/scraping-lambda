import fs from 'fs';
import path from 'path';

export const loadTransformations = async () => {
  const transformations = [];
  const files = await fs.promises.readdir(
    path.join(__dirname, 'transformations'),
  );
  for (const file of files) {
    if (file.endsWith('.ts') || file.endsWith('.js')) {
      const { transformation } = await import(
        path.join(__dirname, 'transformations', file)
      );
      transformations.push(transformation);
    }
  }
  return transformations;
};
