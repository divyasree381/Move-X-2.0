"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { Button, Dialog, DialogContent, Input } from "@/components/ui";
import { rateOrder } from "@/lib/api";

export function RatingModal({ orderId, open, onOpenChange }: { orderId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => rateOrder(orderId, rating, comment.trim() || undefined),
    onMutate: () => setError(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onOpenChange(false);
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : "Rating could not be saved"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Rate this order" description="Your rating updates partner quality metrics.">
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" role="radio" aria-checked={rating === value} className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => setRating(value)}>
                <Star className={value <= rating ? "size-7 fill-warning text-warning" : "size-7 text-muted-foreground"} aria-hidden="true" />
                <span className="sr-only">{value} stars</span>
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium text-foreground" htmlFor="rating-comment">Comment</label>
          <Input id="rating-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional feedback" />
          {error ? <p className="text-sm text-destructive" role="status">{error}</p> : null}
          <Button type="button" className="w-full" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving" : "Submit rating"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}