import { handlers } from "@/lib/auth";

// IMPORTANT: Force dynamic to prevent Data Cache from caching session responses.
// Without this, the first user's session would be cached and served to all users.
export const dynamic = "force-dynamic";

export const { GET, POST } = handlers;
