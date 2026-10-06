"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, Loader2, Sparkles } from "lucide-react";

import {
  getMyProfile,
  getProfileCompletionStatus,
  type ProfileCompletionStatus,
  type ProfileData,
} from "@/app/(website)/profile/actions";
import EditProfileDrawer from "@/app/(website)/profile/EditProfileDrawer";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// =====================================================
// CONSTANTS
// =====================================================

/** Above this the user has done enough — stop nagging. */
const DONE_AT = 80;

/**
 * Mandatory, not a gentle reminder: it shows as soon as the page is ready and
 * then keeps coming back every 30s until the profile is done.
 */
const REPEAT_EVERY = 30_000;

/**
 * Just enough to let the page paint first, so the dialog does not land on top
 * of a half-rendered screen on every reload.
 */
const FIRST_DELAY = 400;

export default function ProfileCompletionReminder() {
  // Fetched client-side on purpose: reading the session in the layout would
  // force every public page to server-render. Guests and admins get null and
  // render nothing.
  const [status, setStatus] = useState<ProfileCompletionStatus | null>(null);

  const [popupOpen, setPopupOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  // Null until fetched, so the drawer never opens with blank fields.
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Completion can change while the tab stays open (they save, or a second
  // tab updates), so keep a local copy instead of trusting the server prop.
  const [completion, setCompletion] = useState(0);

  const done = completion >= DONE_AT;

  const arm = useCallback((delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPopupOpen(true), delay);
  }, []);

  // True once we have nagged at least once, so the next ask uses the steady
  // 30s delay instead of the short first-run one.
  const naggedRef = useRef(false);

  // Who is this, and how far along is their profile?
  useEffect(() => {
    let active = true;
    getProfileCompletionStatus()
      .then((res) => {
        if (!active) return;
        setStatus(res);
        if (res) setCompletion(res.completion);
      })
      .catch((error) => console.error("ProfileCompletionReminder error:", error));
    return () => {
      active = false;
    };
  }, []);

  /**
   * One cadence effect, on purpose: the reminder shows as soon as the page is
   * ready, then returns every REPEAT_EVERY for as long as the profile is
   * incomplete. It pauses only while the edit drawer is already open, so the
   * popup never stacks on top of the form.
   */
  useEffect(() => {
    if (!status || done || drawerOpen) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    arm(naggedRef.current ? REPEAT_EVERY : FIRST_DELAY);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [arm, done, drawerOpen, status]);

  /** Popup dismissed: straight back in 30 seconds. */
  function handleDismiss() {
    setPopupOpen(false);
    naggedRef.current = true;
    if (!done) arm(REPEAT_EVERY);
  }

  /** "Complete Profile" — load the form, then swap the popup for the drawer. */
  async function handleStart() {
    setPopupOpen(false);
    naggedRef.current = true;

    if (profileData) {
      setDrawerOpen(true);
      return;
    }

    setLoadingProfile(true);
    try {
      const data = await getMyProfile();
      if (data) {
        setProfileData(data);
        setDrawerOpen(true);
      }
    } catch (error) {
      console.error("ProfileCompletionReminder error:", error);
    } finally {
      setLoadingProfile(false);
    }
  }

  function handleProfileUpdated(patch: Partial<ProfileData>) {
    if (profileData) setProfileData({ ...profileData, ...patch });

    // Recompute server-side so the popup and the profile page agree.
    void (async () => {
      try {
        const fresh = await getMyProfile();
        if (fresh) setCompletion(fresh.profileCompletion);
      } catch {
        // ignore — the next page load will correct it
      }
    })();
  }

  /**
   * Drawer closed without finishing. The cadence effect already re-arms when
   * `drawerOpen` flips back to false, so nothing to do here.
   */

  // Not signed in, an admin, or already 80%+ done — stay out of the way.
  if (!status || done) return null;

  const missing = status.missing;

  return (
    <>
      <Dialog
        open={popupOpen}
        onOpenChange={(o) => {
          if (!o) handleDismiss();
        }}
      >
        <DialogContent
          className="sm:max-w-md gap-0 p-0"
          showCloseButton={false}
        >
          {/* No extra animation wrapper in here: the popup's own
              animate-in/zoom-in handles the entrance, and a second
              animation engine inside Base UI's popup leaves it stuck
              in its ending state so it can never be dismissed. */}
          <div className="p-6 pb-4">
            <DialogHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-base">
                Complete your profile, {status.name.split(" ")[0]}
              </DialogTitle>
              <DialogDescription>
                Your profile is {completion}% complete. Students with a
                complete profile get matched with far more internships and
                rank higher on the tier list. It only takes a couple of
                minutes, and this will keep coming back until it is done.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Profile strength</span>
                <span className="font-bold text-primary">{completion}%</span>
              </div>
              <Progress value={completion} className="h-1.5" />
            </div>

            {missing.length > 0 && (
              <ul className="mt-4 space-y-2">
                {missing.slice(0, 4).map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    {item}
                  </li>
                ))}
                {missing.length > 4 && (
                  <li className="pl-6 text-[11px] text-muted-foreground/70">
                    + {missing.length - 4} more
                  </li>
                )}
              </ul>
            )}
          </div>

          <DialogFooter className="gap-2 border-t bg-muted/30 p-4 sm:justify-stretch">
            <Button
              variant="ghost"
              onClick={handleDismiss}
              disabled={loadingProfile}
              className="sm:flex-1"
            >
              Remind me in 30s
            </Button>
            <Button
              onClick={handleStart}
              disabled={loadingProfile}
              className="gap-1.5 sm:flex-1"
            >
              {loadingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Complete Profile
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The same editor as the profile page, opened from the bottom so the
          student fills it in without ever leaving this page. */}
      {profileData && (
        <EditProfileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          initialData={profileData}
          onUpdated={handleProfileUpdated}
          side="bottom"
          heading="Complete your profile"
          description={`You are ${completion}% done — fill in what is missing and save.`}
        />
      )}
    </>
  );
}