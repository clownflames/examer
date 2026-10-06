"use client";

import { useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Plus,
  X,
  Check,
  Camera,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  updateMyProfile,
  getAvatarUploadUrl,
  type ProfileData,
} from "./actions";
import { authClient } from "@/lib/auth-client";

// =====================================================
// Types
// =====================================================
type Experience = {
  company: string;
  role: string;
  duration: string;
  description?: string;
};
type Project = {
  name: string;
  description?: string;
  link?: string;
  techStack?: string[];
};

// =====================================================
// MAIN
// =====================================================
export default function EditProfileDrawer({
  open,
  onClose,
  initialData,
  onUpdated,
  side = "right",
  heading = "Edit Profile",
  description = "Keep your profile updated to get better matches.",
}: {
  open: boolean;
  onClose: () => void;
  initialData: ProfileData;
  onUpdated: (d: Partial<ProfileData>) => void;
  /** The profile page uses a side panel; the reminder popup uses a bottom sheet. */
  side?: "right" | "bottom";
  heading?: string;
  description?: string;
}) {
  const [draft, setDraft] = useState<ProfileData>(initialData);
  const [isPending, startTransition] = useTransition();

  // chip inputs
  const [skillInput, setSkillInput] = useState("");
  const [langInput, setLangInput] = useState("");
  const [achievementInput, setAchievementInput] = useState("");

  function update<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // chip helpers
  function addChip(
    key: "skills" | "languages" | "achievements",
    value: string
  ) {
    const v = value.trim();
    if (!v) return;
    if (draft[key].includes(v)) return;
    update(key, [...draft[key], v] as any);
  }
  function removeChip(
    key: "skills" | "languages" | "achievements",
    value: string
  ) {
    update(key, draft[key].filter((x) => x !== value) as any);
  }

  // experience helpers
  function addExperience() {
    update("experience", [
      ...draft.experience,
      { company: "", role: "", duration: "", description: "" },
    ]);
  }
  function updateExperience(i: number, patch: Partial<Experience>) {
    const next = [...draft.experience];
    next[i] = { ...next[i], ...patch };
    update("experience", next);
  }
  function removeExperience(i: number) {
    update(
      "experience",
      draft.experience.filter((_, idx) => idx !== i)
    );
  }

  // project helpers
  function addProject() {
    update("projects", [
      ...draft.projects,
      { name: "", description: "", link: "", techStack: [] },
    ]);
  }
  function updateProject(i: number, patch: Partial<Project>) {
    const next = [...draft.projects];
    next[i] = { ...next[i], ...patch };
    update("projects", next);
  }
  function removeProject(i: number) {
    update(
      "projects",
      draft.projects.filter((_, idx) => idx !== i)
    );
  }

  // submit
  function handleSubmit() {
    startTransition(async () => {
      const res = await updateMyProfile({
        headline: draft.headline,
        bio: draft.bio,
        phone: draft.phone,
        collegeName: draft.collegeName,
        universityName: draft.universityName,
        degree: draft.degree,
        branch: draft.branch,
        rollNumber: draft.rollNumber,
        graduationYear: draft.graduationYear,
        cgpa: draft.cgpa,
        city: draft.city,
        state: draft.state,
        country: draft.country,
        pincode: draft.pincode,
        githubUrl: draft.githubUrl,
        linkedinUrl: draft.linkedinUrl,
        portfolioUrl: draft.portfolioUrl,
        twitterUrl: draft.twitterUrl,
        skills: draft.skills,
        languages: draft.languages,
        experience: draft.experience,
        projects: draft.projects,
        achievements: draft.achievements,
        resumeUrl: draft.resumeUrl,
        isPublic: draft.isPublic,
      });

      if (res.success) {
        toast.success("Profile updated");
        onUpdated(draft);
        onClose();
      } else {
        toast.error(res.error ?? "Failed to update");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={side}
        className={
          side === "bottom"
            ? "w-full p-0 flex flex-col max-h-[88vh] rounded-t-2xl"
            : "w-full sm:max-w-xl p-0 flex flex-col"
        }
      >
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>{heading}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="basic" className="text-xs">
                Basic
              </TabsTrigger>
              <TabsTrigger value="education" className="text-xs">
                Education
              </TabsTrigger>
              <TabsTrigger value="skills" className="text-xs">
                Skills
              </TabsTrigger>
              <TabsTrigger value="experience" className="text-xs">
                Exp
              </TabsTrigger>
              <TabsTrigger value="projects" className="text-xs">
                Projects
              </TabsTrigger>
            </TabsList>

            {/* BASIC */}
            <TabsContent value="basic" className="mt-6 space-y-4">
              {/* Avatar Uploader */}
              <AvatarUploader
                currentUrl={draft.userImage}
                userName={draft.userName}
                onUploaded={(url) => update("userImage", url)}
              />

              <Separator />

              <Field
                label="Headline"
                value={draft.headline}
                onChange={(v) => update("headline", v)}
                placeholder="Full Stack Developer | Final year CSE"
              />
              <div className="space-y-2">
                <Label className="text-xs">Bio</Label>
                <Textarea
                  rows={4}
                  value={draft.bio ?? ""}
                  onChange={(e) => update("bio", e.target.value)}
                  placeholder="Tell us about yourself..."
                />
              </div>
              <Field
                label="Phone"
                value={draft.phone}
                onChange={(v) => update("phone", v)}
                placeholder="+91 9876543210"
              />

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="City"
                  value={draft.city}
                  onChange={(v) => update("city", v)}
                />
                <Field
                  label="State"
                  value={draft.state}
                  onChange={(v) => update("state", v)}
                />
                <Field
                  label="Country"
                  value={draft.country}
                  onChange={(v) => update("country", v)}
                />
                <Field
                  label="Pincode"
                  value={draft.pincode}
                  onChange={(v) => update("pincode", v)}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="GitHub URL"
                  value={draft.githubUrl}
                  onChange={(v) => update("githubUrl", v)}
                />
                <Field
                  label="LinkedIn URL"
                  value={draft.linkedinUrl}
                  onChange={(v) => update("linkedinUrl", v)}
                />
                <Field
                  label="Portfolio URL"
                  value={draft.portfolioUrl}
                  onChange={(v) => update("portfolioUrl", v)}
                />
                <Field
                  label="Twitter URL"
                  value={draft.twitterUrl}
                  onChange={(v) => update("twitterUrl", v)}
                />
              </div>

              <Field
                label="Resume URL"
                value={draft.resumeUrl}
                onChange={(v) => update("resumeUrl", v)}
              />

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Public profile</p>
                  <p className="text-xs text-muted-foreground">
                    Others can see your profile
                  </p>
                </div>
                <Switch
                  checked={draft.isPublic}
                  onCheckedChange={(v) => update("isPublic", v)}
                />
              </div>
            </TabsContent>

            {/* EDUCATION */}
            <TabsContent value="education" className="mt-6 space-y-4">
              <Field
                label="College Name"
                value={draft.collegeName}
                onChange={(v) => update("collegeName", v)}
              />
              <Field
                label="University Name"
                value={draft.universityName}
                onChange={(v) => update("universityName", v)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Degree"
                  value={draft.degree}
                  onChange={(v) => update("degree", v)}
                />
                <Field
                  label="Branch"
                  value={draft.branch}
                  onChange={(v) => update("branch", v)}
                />
                <Field
                  label="Roll Number"
                  value={draft.rollNumber}
                  onChange={(v) => update("rollNumber", v)}
                />
                <Field
                  label="CGPA"
                  value={draft.cgpa}
                  onChange={(v) => update("cgpa", v)}
                />
              </div>
              <Field
                label="Graduation Year"
                value={draft.graduationYear?.toString() ?? ""}
                onChange={(v) =>
                  update("graduationYear", v ? Number(v) : null)
                }
                type="number"
              />
            </TabsContent>

            {/* SKILLS */}
            <TabsContent value="skills" className="mt-6 space-y-6">
              <ChipEditor
                label="Skills"
                chips={draft.skills}
                input={skillInput}
                onInputChange={setSkillInput}
                onAdd={() => {
                  addChip("skills", skillInput);
                  setSkillInput("");
                }}
                onRemove={(v) => removeChip("skills", v)}
                placeholder="React, Node.js, Python..."
              />
              <ChipEditor
                label="Languages"
                chips={draft.languages}
                input={langInput}
                onInputChange={setLangInput}
                onAdd={() => {
                  addChip("languages", langInput);
                  setLangInput("");
                }}
                onRemove={(v) => removeChip("languages", v)}
                placeholder="English, Hindi..."
              />
              <ChipEditor
                label="Achievements"
                chips={draft.achievements}
                input={achievementInput}
                onInputChange={setAchievementInput}
                onAdd={() => {
                  addChip("achievements", achievementInput);
                  setAchievementInput("");
                }}
                onRemove={(v) => removeChip("achievements", v)}
                placeholder="Won XYZ hackathon..."
              />
            </TabsContent>

            {/* EXPERIENCE */}
            <TabsContent value="experience" className="mt-6 space-y-4">
              {draft.experience.map((exp, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Experience #{i + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeExperience(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Role"
                        value={exp.role}
                        onChange={(v) => updateExperience(i, { role: v! })}
                      />
                      <Field
                        label="Company"
                        value={exp.company}
                        onChange={(v) => updateExperience(i, { company: v! })}
                      />
                    </div>
                    <Field
                      label="Duration"
                      value={exp.duration}
                      onChange={(v) => updateExperience(i, { duration: v! })}
                      placeholder="Jun 2024 - Aug 2024"
                    />
                    <div className="space-y-2">
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        rows={2}
                        value={exp.description ?? ""}
                        onChange={(e) =>
                          updateExperience(i, { description: e.target.value })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                variant="outline"
                onClick={addExperience}
                className="w-full"
              >
                <Plus className="w-4 h-4" />
                Add Experience
              </Button>
            </TabsContent>

            {/* PROJECTS */}
            <TabsContent value="projects" className="mt-6 space-y-4">
              {draft.projects.map((p, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Project #{i + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeProject(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Field
                      label="Name"
                      value={p.name}
                      onChange={(v) => updateProject(i, { name: v! })}
                    />
                    <div className="space-y-2">
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        rows={2}
                        value={p.description ?? ""}
                        onChange={(e) =>
                          updateProject(i, { description: e.target.value })
                        }
                      />
                    </div>
                    <Field
                      label="Link"
                      value={p.link!}
                      onChange={(v) => updateProject(i, { link: v! })}
                    />
                    <Field
                      label="Tech Stack (comma separated)"
                      value={(p.techStack ?? []).join(", ")}
                      onChange={(v) =>
                        updateProject(i, {
                          techStack: v!
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addProject} className="w-full">
                <Plus className="w-4 h-4" />
                Add Project
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================================================
// Avatar Uploader
// =====================================================
function AvatarUploader({
  currentUrl,
  userName,
  onUploaded,
}: {
  currentUrl: string | null;
  userName: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      // 1. presigned URL lo
      const res = await getAvatarUploadUrl(file.type, file.size);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }

      // 2. direct R2 pe upload karo
      const uploadRes = await fetch(res.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      // 3. Better Auth me user.image update karo
      const { error } = await authClient.updateUser({
        image: res.publicUrl,
      });
      if (error) throw new Error(error.message);

      setPreview(res.publicUrl);
      onUploaded(res.publicUrl);
      toast.success("Avatar updated!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar className="h-24 w-24 border-2 border-border">
          {preview ? <AvatarImage src={preview} alt={userName} /> : null}
          <AvatarFallback className="text-xl font-bold">
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full 
                     bg-primary text-primary-foreground flex items-center justify-center
                     hover:scale-105 active:scale-95 transition-transform 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     shadow-md"
          aria-label="Change avatar"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Click the camera icon to change your photo
        <br />
        JPG, PNG, WebP · Max 5MB
      </p>
    </div>
  );
}

// =====================================================
// Sub-components
// =====================================================
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
      />
    </div>
  );
}

function ChipEditor({
  label,
  chips,
  input,
  onInputChange,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  chips: string[];
  input: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Badge key={c} variant="secondary" className="gap-1 pr-1">
              {c}
              <button
                type="button"
                onClick={() => onRemove(c)}
                className="hover:bg-muted rounded-sm p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}