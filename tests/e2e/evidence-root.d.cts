declare const evidenceRoots: {
  canonicalEvidencePath(path: string): string;
  evidencePathContains(root: string, path: string): boolean;
  evidenceRootPath(path: string, workspace?: string): string;
};
export = evidenceRoots;
