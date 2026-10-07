"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, TriangleAlert } from "lucide-react";

import {
  getUnpaidRegistrations,
  type UnpaidRegistration,
} from "@/app/(website)/actions";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Mandatory, not a gentle reminder: it shows as soon as the page is ready and
 * keeps coming back every REPEAT_EVERY until nothing is owed. Same shape as the
 * profile reminder, but for money — an unpaid registration means the student
 * has an application that goes nowhere until they pay.
 */
const REPEAT_EVERY = 30_000;

/** Let the page paint first so the dialog never lands on a half-drawn screen. */
const FIRST_DELAY = 400;

function inr(rupees: number): string {
  const hasDecimals = rupees % 1 !== 0;
  return rupees.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export default function PaymentReminder() {
  // Fetched client-side on purpose: reading the session in the layout would
  // force every public page to server-render. Guests and admins get [] and
  // render nothing.
  const [unpaid, setUnpaid] = useState<UnpaidRegistration[] | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True once we have nagged at least once, so the next ask uses the steady
  // 30s delay instead of the short first-run one.
  const naggedRef = useRef(false);

  const owed = unpaid && unpaid.length > 0;

  const refresh = useCallback(async () => {
    try {
      setUnpaid(await getUnpaidRegistrations());
    } catch (error) {
      console.error("PaymentReminder error:", error);
    }
  }, []);

  // Fetched once on mount. Kept as a .then() chain rather than an
  // await-in-effect so the setState lands in a microtask, not during the
  // effect body.
  useEffect(() => {
    let active = true;
    getUnpaidRegistrations()
      .then((res) => {
        if (active) setUnpaid(res);
      })
      .catch((error) => console.error("PaymentReminder error:", error));
    return () => {
      active = false;
    };
  }, []);

  const arm = useCallback((delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPopupOpen(true), delay);
  }, []);

  /**
   * One cadence effect: shows as soon as the page is ready, then returns every
   * REPEAT_EVERY for as long as something is unpaid. Once the list comes back
   * empty — the payment landed — the popup never returns.
   */
  useEffect(() => {
    if (!owed) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    arm(naggedRef.current ? REPEAT_EVERY : FIRST_DELAY);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [arm, owed]);

  /**
   * Re-check whenever the popup closes. A payment made on another tab (or one
   * that finished while the dialog was open) should clear the nag instead of
   * waiting for the next tick.
   */
  function handleDismiss() {
    setPopupOpen(false);
    naggedRef.current = true;
    if (unpaid && unpaid.length > 0) arm(REPEAT_EVERY);
    void refresh();
  }

  function handlePay() {
    setPopupOpen(false);
    naggedRef.current = true;
    if (unpaid && unpaid.length > 0) arm(REPEAT_EVERY);
    // The apply drawer owns the payment flow, so send them straight there.
    const first = unpaid?.[0];
    window.location.href = first
      ? `/internships?pay=${first.internshipId}`
      : "/internships";
  }

  // Nothing owed (or signed out / admin) — stay out of the way entirely.
  if (!owed) return null;

  const rows = unpaid!;
  const total = rows.reduce((sum, r) => sum + r.amountDue, 0);

  return (
    <Dialog
      open={popupOpen}
      onOpenChange={(o) => {
        if (!o) handleDismiss();
      }}
    >
      {/* grid-rows pins the footer to the bottom of the popup and lets the
          scrollable body above it take the remaining height, so a long list of
          unpaid registrations scrolls instead of stretching the dialog past the
          viewport. min-h-0 on the body is what actually allows it to shrink. */}
      <DialogContent
        className="max-h-[85svh] grid-rows-[minmax(0,1fr)_auto] gap-0 p-0 sm:max-w-md"
        showCloseButton={false}
      >
        {/* No second animation wrapper in here — Base UI's own popup animation
            conflicts with an inner one and can leave it stuck open. */}
        <div className="min-h-0 overflow-y-auto overscroll-contain p-6 pb-4">
          <DialogHeader>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
              <TriangleAlert className="h-5 w-5 text-amber-500" />
            </div>
            <DialogTitle className="text-base">
              Complete your payment
            </DialogTitle>
            <DialogDescription>
              {rows.length === 1
                ? "You have an application that is still unpaid. Complete the payment to unlock your exams."
                : `You have ${rows.length} applications that are still unpaid. Complete the payments to unlock your exams.`}{" "}
              This will keep coming back until the payment is done.
            </DialogDescription>
          </DialogHeader>

          {/* min-w-0 so the truncating name can actually shrink; without it the
              flex item's min-content is the full nowrap string. */}
          <ul className="mt-4 space-y-2">
            {rows.map((r) => (
              <li
                key={r.internshipId}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {r.internshipName}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-500">
                  {inr(r.amountDue)}
                </span>
              </li>
            ))}
          </ul>

          {total > 0 && rows.length > 1 && (
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">
                Total due
              </span>
              <span className="text-sm font-bold text-amber-500">
                {inr(total)}
              </span>
            </div>
          )}

          {rows.some((r) => r.paymentStatus === "failed") && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              A previous payment attempt did not go through. You will be taken
              back to the payment screen.
            </p>
          )}
        </div>

        {/* Both actions stay in the footer row at every width. `shrink-0` on the
            icons stops the CreditCard glyph being squeezed flat, and the two
            buttons share the row evenly on sm+ while stacking on phones. */}
        <DialogFooter className="gap-2 border-t bg-muted/30 p-4 sm:justify-stretch">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="min-w-0 sm:flex-1"
          >
            <span className="truncate">Remind me in 30s</span>
          </Button>
          <Button onClick={handlePay} className="gap-1.5 sm:flex-1">
            <CreditCard className="h-4 w-4 shrink-0" />
            Pay Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}