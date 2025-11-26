"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { addWeeks, format } from "date-fns"
import { Activity, Baby, Bell, CheckCircle2, HeartPulse, NotebookPen, Salad, Stethoscope, Thermometer, Users } from "lucide-react"
import type { User } from "firebase/auth"
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"

import { auth, db, firebaseReady, googleAuthProvider } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type SymptomSeverity = "mild" | "moderate" | "strong"

type SymptomEntry = {
  id: string
  symptom: string
  severity: SymptomSeverity
  notes: string
  loggedAt: string
}

type ReminderFrequency = 1 | 2 | 4

type MamacareProfile = {
  pregnancyWeek: number
  symptoms: SymptomEntry[]
  reminderFrequencyWeeks: ReminderFrequency
  customNotes: string
}

const defaultProfile: MamacareProfile = {
  pregnancyWeek: 12,
  symptoms: [],
  reminderFrequencyWeeks: 4,
  customNotes: "",
}

const TRIMESTER_GUIDANCE = {
  first: {
    label: "First trimester · Weeks 1-13",
    summary: "Build a folate-forward foundation to support neural tube development and fight fatigue.",
    focus: ["Dark leafy greens", "Citrus + berries", "Whole grains", "Vitamin B6 snacks"],
    watch: ["Limit caffeine to <200mg/day", "Skip unpasteurized foods", "Keep hydrated"],
  },
  second: {
    label: "Second trimester · Weeks 14-27",
    summary: "Protein, calcium, and omega-3s fuel rapid bone and brain growth.",
    focus: ["Lean protein every meal", "Greek yogurt & kefir", "Colorful produce", "Seeds + walnuts"],
    watch: ["Manage heartburn with smaller meals", "Add iron w/ vitamin C booster"],
  },
  third: {
    label: "Third trimester · Weeks 28-40",
    summary: "Prioritize magnesium, fiber, and smart carbs to prep for delivery and manage swelling.",
    focus: ["Complex carbs & legumes", "Magnesium-rich seeds", "Fermented veggies", "Hydrating soups"],
    watch: ["Balance sodium", "Elevate feet", "Increase fiber + water"],
  },
}

const SYMPTOM_LIBRARY = [
  {
    value: "nausea",
    label: "Morning sickness",
    foods: ["Ginger chews", "Plain crackers", "Cold citrus smoothies"],
    care: "Keep B6-rich mini meals within reach and avoid strong odors.",
  },
  {
    value: "fatigue",
    label: "Low energy",
    foods: ["Spinach omelet", "Chia pudding", "Roasted sweet potato"],
    care: "Pair iron with vitamin C and schedule restorative stretches.",
  },
  {
    value: "heartburn",
    label: "Heartburn",
    foods: ["Oat milk lattes", "Bananas", "Fennel tea"],
    care: "Stay upright after meals and choose smaller, frequent plates.",
  },
  {
    value: "swelling",
    label: "Water retention",
    foods: ["Cucumber mint water", "Citrus salads", "Unsalted nuts"],
    care: "Alternate ankle circles with short walks; keep electrolytes balanced.",
  },
  {
    value: "cramps",
    label: "Muscle cramps",
    foods: ["Magnesium-rich pumpkin seeds", "Plain yogurt", "Avocado toast"],
    care: "Blend magnesium + calcium boosts and stretch calves before bed.",
  },
]

const REMINDER_PRESETS: Record<ReminderFrequency, string> = {
  1: "Weekly check-ins (high-risk or IVF pregnancies)",
  2: "Bi-weekly visits (typical 3rd trimester cadence)",
  4: "Monthly visits (1st–2nd trimester routine)",
}

const COMMUNITY_TOPICS = [
  {
    title: "First kicks & big feelings",
    members: "12.4K parents sharing daily wins.",
    tags: ["Trimester 2", "Mindfulness"],
  },
  {
    title: "Meal prep for busy weeks",
    members: "8.1K recipes & grocery swaps.",
    tags: ["Dietitian tips", "Budget friendly"],
  },
  {
    title: "Cesarean & VBAC stories",
    members: "5.3K stories to help you plan confidently.",
    tags: ["Birth prep", "Care teams"],
  },
]

