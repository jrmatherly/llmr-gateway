const claimedUpgradePaths = new WeakMap<object, Map<string, number>>();

export function claimWebSocketUpgradePath(server: object, pathname: string): () => void {
  let claims = claimedUpgradePaths.get(server);
  if (!claims) {
    claims = new Map();
    claimedUpgradePaths.set(server, claims);
  }
  const counts = claims;
  counts.set(pathname, (counts.get(pathname) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const remaining = (counts.get(pathname) ?? 1) - 1;
    if (remaining > 0) {
      counts.set(pathname, remaining);
    } else {
      counts.delete(pathname);
    }
  };
}

export function isWebSocketUpgradePathClaimed(server: object, pathname: string): boolean {
  return claimedUpgradePaths.get(server)?.has(pathname) ?? false;
}
