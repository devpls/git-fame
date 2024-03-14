export const getFilteredFiles = (files: string[], filter: string) => {
  const regex = new RegExp(filter);
  return files.filter((file) => regex.test(file));
};
