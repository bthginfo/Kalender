import { createEvent, validateInput } from "@/lib/repo";
import { body, fail, ok } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const input = validateInput(await body(request));
    return ok(await createEvent(input), { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
