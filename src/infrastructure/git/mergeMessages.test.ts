import { describe, expect, it } from 'vitest';
import { parseMergeMessage } from './mergeMessages';

describe('parseMergeMessage', () => {
  it('GitHub merge commit', () => {
    expect(parseMergeMessage('Merge pull request #12 from org/feat/login', '\nAdd login\n')).toEqual({
      number: 12, title: 'Add login', sourceBranch: 'feat/login', kind: 'merge',
    });
  });
  it('GitHub squash', () => {
    expect(parseMergeMessage('Fix cache bug (#123)')).toEqual({ number: 123, title: 'Fix cache bug', kind: 'squash' });
  });
  it('GitLab merge request', () => {
    expect(parseMergeMessage("Merge branch 'fix-x' into 'main'", 'Fix X\n\nSee merge request grp/proj!34')).toEqual({
      number: 34, title: 'Fix X', sourceBranch: 'fix-x', targetBranch: 'main', kind: 'merge',
    });
  });
  it('GitLab merge without MR reference is unknown', () => {
    expect(parseMergeMessage("Merge branch 'x' into 'main'")).toBeNull();
  });
  it('Bitbucket', () => {
    expect(parseMergeMessage('Merged in feature/abc (pull request #7)')).toEqual({ number: 7, sourceBranch: 'feature/abc', kind: 'merge' });
  });
  it('Azure DevOps', () => {
    expect(parseMergeMessage('Merged PR 45: Add billing')).toEqual({ number: 45, title: 'Add billing', kind: 'squash' });
  });
  it('unknown', () => {
    expect(parseMergeMessage('chore: bump deps')).toBeNull();
    expect(parseMergeMessage('Merge branch main into dev')).toBeNull();
  });
});
