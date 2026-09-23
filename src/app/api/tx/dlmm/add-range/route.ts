import { handlePost } from "@/server/route";
import { dlmmWideAddBody } from "@/server/tx/schemas";
import { buildWideAdd } from "@/server/tx/wide-add";

export const POST = handlePost(dlmmWideAddBody, buildWideAdd);
