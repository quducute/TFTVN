import { revalidateTag } from "next/cache";
import { createApp } from "./create-app";
import { getDatabaseVersion } from "./status";

export const app = createApp({
  revalidateSecret: () => process.env.REVALIDATE_SECRET,
  revalidate: revalidateTag,
  databaseVersion: getDatabaseVersion,
});
