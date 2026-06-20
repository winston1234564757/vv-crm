// Helper to assert types for Supabase join queries.
// Supabase v2 cannot infer nested joined fields from `.select("*, related(*)")`,
// so the result type is `unknown` for those fields.
//
// TODO(#1): Revisit when Supabase v2 adds typed joins or switch to zod parse at boundary.

export function supabaseCast<T>(data: unknown): T {
  return data as T;
}
