import { handle } from "hono/vercel";
import { app } from "@/server/app";

const handler = handle(app);

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT };
