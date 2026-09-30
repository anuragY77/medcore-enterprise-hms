"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F9FF",
          color: "#0B1C30",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "24rem",
            padding: "1.5rem",
            textAlign: "center",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "#64748B" }}>
            A critical error occurred. Please try again.
            {error.digest ? ` (Ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#FFFFFF",
              background: "#064E3B",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
