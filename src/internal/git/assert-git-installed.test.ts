import { describe, expect, it } from 'vitest';
import { assertGitInstalled } from './assert-git-installed.js';

describe('assertGitInstalled', () => {
  it('resolves when git is installed and recent enough', async () => {
    await expect(assertGitInstalled()).resolves.toBeUndefined();
  });
});
