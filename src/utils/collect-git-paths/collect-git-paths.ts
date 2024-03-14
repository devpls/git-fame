import { isGitRepo } from '@/utils';
import { getSubdirectories } from '@/utils/get-sub-directories';

export const collectGitPaths = async (dir: string): Promise<string[]> => {
  if (isGitRepo(dir)) {
    return [dir];
  } else {
    const subdirs = getSubdirectories(dir);
    const pathsArr = await Promise.all(subdirs.map((subdir) => collectGitPaths(subdir)));
    return pathsArr.flat();
  }
};
