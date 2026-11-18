import { customType } from "drizzle-orm/pg-core";

export const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

export const bytea = customType<{ data: Buffer; driverData: Buffer | string }>({
  dataType: () => "bytea",
  toDriver: (value) => `\\x${value.toString("hex")}`,
  fromDriver: (value) =>
    typeof value === "string" ? Buffer.from(value.replace(/^\\x/, ""), "hex") : value,
});
