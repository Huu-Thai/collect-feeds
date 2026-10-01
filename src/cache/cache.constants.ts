export const CACHE_TTL = {
  FEED_LOOKUP: 60_000,
  PERMISSION_LOOKUP: 300_000,
} as const;

export const CACHE_KEYS = {
  feedByValue: (value: string, type: string) => `feed:${type}:${value}`,
  permissionsByRole: (roleId: string) => `permissions:role:${roleId}`,
} as const;
