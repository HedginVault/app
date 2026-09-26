import { externalRoute } from "@/server/external/api";

type Context = { params: Promise<{ path: string[] }> };

export const GET = async (request: Request, context: Context) =>
  externalRoute(request, (await context.params).path, "GET");

export const POST = async (request: Request, context: Context) =>
  externalRoute(request, (await context.params).path, "POST");
