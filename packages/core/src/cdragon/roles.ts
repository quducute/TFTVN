export const STANDARD_ROLE_API_NAMES = [
  "ADCarry",
  "ADCaster",
  "ADFighter",
  "ADReaper",
  "ADSpecialist",
  "ADTank",
  "APCarry",
  "APCaster",
  "APFighter",
  "APReaper",
  "APTank",
  "HFighter",
] as const;

export function collectRoleApiNames(found: Iterable<string>): string[] {
  return [...new Set([...STANDARD_ROLE_API_NAMES, ...found])].sort();
}

export function effectiveRole(
  assigned: string | null | undefined,
  fromGameData: string | null | undefined,
): string | null {
  return assigned ?? fromGameData ?? null;
}