const ARTICLES = [
  {
    title: "Evidence-based prenatal supplement checklist",
    minutes: 6,
    tag: "Clinical",
    summary: "Compare OB/GYN approved prenatal blends and learn when to adjust iron or DHA.",
  },
  {
    title: "Symptom pairing: what your body is asking for",
    minutes: 4,
    tag: "Nutrition",
    summary: "Translate cravings, swelling, or headaches into nutrient targets.",
  },
  {
    title: "Partner playbook for trimester three",
    minutes: 5,
    tag: "Community",
    summary: "Micro-habits partners can take on to reduce stress before delivery.",
  },
]

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<MamacareProfile>(defaultProfile)
  const [symptomDraft, setSymptomDraft] = useState({
    symptom: SYMPTOM_LIBRARY[0].value,
    severity: "mild" as SymptomSeverity,
    notes: "",
  })
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deviceSync, setDeviceSync] = useState({ heartRate: true, steps: true })
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
  }, [])

  const trimesterKey = useMemo(() => {
    if (profile.pregnancyWeek <= 13) return "first"
    if (profile.pregnancyWeek <= 27) return "second"
    return "third"
  }, [profile.pregnancyWeek])

  const trimesterGuide = TRIMESTER_GUIDANCE[trimesterKey as keyof typeof TRIMESTER_GUIDANCE]

  const pregnancyProgress = Math.min(100, Math.round((profile.pregnancyWeek / 40) * 100))

  const latestSymptoms = profile.symptoms.slice(0, 4)
  const activeSymptomKeys = Array.from(new Set(latestSymptoms.map((item) => item.symptom)))

  const symptomDietBoosters = SYMPTOM_LIBRARY.filter((item) => activeSymptomKeys.includes(item.value))

  const personalizedDiet = useMemo(() => {
    return {
      headline: trimesterGuide.summary,
      focus: trimesterGuide.focus,
      watch: trimesterGuide.watch,
      symptoms: symptomDietBoosters,
    }
  }, [symptomDietBoosters, trimesterGuide])

  const nextCheckup = useMemo(() => {
    if (!now) return null
    return format(addWeeks(new Date(now), profile.reminderFrequencyWeeks), "EEE, MMM d")
  }, [now, profile.reminderFrequencyWeeks])

  const loadProfile = useCallback(
    async (authUser: User) => {
      if (!db) return
      setStatusMessage("Loading your Mamacare space…")
      const ref = doc(db, "mamacare_profiles", authUser.uid)
      const snapshot = await getDoc(ref)
      if (snapshot.exists()) {
        const data = snapshot.data() as MamacareProfile
        setProfile({
          pregnancyWeek: data.pregnancyWeek ?? defaultProfile.pregnancyWeek,
          symptoms: data.symptoms ?? [],
          reminderFrequencyWeeks: (data.reminderFrequencyWeeks as ReminderFrequency) ?? defaultProfile.reminderFrequencyWeeks,
          customNotes: data.customNotes ?? "",
        })
      } else {
        await setDoc(ref, { ...defaultProfile, uid: authUser.uid, createdAt: serverTimestamp() })
      }
      setStatusMessage(null)
    },
    [db]
  )

  const persistProfile = useCallback(
    async (updates: Partial<MamacareProfile>) => {
      if (!db || !user) return
      setSaving(true)
      setStatusMessage("Syncing to Firestore…")
      const ref = doc(db, "mamacare_profiles", user.uid)
      await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true })
      setSaving(false)
      setStatusMessage("Saved")
      setTimeout(() => setStatusMessage(null), 2500)
    },
    [db, user]
  )

  useEffect(() => {
    if (!auth || !firebaseReady) return
    const unsub = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser)
      if (authUser) {
        void loadProfile(authUser)
      } else {
        setProfile(defaultProfile)
      }
    })

    return () => unsub()
  }, [auth, loadProfile])

  const handleGoogleAuth = async () => {
    if (!auth) {
      setStatusMessage("Add your Firebase web keys to enable Google sign-in.")
      return
    }

    if (user) {
      await signOut(auth)
      setStatusMessage("Signed out")
      return
    }

    await signInWithPopup(auth, googleAuthProvider)
  }

  const updateWeek = async (week: number) => {
    setProfile((prev) => ({ ...prev, pregnancyWeek: week }))
    await persistProfile({ pregnancyWeek: week })
  }

  const handleSymptomSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const newEntry: SymptomEntry = {
      id: makeId(),
      symptom: symptomDraft.symptom,
      severity: symptomDraft.severity,
      notes: symptomDraft.notes || "No additional notes",
      loggedAt: new Date().toISOString(),
    }
    const updated = [newEntry, ...profile.symptoms].slice(0, 20)
    setProfile((prev) => ({ ...prev, symptoms: updated }))
    setSymptomDraft((prev) => ({ ...prev, notes: "" }))
    await persistProfile({ symptoms: updated })
  }

  const handleReminderChange = async (value: ReminderFrequency) => {
    setProfile((prev) => ({ ...prev, reminderFrequencyWeeks: value }))
    await persistProfile({ reminderFrequencyWeeks: value })
  }

  const symptomSummary = latestSymptoms.length
    ? `Tracking ${latestSymptoms.length} symptom${latestSymptoms.length > 1 ? "s" : ""} this month`
    : "Log symptoms to unlock extra nutrition tips"

  const firebaseAlert = !firebaseReady ? (
    <Alert variant="destructive">
      <AlertTitle>Firebase keys missing</AlertTitle>
      <AlertDescription>
        Add your Firebase web credentials to `.env.local` to enable Google sign-in and Firestore syncing.
      </AlertDescription>
    </Alert>
  ) : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffaf5] via-[#fff1ea] to-[#ffeae0] pb-24">
      <div className="hero-grid relative px-4 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-6">
            <p className="pill w-fit bg-white/70">Pregnancy wellness OS</p>
            <h1 className="section-heading">
              Mamacare keeps every trimester nourished, documented, and on schedule.
            </h1>
            <p className="text-lg text-muted-foreground">
              Log symptoms, get dietitian-backed food swaps, and never miss a prenatal checkup. Your Firebase-secured
              dashboard travels with you and your care team.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="bg-primary text-primary-foreground shadow-lg" onClick={handleGoogleAuth}>
                {user ? "Sign out of Mamacare" : "Continue with Google"}
              </Button>
              <Button size="lg" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" asChild>
                <a href="#dashboard">Preview dashboard</a>
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Encrypted with Firebase Auth
              </div>
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-accent" />
                Dietitian-authored guidance
              </div>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Custom prenatal reminders
              </div>
            </div>
          </div>
          <div className="relative mx-auto flex w-full max-w-md flex-col gap-4 rounded-3xl bg-white/80 p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 rounded-2xl bg-primary/5 p-4">
              <Baby className="h-10 w-10 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current week</p>
                <p className="text-2xl font-semibold text-primary">{profile.pregnancyWeek}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Due ETA</p>
                <p className="text-lg font-semibold">{nextCheckup ?? "—"}</p>
              </div>
            </div>
            <Image
              src="/design.webp"
              alt="Pregnancy companion preview"
              width={540}
              height={540}
              className="h-64 w-full rounded-2xl object-cover"
            />
            <div className="rounded-2xl border border-primary/20 p-4 text-sm text-muted-foreground">
              Securely backed by Firebase Authentication + Firestore. Export logs anytime for your OB team.
            </div>
          </div>
        </div>
      </div>

      <main id="dashboard" className="mx-auto mt-12 grid max-w-6xl gap-6 px-4 sm:px-6 lg:px-8">
        {firebaseAlert}
        {statusMessage && (
          <div className="rounded-xl border border-primary/20 bg-white px-4 py-3 text-sm text-primary shadow-sm">
            {saving ? "Saving…" : statusMessage}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">Pregnancy snapshot</CardTitle>
                  <CardDescription>Update your week to refresh the entire dashboard.</CardDescription>
                </div>
                <Badge variant="outline" className="text-primary">
                  {trimesterGuide.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Week {profile.pregnancyWeek} / 40</span>
                  <span>{pregnancyProgress}% journey complete</span>
                </div>
                <Progress value={pregnancyProgress} className="mt-3" />
                <input
                  type="range"
                  min={4}
                  max={40}
                  value={profile.pregnancyWeek}
                  onChange={(event) => updateWeek(Number(event.target.value))}
                  className="mt-4 w-full accent-primary"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {["Nutrition", "Symptoms", "Checkups"].map((item) => (
                  <div key={item} className="rounded-2xl border bg-secondary/40 p-4 text-sm font-medium text-secondary-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>{user ? `Signed in as ${user.email}` : "Create a secure Mamacare profile"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={handleGoogleAuth} variant={user ? "outline" : "default"}>
                {user ? "Sign out" : "Continue with Google"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Authentication is handled by Firebase OAuth. We only request your email to tie logs to your account.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Diet guidance</CardTitle>
                <CardDescription>{personalizedDiet.headline}</CardDescription>
              </div>
              <Salad className="h-10 w-10 text-primary" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Spotlight nutrients</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {personalizedDiet.focus.map((item) => (
                    <Badge key={item} variant="secondary">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
              {personalizedDiet.symptoms.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground">Symptom-specific boosters</p>
                  {personalizedDiet.symptoms.map((symptom) => (
                    <div key={symptom.value} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{symptom.label}</p>
                        <Badge variant="outline">{symptom.foods[0]}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{symptom.care}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {symptom.foods.map((food) => (
                          <span key={food} className="rounded-full bg-secondary/60 px-3 py-1">
                            {food}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Watch-outs</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {personalizedDiet.watch.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row justify-between">
              <div>
                <CardTitle>Symptom tracker</CardTitle>
                <CardDescription>{symptomSummary}</CardDescription>
              </div>
              <Thermometer className="h-10 w-10 text-primary" />
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-3" onSubmit={handleSymptomSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    value={symptomDraft.symptom}
                    onValueChange={(value) => setSymptomDraft((prev) => ({ ...prev, symptom: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Symptom" />
                    </SelectTrigger>
                    <SelectContent>
                      {SYMPTOM_LIBRARY.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={symptomDraft.severity}
                    onValueChange={(value: SymptomSeverity) =>
                      setSymptomDraft((prev) => ({ ...prev, severity: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mild">Mild</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="strong">Strong</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  rows={3}
                  value={symptomDraft.notes}
                  onChange={(event) => setSymptomDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Describe when the symptom shows up, triggers, or remedies…"
                />
                <Button type="submit" disabled={!user} className="w-full">
                  {user ? "Save symptom log" : "Sign in to save logs"}
                </Button>
              </form>
              <div className="space-y-3">
                {latestSymptoms.length === 0 && <p className="text-sm text-muted-foreground">No logs yet.</p>}
                {latestSymptoms.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {entry.symptom}
                        </Badge>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{entry.severity}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.loggedAt), "MMM d, h:mmaaa")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{entry.notes}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Checkup reminders</CardTitle>
                <CardDescription>Turn visits into a predictable rhythm.</CardDescription>
              </div>
              <Bell className="h-10 w-10 text-primary" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  value={profile.reminderFrequencyWeeks.toString()}
                  onValueChange={(value) => handleReminderChange(Number(value) as ReminderFrequency)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Reminder cadence" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REMINDER_PRESETS).map(([weeks, label]) => (
                      <SelectItem key={weeks} value={weeks}>
                        Every {weeks} week(s) — {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={profile.customNotes}
                  placeholder="Optional note for your OB team"
                  onChange={(event) => {
                    const note = event.target.value
                    setProfile((prev) => ({ ...prev, customNotes: note }))
                    void persistProfile({ customNotes: note })
                  }}
                />
              </div>
              <div className="rounded-2xl border bg-secondary/30 p-4 text-sm">
                <p className="font-semibold text-secondary-foreground">Next reminder</p>
                <p className="mt-1 text-lg font-semibold text-primary">{nextCheckup ?? "—"}</p>
                <p className="text-muted-foreground">
                  We&apos;ll nudge you {profile.reminderFrequencyWeeks === 1 ? "every week" : `every ${profile.reminderFrequencyWeeks} weeks`} with a prep checklist.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {["Blood pressure log", "Bump measurements", "Birth plan notes"].map((item) => (
                  <div key={item} className="rounded-2xl border p-4 text-sm font-medium text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Device sync</CardTitle>
                <CardDescription>Bridge Mamacare with wearable insights.</CardDescription>
              </div>
              <Activity className="h-10 w-10 text-primary" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Apple Health / Google Fit</p>
                  <p className="text-xs text-muted-foreground">Auto-import steps & sleep</p>
                </div>
                <Switch checked={deviceSync.steps} onCheckedChange={(checked) => setDeviceSync((prev) => ({ ...prev, steps: checked }))} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Heart rate monitor</p>
                  <p className="text-xs text-muted-foreground">Sync resting BPM for early warnings</p>
                </div>
                <Switch
                  checked={deviceSync.heartRate}
                  onCheckedChange={(checked) => setDeviceSync((prev) => ({ ...prev, heartRate: checked }))}
                />
              </div>
              <Button variant="outline" className="w-full border-dashed border-primary/40 text-primary">
                Connect a device
              </Button>
              <p className="text-xs text-muted-foreground">
                Device data is stored in your Firestore document and never shared without your consent.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Community rooms</CardTitle>
                <CardDescription>Peer-led support moderated by Mamacare doulas.</CardDescription>
              </div>
              <Users className="h-10 w-10 text-primary" />
            </CardHeader>
            <CardContent className="space-y-4">
              {COMMUNITY_TOPICS.map((topic) => (
                <div key={topic.title} className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold">{topic.title}</p>
                      <p className="text-sm text-muted-foreground">{topic.members}</p>
                    </div>
                    <Button variant="outline" className="border-primary/30 text-primary">
                      Join room
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {topic.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-secondary/70 px-3 py-1">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resource hub</CardTitle>
              <CardDescription>Articles vetted by OB/GYNs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {ARTICLES.map((article) => (
                <div key={article.title} className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                    <span>{article.tag}</span>
                    <span>{article.minutes} min read</span>
                  </div>
                  <p className="mt-2 text-base font-semibold">{article.title}</p>
                  <p className="text-sm text-muted-foreground">{article.summary}</p>
                  <Button variant="link" className="px-0 text-primary">
                    Read article →
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-dashed border-primary/30">
            <CardHeader className="flex flex-row items-center gap-3">
              <Stethoscope className="h-10 w-10 text-primary" />
              <div>
                <CardTitle>Care team sharing</CardTitle>
                <CardDescription>Generate a secure link for your OB or doula.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export diet logs, symptom history, and appointment cadence as a PDF or share a live Firestore-powered
                dashboard.
              </p>
              <div className="rounded-2xl border bg-white px-4 py-3 text-sm font-mono">
                https://mamacare.app/share/<span className="text-primary">your-code</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button>Copy secure link</Button>
                <Button variant="outline">Download PDF</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed border-accent/30">
            <CardHeader className="flex flex-row items-center gap-3">
              <NotebookPen className="h-10 w-10 text-accent" />
              <div>
                <CardTitle>Daily reflection</CardTitle>
                <CardDescription>Capture moods to pair with symptoms.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="How did your body feel today? Any wins to celebrate?" rows={4} />
              <Button variant="outline" className="border-accent/40 text-accent">
                Save reflection
              </Button>
              <p className="text-xs text-muted-foreground">
                Reflections sync to Firestore so your future self can celebrate progress.
              </p>
            </CardContent>
          </Card>
        </section>

        <footer className="mt-6 rounded-3xl border bg-white/80 p-6 text-center text-sm text-muted-foreground">
          © {(now ? new Date(now).getFullYear() : "—")} Mamacare · Built with Firebase Authentication, Firestore, and a whole lot of love
          for growing families.
        </footer>
      </main>
    </div>
  )
}
