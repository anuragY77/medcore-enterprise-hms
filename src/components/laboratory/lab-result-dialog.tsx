"use client";

import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { LabTest } from "./lab-test-table";

interface LabResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: LabTest | null;
  onSuccess: () => void;
}

async function readErrorMessage(res: Response): Promise<string> {
  const payload = await res.json().catch(() => null);
  if (res.status === 400 && payload?.details) {
    const first = Object.values(payload.details).flat()[0];
    if (typeof first === "string") return first;
  }
  if (res.status === 401) return "Your session has expired. Please sign in again.";
  if (res.status === 403) return "You do not have permission to record lab results.";
  if (res.status === 404) return "Lab test not found.";
  if (res.status === 409) return payload?.error || "Lab test is not eligible for completion.";
  if (res.status >= 500) return "Something went wrong. Please try again.";
  return payload?.error || "Failed to save result";
}

export function LabResultDialog({ open, onOpenChange, test, onSuccess }: LabResultDialogProps) {
  const [result, setResult] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCompleted = test?.status === "Completed";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setResult("");
      setServerError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!test) return;
    try {
      setIsSubmitting(true);
      setServerError(null);

      const res = await fetch(`/api/laboratory/${test.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });

      if (!res.ok) {
        const message = await readErrorMessage(res);
        throw new Error(message);
      }

      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            {isCompleted ? "Lab Result" : "Enter Lab Result"}
          </SheetTitle>
          <SheetDescription>
            {isCompleted
              ? "Recorded result for this laboratory test."
              : "Enter the result to complete this laboratory test. The result is saved to the patient's medical records."}
          </SheetDescription>
        </SheetHeader>

        {test && (
          <div className="space-y-4">
            <div className="bg-muted/40 rounded-lg border border-border/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Test ID</span>
                <span className="font-mono text-primary font-medium">{test.testId}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Test Name</span>
                <span className="text-foreground font-medium text-right">{test.testName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Category</span>
                <span className="text-foreground">{test.category}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-mono text-xs">{test.patientId}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span className="text-foreground">{test.status}</span>
              </div>
            </div>

            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="lab-result" className="block text-sm font-medium text-foreground mb-1">
                  Result {isCompleted ? "" : <span className="text-destructive">*</span>}
                </label>
                <textarea
                  id="lab-result"
                  rows={6}
                  value={isCompleted ? test.result ?? "" : result}
                  onChange={(e) => setResult(e.target.value)}
                  readOnly={isCompleted}
                  placeholder={isCompleted ? "No result recorded." : "Enter test result..."}
                  className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-muted/40"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                {!isCompleted && (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 inline-block mr-1 -mt-0.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Complete Test"
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="px-4 py-2 rounded-md border border-border/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  {isCompleted ? "Close" : "Cancel"}
                </button>
              </div>
            </form>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
