export interface MergeInfo {
  number: number;
  title?: string;
  sourceBranch?: string;
  targetBranch?: string;
  /** 'merge' = real merge commit message; 'squash' = single-parent commit carrying the PR number. */
  kind: 'merge' | 'squash';
}

function firstBodyLine(body: string | undefined): string | undefined {
  const line = (body ?? '').split('\n').map((l) => l.trim()).find((l) => l !== '');
  return line || undefined;
}

function clean<T extends MergeInfo>(info: T): T {
  for (const k of Object.keys(info) as Array<keyof T>) if (info[k] === undefined) delete info[k];
  return info;
}

/**
 * Parses a merge/squash commit message (subject + body) from GitHub, GitLab,
 * Bitbucket or Azure DevOps. Returns null when it is not recognised.
 */
export function parseMergeMessage(subject: string, body = ''): MergeInfo | null {
  const s = subject.trim();

  // GitHub merge commit: "Merge pull request #12 from org/branch" (title in the body)
  let m = s.match(/^Merge pull request #(\d+) from (\S+)/);
  if (m) {
    const ref = m[2];
    const slash = ref.indexOf('/');
    return clean({ number: Number(m[1]), title: firstBodyLine(body), sourceBranch: slash >= 0 ? ref.slice(slash + 1) : ref, kind: 'merge' });
  }

  // GitLab: "Merge branch 'x' into 'main'" + "See merge request group/proj!34"
  m = s.match(/^Merge branch '(.+)' into '(.+)'$/);
  if (m) {
    const mr = body.match(/See merge request \S*?!(\d+)/);
    if (!mr) return null;
    const title = body
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l !== '' && !l.startsWith('See merge request') && !l.startsWith('Closes ') && !l.includes('Merge-request-id'));
    return clean({ number: Number(mr[1]), title, sourceBranch: m[1], targetBranch: m[2], kind: 'merge' });
  }

  // Bitbucket: "Merged in branch (pull request #7)"
  m = s.match(/^Merged in (\S+) \(pull request #(\d+)\)/);
  if (m) return clean({ number: Number(m[2]), title: firstBodyLine(body), sourceBranch: m[1], kind: 'merge' });

  // Azure DevOps: "Merged PR 45: title"
  m = s.match(/^Merged PR (\d+):\s*(.*)$/);
  if (m) return clean({ number: Number(m[1]), title: m[2].trim() || undefined, kind: 'squash' });

  // GitHub/GitLab squash: "Title (#123)"
  m = s.match(/^(.*\S)\s+\(#(\d+)\)$/);
  if (m) return clean({ number: Number(m[2]), title: m[1], kind: 'squash' });

  return null;
}
