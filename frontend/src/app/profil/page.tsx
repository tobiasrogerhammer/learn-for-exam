"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Camera, LogIn, LogOut, Monitor, Moon, Sun, Trash2, Undo2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getTheme, setTheme, type Theme } from "@/lib/theme";

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Lys", icon: Sun },
  { id: "dark", label: "Mørk", icon: Moon },
  { id: "system", label: "Som enheten", icon: Monitor },
];

const fieldClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

const errorText = (err: unknown) =>
  err instanceof Error ? err.message.replace(/^[\s\S]*Uncaught Error: /, "").split("\n")[0] : String(err);

/** Your account: name, picture, light or dark mode, sign out and delete */
export default function ProfilePage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const me = useQuery(api.users.me);
  const setName = useMutation(api.users.setName);
  const uploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const setAvatar = useMutation(api.users.setAvatar);
  const deleteAccount = useMutation(api.users.deleteAccount);

  const [name, setNameDraft] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>("light");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The saved choice lives in this browser, so it is read after the page loads
  useEffect(() => {
    const timer = window.setTimeout(() => setThemeState(getTheme()));
    return () => window.clearTimeout(timer);
  }, []);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (done) setMessage({ ok: true, text: done });
    } catch (err) {
      setMessage({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const uploadPicture = (file: File) =>
    run(async () => {
      if (!file.type.startsWith("image/")) throw new Error("Velg en bildefil");
      if (file.size > 2 * 1024 * 1024) throw new Error("Bildet må være under 2 MB");
      const url = await uploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) throw new Error("Kunne ikke laste opp bildet");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setAvatar({ storageId });
    }, "Profilbildet er oppdatert");

  const nameValue = name ?? me?.name ?? "";

  const appearance = (
    <section className="rounded-md border border-border/70 bg-card/80 p-5 shadow-sm">
      <h2 className="text-sm font-medium">Utseende</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Gjelder denne nettleseren.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Utseende">
        {THEMES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={theme === id}
            onClick={() => {
              setTheme(id);
              setThemeState(id);
            }}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
              theme === id
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border/70 bg-card/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen">
      <PageHeader title="Profil" />
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6">
        {isLoading ? null : !isAuthenticated ? (
          <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
            <p className="font-[family-name:var(--font-reading)] text-2xl">Du er ikke logget inn</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Logg inn med Google for å lagre fremgangen din og endre profilen.
            </p>
            <Button type="button" className="mt-5" onClick={() => void signIn("google")}>
              <LogIn className="size-3.5" />
              Logg inn med Google
            </Button>
          </section>
        ) : null}
        {isLoading ? null : !isAuthenticated ? (
          appearance
        ) : (
          <>
            <section className="rounded-md border border-border/70 bg-card/80 p-5 shadow-sm">
              <h2 className="text-sm font-medium">Profil</h2>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {me?.image ? (
                  // Pictures come from Google or Convex storage, so a plain img is simplest
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.image} alt="" className="size-16 rounded-full border border-border/70 object-cover" />
                ) : (
                  <span className="flex size-16 items-center justify-center rounded-full bg-muted text-xl font-medium text-muted-foreground">
                    {(me?.name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadPicture(file);
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                    <Camera className="size-3.5" />
                    Bytt bilde
                  </Button>
                  {me?.hasOwnImage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void run(() => setAvatar({ storageId: null }), "Bruker bildet fra Google igjen")}
                    >
                      <Undo2 className="size-3.5" />
                      Bruk bildet fra Google
                    </Button>
                  ) : null}
                </div>
              </div>

              <form
                className="mt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await setName({ name: nameValue });
                    setNameDraft(null);
                  }, "Navnet er lagret");
                }}
              >
                <label htmlFor="profil-navn" className="text-sm font-medium">
                  Navn
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="profil-navn"
                    value={nameValue}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={60}
                    placeholder={me?.googleName ?? "Navnet ditt"}
                    className={fieldClass}
                  />
                  <Button type="submit" disabled={busy || name === null}>
                    Lagre
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Vises på ideene du foreslår. Tomt felt gir navnet fra Google. Innlogget som {me?.email}.
                </p>
              </form>
              {message ? (
                <p className={`mt-3 text-sm ${message.ok ? "text-primary" : "text-destructive"}`} role="status">
                  {message.text}
                </p>
              ) : null}
            </section>

            {appearance}

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card/80 p-5 shadow-sm">
              <div>
                <h2 className="text-sm font-medium">Logg ut</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Fremgangen din ligger trygt på kontoen.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void signOut().then(() => router.push("/"));
                }}
              >
                <LogOut className="size-3.5" />
                Logg ut
              </Button>
            </section>

            <section className="rounded-md border border-destructive/40 bg-destructive/5 p-5">
              <h2 className="text-sm font-medium text-destructive">Slett konto</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sletter kontoen og alt som er lagret på den: markeringer, notater, oppsummeringer, svar,
                vurderinger, stemmer og ideene du har foreslått. Det kan ikke angres.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="mt-3"
                disabled={busy}
                onClick={() => {
                  const answer = window.prompt('Skriv «slett» for å slette kontoen for godt.');
                  if (answer?.trim().toLowerCase() !== "slett") return;
                  void run(async () => {
                    await deleteAccount();
                    await signOut();
                    router.push("/");
                  });
                }}
              >
                <Trash2 className="size-3.5" />
                Slett kontoen min
              </Button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
