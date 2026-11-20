import { getAccidents } from "@/lib/server/accidents";
import { handle } from "@/lib/server/http";
export async function GET() {
  return handle(async () => Response.json(await getAccidents(),{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}}));
}

// Deployment platform execution budget (seconds).
export const maxDuration = 120;
