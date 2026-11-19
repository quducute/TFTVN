export const PLANNER_SLOTS = 10;
export const EMPTY_PLANNER_SLOT = "000";

const PLANNER_CODE = /^02((?:[0-9a-f]{3}){10})(TFTSet\d+)$/i;
const SLOT_CODE = /^[0-9a-f]{3}$/;

export function isEncodablePlannerCode(code: string | null | undefined): code is string {
  return code != null && SLOT_CODE.test(code) && code !== EMPTY_PLANNER_SLOT;
}

export function encodePlannerCode(codes: readonly string[], mutator: string): string {
  const slots = codes.filter(isEncodablePlannerCode).slice(0, PLANNER_SLOTS);
  while (slots.length < PLANNER_SLOTS) {
    slots.push(EMPTY_PLANNER_SLOT);
  }
  return `02${slots.join("")}${mutator}`;
}

export function decodePlannerCode(input: string): { codes: string[]; mutator: string } | null {
  const match = PLANNER_CODE.exec(input.trim());
  if (!match) {
    return null;
  }
  const slots = match[1]!.toLowerCase().match(/.{3}/g) ?? [];
  const mutator = match[2]!;
  return {
    codes: slots.filter((slot) => slot !== EMPTY_PLANNER_SLOT),
    mutator: `TFTSet${mutator.slice("TFTSet".length)}`,
  };
}
