// Unit tests must never touch a real database. Some modules under test import
// "@/lib/db", which reads DATABASE_URL when the module loads. Provide a
// harmless placeholder when no value is present so imports succeed without a
// live connection. No query is ever executed against it by unit tests.
//
// Database integration tests exclusively use TEST_DATABASE_URL (validated in
// tests/integration/helpers.ts) and never this placeholder.
process.env.DATABASE_URL ??=
  "postgresql://placeholder:placeholder@127.0.0.1:5432/unit_test_placeholder_never_connected";
