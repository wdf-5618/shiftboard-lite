import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase.js";

const STORAGE_KEY = "shiftboard-lite.v1";
const SHIFT_TYPES = [
  { id: "opening", label: "Opening", start: "08:00", end: "12:00", tone: "green" },
  { id: "day", label: "Day", start: "12:00", end: "16:00", tone: "blue" },
  { id: "closing", label: "Closing", start: "16:00", end: "20:00", tone: "rose" },
];
const NAV = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "schedule", label: "Schedule", icon: "▣" },
  { id: "team", label: "Team", icon: "♙" },
  { id: "coverage", label: "Coverage", icon: "✓" },
];
const INITIAL_TEAM = [
  { id: "staff-1", name: "Maya Chen", role: "Team lead", initials: "MC", color: "#e7c6ad" },
  { id: "staff-2", name: "Noah Williams", role: "Service specialist", initials: "NW", color: "#bdd9c8" },
  { id: "staff-3", name: "Ava Patel", role: "Service specialist", initials: "AP", color: "#d9c7ed" },
  { id: "staff-4", name: "Leo Martin", role: "Operations", initials: "LM", color: "#f0d69e" },
  { id: "staff-5", name: "Sofia Reyes", role: "Service specialist", initials: "SR", color: "#b9d5e9" },
];
const COLORS = ["#e7c6ad", "#bdd9c8", "#d9c7ed", "#f0d69e", "#b9d5e9", "#efc3c7"];
const inputClass = "w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-[#a0aaa5] focus:border-[#91b67b] focus:ring-4 focus:ring-[#e5f1dc]";

function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }
function parseDate(key) {
  const p = String(key || "").split("-").map(Number);
  return p.length === 3 && p.every(Number.isFinite) ? new Date(p[0], p[1] - 1, p[2]) : new Date();
}
function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}
function mondayOf(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return start;
}
function dateLabel(key, options = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en", options).format(parseDate(key));
}
function timeLabel(value) {
  const p = String(value).split(":").map(Number);
  return new Date(2000, 0, 1, p[0] || 0, p[1] || 0).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
}
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0] || "").join("").toUpperCase(); }
function idFor(prefix) { return prefix + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
function shiftType(id) { return SHIFT_TYPES.find((t) => t.id === id) || SHIFT_TYPES[0]; }
function duration(shift) {
  const t = shiftType(shift.type);
  const [sh, sm] = t.start.split(":").map(Number);
  const [eh, em] = t.end.split(":").map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}
function overlaps(a, b) {
  const ta = shiftType(a.type), tb = shiftType(b.type);
  const min = (value) => { const p = value.split(":").map(Number); return p[0] * 60 + p[1]; };
  return min(ta.start) < min(tb.end) && min(tb.start) < min(ta.end);
}
function seedShifts() {
  const start = mondayOf(new Date());
  const plan = [
    [0, "opening", "staff-1"], [0, "day", "staff-2"], [0, "closing", "staff-4"],
    [1, "opening", "staff-3"], [1, "day", "staff-1"], [1, "closing", null],
    [2, "opening", "staff-2"], [2, "day", "staff-5"], [2, "closing", "staff-3"],
    [3, "opening", "staff-4"], [3, "day", "staff-2"], [3, "closing", "staff-1"],
    [4, "opening", "staff-5"], [4, "day", "staff-3"], [4, "closing", null],
    [5, "opening", "staff-1"], [5, "day", "staff-4"],
    [6, "opening", "staff-2"], [6, "closing", "staff-5"],
  ];
  return plan.map((item, index) => ({ id: "shift-seed-" + (index + 1), date: dateKey(addDays(start, item[0])), type: item[1], staffId: item[2], note: "" }));
}
function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (Array.isArray(v.staff) && Array.isArray(v.shifts)) {
        return {
          staff: v.staff.filter((m) => m && typeof m.id === "string" && typeof m.name === "string"),
          shifts: v.shifts.filter((s) => s && typeof s.id === "string" && typeof s.date === "string" && SHIFT_TYPES.some((t) => t.id === s.type)),
        };
      }
    }
  } catch (error) { console.warn("ShiftBoard Lite could not load local data.", error); }
  return { staff: INITIAL_TEAM, shifts: seedShifts() };
}
function Avatar({ member, size = "md" }) {
  return <span className={"flex shrink-0 items-center justify-center rounded-full font-bold text-ink " + (size === "lg" ? "h-12 w-12 text-sm" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs")} style={{ backgroundColor: member?.color || "#dce5d9" }}>{member?.initials || initials(member?.name || "?")}</span>;
}
function Button({ children, kind = "primary", className = "", onClick, type = "button" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2";
  const variant = kind === "primary" ? "bg-forest text-white hover:bg-[#2d5148] focus-visible:outline-forest" : kind === "soft" ? "bg-[#edf3e8] text-forest hover:bg-[#e1ecd7] focus-visible:outline-forest" : kind === "danger" ? "border border-[#f3d7d2] bg-[#fff7f5] text-[#a64b3c] hover:bg-[#ffebe7]" : kind === "ghost" ? "text-muted hover:bg-[#eff1eb] hover:text-ink" : "border border-line bg-white text-ink hover:bg-[#f7f8f4]";
  return <button type={type} className={base + " " + variant + " " + className} onClick={onClick}>{children}</button>;
}
function StatCard({ label, value, detail, icon, tint }) {
  return <article className="rounded-2xl border border-line bg-white p-5 shadow-[0_2px_8px_rgba(31,42,42,0.025)]"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-muted">{label}</p><span className={"flex h-9 w-9 items-center justify-center rounded-xl text-lg " + tint}>{icon}</span></div><p className="mt-4 text-3xl font-semibold tracking-tight text-ink">{value}</p><p className="mt-1 text-xs text-muted">{detail}</p></article>;
}
function Title({ eyebrow, title, description, action }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.19em] text-[#81908a]">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-[34px]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p></div>{action}</div>;
}
function Field({ label, children, hint }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-ink">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}</label>;
}
function ShiftCard({ shift, member, onEdit }) {
  const type = shiftType(shift.type);
  const tone = type.tone === "green" ? "border-l-[#83b765] bg-[#f2f8ed]" : type.tone === "blue" ? "border-l-[#7ba7cb] bg-[#f0f5fa]" : "border-l-[#df9d8f] bg-[#fff3ef]";
  return <button type="button" onClick={onEdit} className={"group block w-full rounded-xl border border-line border-l-[3px] p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm " + tone}><div className="flex items-start justify-between gap-1"><span className="text-[10px] font-bold uppercase tracking-wide text-muted">{type.label}</span><span className="text-xs text-muted opacity-0 group-hover:opacity-100">Edit</span></div><p className="mt-1.5 text-xs font-bold leading-4 text-ink">{member?.name || "Open shift"}</p><p className="mt-1.5 text-[10px] text-muted">{timeLabel(type.start)} – {timeLabel(type.end)}</p>{!member && <span className="mt-2 inline-flex rounded-full bg-[#fff0d7] px-2 py-0.5 text-[9px] font-bold text-[#966b29]">Needs cover</span>}</button>;
}
function EmptyState({ title, description, action }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dbe2d8] bg-[#fbfcf9] px-6 py-8 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf3e8] text-forest text-2xl">▣</span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}
function Modal({ title, description, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#14211f]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="modal-title" className="text-xl font-semibold">{title}</h2><p className="mt-1.5 text-sm leading-5 text-muted">{description}</p></div><button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-xl p-2 text-muted hover:bg-[#f1f3ed] hover:text-ink">×</button></div>{children}</section></div>;
}


function mapStaffRow(row) {
  return { id: row.id, name: row.name, role: row.role, initials: row.initials || initials(row.name), color: row.color || "#dce5d9" };
}
function mapShiftRow(row) {
  return { id: row.id, date: row.shift_date, type: row.shift_type, staffId: row.staff_member_id || null, note: row.note || "" };
}
function LoadingScreen({ message = "Loading your workspace…" }) {
  return <div className="flex min-h-screen items-center justify-center bg-canvas px-5 text-ink"><div className="w-full max-w-sm rounded-3xl border border-line bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-forest text-xl font-black text-white">S</div><h1 className="mt-5 text-xl font-semibold">ShiftBoard Lite</h1><p className="mt-2 text-sm text-muted">{message}</p></div></div>;
}
function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMessage("Account created. Check your email for the confirmation link, then sign in here.");
      } else {
        setMessage("Signed in. Loading your private workspace…");
      }
    } catch (err) {
      setError(err?.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 text-ink">
    <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-[0_8px_36px_rgba(31,42,42,0.06)] sm:p-8">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-forest text-lg font-black text-white">S</span><div><p className="text-lg font-bold tracking-tight">ShiftBoard Lite</p><p className="text-xs text-muted">Staff scheduling workspace</p></div></div>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{mode === "signin" ? "Welcome back" : "Create your workspace"}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{mode === "signin" ? "Sign in to view and manage your team's schedule." : "Create an account to save your team's schedule to your own database workspace."}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        {error && <div role="alert" className="rounded-xl border border-[#f0d0ca] bg-[#fff5f2] px-3.5 py-3 text-sm text-[#9d4537]">{error}</div>}
        {message && <div role="status" className="rounded-xl border border-[#d8e7ce] bg-[#f4f9ef] px-3.5 py-3 text-sm text-forest">{message}</div>}
        <Field label="Email address"><input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></Field>
        <Field label="Password" hint={mode === "signup" ? "Use at least 8 characters." : undefined}><input className={inputClass} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "signup" ? 8 : undefined} required /></Field>
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d5148] disabled:cursor-wait disabled:opacity-60">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">{mode === "signin" ? "New to ShiftBoard Lite?" : "Already have an account?"}{" "}<button type="button" className="font-semibold text-forest underline underline-offset-4" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>{mode === "signin" ? "Create an account" : "Sign in"}</button></p>
      <p className="mt-6 border-t border-line pt-4 text-xs leading-5 text-muted">Use fictional staff details for this learning project. Your schedule is scoped to your signed-in account.</p>
    </div>
  </div>;
}

export default function App() {
  const todayKey = dateKey(new Date());
  const cloudEnabled = Boolean(supabase);
  const [authSession, setAuthSession] = useState(null);
  const [authReady, setAuthReady] = useState(!cloudEnabled);
  const [workspace, setWorkspace] = useState(null);
  const [cloudLoading, setCloudLoading] = useState(cloudEnabled);
  const [cloudError, setCloudError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saved, setSaved] = useState(() => cloudEnabled ? { staff: [], shifts: [] } : loadState());
  const [view, setView] = useState("overview");
  const [weekOffset, setWeekOffset] = useState(0);
  const [modal, setModal] = useState(null);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("open");
  const [shiftForm, setShiftForm] = useState({ date: todayKey, type: "opening", staffId: "", note: "" });
  const [teamForm, setTeamForm] = useState({ name: "", role: "Service specialist" });

  useEffect(() => {
    if (cloudEnabled) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
    catch (e) { console.warn("ShiftBoard Lite could not save local data.", e); }
  }, [saved, cloudEnabled]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setCloudError(sessionError.message);
      setAuthSession(data?.session || null);
      setAuthReady(true);
      setCloudLoading(Boolean(data?.session));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setAuthSession(nextSession);
      if (nextSession) {
        setCloudLoading(true);
        setCloudError("");
      } else {
        setWorkspace(null);
        setSaved({ staff: [], shifts: [] });
        setCloudLoading(false);
        setCloudError("");
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!cloudEnabled || !authSession?.user?.id) return undefined;
    let active = true;
    async function loadWorkspace() {
      setCloudLoading(true);
      setCloudError("");
      try {
        const user = authSession.user;
        let { data: currentWorkspace, error: workspaceError } = await supabase
          .from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
        if (workspaceError) throw workspaceError;
        if (!currentWorkspace) {
          const created = await supabase.from("workspaces")
            .insert({ owner_id: user.id, name: "Northstar Services" }).select("*").single();
          if (created.error && created.error.code !== "23505") throw created.error;
          if (created.data) currentWorkspace = created.data;
          else {
            const retry = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
            if (retry.error) throw retry.error;
            currentWorkspace = retry.data;
          }
        }
        if (!currentWorkspace) throw new Error("Your workspace could not be loaded. Please try again.");

        const [staffResult, shiftsResult] = await Promise.all([
          supabase.from("staff_members").select("*").eq("workspace_id", currentWorkspace.id).order("created_at"),
          supabase.from("shifts").select("*").eq("workspace_id", currentWorkspace.id).order("shift_date").order("shift_type"),
        ]);
        if (staffResult.error) throw staffResult.error;
        if (shiftsResult.error) throw shiftsResult.error;
        let staffRows = staffResult.data || [];
        let shiftRows = shiftsResult.data || [];

        if (staffRows.length === 0 && shiftRows.length === 0) {
          const seededStaff = await supabase.from("staff_members").insert(
            INITIAL_TEAM.map((member) => ({
              workspace_id: currentWorkspace.id,
              name: member.name,
              role: member.role,
              initials: member.initials,
              color: member.color,
            }))
          ).select("*");
          if (seededStaff.error) throw seededStaff.error;
          staffRows = seededStaff.data || [];
          const idByInitials = new Map(staffRows.map((member) => [member.initials, member.id]));
          const seedRows = seedShifts().map((shift) => {
            const originalMember = INITIAL_TEAM.find((member) => member.id === shift.staffId);
            return {
              workspace_id: currentWorkspace.id,
              staff_member_id: originalMember ? idByInitials.get(originalMember.initials) || null : null,
              shift_date: shift.date,
              shift_type: shift.type,
              note: shift.note || "",
            };
          });
          const seededShifts = await supabase.from("shifts").insert(seedRows);
          if (seededShifts.error) throw seededShifts.error;
          const [staffReload, shiftReload] = await Promise.all([
            supabase.from("staff_members").select("*").eq("workspace_id", currentWorkspace.id).order("created_at"),
            supabase.from("shifts").select("*").eq("workspace_id", currentWorkspace.id).order("shift_date").order("shift_type"),
          ]);
          if (staffReload.error) throw staffReload.error;
          if (shiftReload.error) throw shiftReload.error;
          staffRows = staffReload.data || [];
          shiftRows = shiftReload.data || [];
        }

        if (!active) return;
        setWorkspace(currentWorkspace);
        setSaved({ staff: staffRows.map(mapStaffRow), shifts: shiftRows.map(mapShiftRow) });
      } catch (err) {
        if (active) setCloudError(err?.message || "The workspace could not be loaded.");
      } finally {
        if (active) setCloudLoading(false);
      }
    }
    loadWorkspace();
    return () => { active = false; };
  }, [cloudEnabled, authSession?.user?.id, loadAttempt]);

  const weekStart = useMemo(() => addDays(mondayOf(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = addDays(weekStart, i); return { date: d, key: dateKey(d), weekday: d.toLocaleDateString("en", { weekday: "short" }), num: d.getDate() }; }), [weekStart]);
  const startKey = days[0].key;
  const endKey = days[6].key;
  const weekShifts = useMemo(() => saved.shifts.filter((s) => s.date >= startKey && s.date <= endKey).slice().sort((a, b) => a.date.localeCompare(b.date) || shiftType(a.type).start.localeCompare(shiftType(b.type).start)), [saved.shifts, startKey, endKey]);
  const openShifts = weekShifts.filter((s) => !s.staffId);
  const assigned = weekShifts.length - openShifts.length;
  const hours = weekShifts.reduce((sum, s) => sum + duration(s), 0);
  const coverage = weekShifts.length ? Math.round(assigned / weekShifts.length * 100) : 0;
  const weekLabel = dateLabel(startKey, { month: "short", day: "numeric" }) + " – " + dateLabel(endKey, { month: "short", day: "numeric", year: weekStart.getFullYear() !== addDays(weekStart, 6).getFullYear() ? "numeric" : undefined });
  const todayShifts = saved.shifts.filter((s) => s.date === todayKey).sort((a, b) => shiftType(a.type).start.localeCompare(shiftType(b.type).start));
  const pageLabel = NAV.find((n) => n.id === view)?.label || "Overview";
  const filteredTeam = saved.staff.filter((m) => (m.name + " " + m.role).toLowerCase().includes(teamSearch.toLowerCase()));
  const coverageList = coverageFilter === "open" ? weekShifts.filter((s) => !s.staffId) : coverageFilter === "assigned" ? weekShifts.filter((s) => !!s.staffId) : weekShifts;

  function toastMessage(message) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  function memberFor(staffId) { return saved.staff.find((member) => member.id === staffId) || null; }
  function addShift(date = "") {
    setEditingShiftId(null);
    setShiftForm({ date: date || (todayKey >= startKey && todayKey <= endKey ? todayKey : startKey), type: "opening", staffId: "", note: "" });
    setError("");
    setModal("shift");
  }
  function editShift(shift) {
    setEditingShiftId(shift.id);
    setShiftForm({ date: shift.date, type: shift.type, staffId: shift.staffId || "", note: shift.note || "" });
    setError("");
    setModal("shift");
  }
  function saveShift(event) {
    event.preventDefault(); setError("");
    const item = { id: editingShiftId || idFor("shift"), date: shiftForm.date, type: shiftForm.type, staffId: shiftForm.staffId || null, note: shiftForm.note.trim() };
    if (!item.date || !SHIFT_TYPES.some((t) => t.id === item.type)) { setError("Choose a valid date and shift window."); return; }
    if (item.staffId && saved.shifts.some((s) => s.id !== editingShiftId && s.staffId === item.staffId && s.date === item.date && overlaps(s, item))) {
      setError("That team member already has an overlapping shift on this date. Choose another person or time."); return;
    }
    setSaved((current) => ({ ...current, shifts: editingShiftId ? current.shifts.map((s) => s.id === editingShiftId ? item : s) : current.shifts.concat(item) }));
    setModal(null);
    toastMessage(editingShiftId ? "Shift updated." : item.staffId ? "Shift added to the schedule." : "Open shift added to coverage.");
  }
  function removeShift() {
    if (!editingShiftId || !window.confirm("Delete this shift from the local demo schedule?")) return;
    setSaved((current) => ({ ...current, shifts: current.shifts.filter((s) => s.id !== editingShiftId) }));
    setModal(null); toastMessage("Shift deleted.");
  }
  function addTeamMember(event) {
    event.preventDefault(); setError("");
    const name = teamForm.name.trim();
    if (name.length < 2) { setError("Enter a team member name."); return; }
    const person = { id: idFor("staff"), name, role: teamForm.role, initials: initials(name), color: COLORS[saved.staff.length % COLORS.length] };
    setSaved((current) => ({ ...current, staff: current.staff.concat(person) }));
    setTeamForm({ name: "", role: "Service specialist" }); setModal(null); toastMessage(name + " added to the team.");
  }
  function resetDemo() {
    if (!window.confirm("Reset this browser's demo schedule to the sample data?")) return;
    setSaved({ staff: INITIAL_TEAM, shifts: seedShifts() }); setWeekOffset(0); setView("overview"); toastMessage("Demo data reset.");
  }

  return <div className="min-h-screen bg-canvas text-ink">
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="flex flex-col bg-forest px-5 pb-4 pt-5 text-white lg:sticky lg:top-0 lg:h-screen">
        <button type="button" onClick={() => setView("overview")} className="flex items-center gap-3 px-2 text-left text-white"><span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-leaf text-lg font-black text-forest">S</span><span><span className="block text-[17px] font-bold tracking-tight">shiftboard</span><span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">lite workspace</span></span></button>
        <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-white/45">Workspace</p><div className="mt-2 flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">NS</span><span><span className="block text-sm font-semibold">Northstar Services</span><span className="mt-0.5 block text-xs text-white/45">Demo team · {saved.staff.length} members</span></span></div></div>
        <p className="mb-2 mt-7 px-3 text-[10px] font-bold uppercase tracking-[0.17em] text-white/40">Workspace</p>
        <nav className="flex flex-wrap gap-1 lg:block lg:space-y-1" aria-label="Main navigation">
          {NAV.map((n) => <button key={n.id} type="button" onClick={() => setView(n.id)} className={"flex min-w-[calc(50%-4px)] flex-1 items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition lg:w-full " + (view === n.id ? "bg-leaf text-forest shadow-sm" : "text-white/65 hover:bg-white/[0.08] hover:text-white")}><span className="w-5 text-center text-base">{n.icon}</span><span>{n.label}</span>{n.id === "coverage" && openShifts.length > 0 && <span className={"ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold " + (view === n.id ? "bg-forest/10 text-forest" : "bg-white/10 text-white")}>{openShifts.length}</span>}</button>)}
        </nav>
        <div className="mt-6 hidden rounded-2xl border border-white/10 bg-white/[0.05] p-4 lg:mt-auto lg:block"><div className="flex items-center gap-2 text-leaf"><span>✓</span><span className="text-xs font-bold">Local demo mode</span></div><p className="mt-2 text-xs leading-5 text-white/50">Your sample schedule stays in this browser. It is not shared with a real team.</p><button type="button" onClick={resetDemo} className="mt-3 text-xs font-semibold text-white/70 underline decoration-white/25 underline-offset-4 hover:text-white">Reset demo data</button></div>
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 px-2 pt-4"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7c6ad] text-xs font-bold text-ink">TP</span><span><span className="block text-sm font-semibold">Workspace owner</span><span className="block text-xs text-white/45">Learning project</span></span></div>
      </aside>

      <main id="main" className="min-w-0 px-4 pb-10 pt-5 sm:px-7 lg:px-10 lg:pt-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5"><div className="flex items-center gap-2 text-xs font-medium text-muted"><span>Northstar Services</span><span className="text-[#a4aea7]">/</span><span className="text-ink">{pageLabel}</span></div><div className="flex items-center gap-3"><span className="hidden rounded-lg bg-white px-3 py-2 text-xs text-muted shadow-sm sm:inline-flex"><span className="mr-2 text-[#7f8a85]">Today</span>{dateLabel(todayKey, { weekday: "short", month: "short", day: "numeric" })}</span><Avatar member={{ name: "Thet Paing", initials: "TP", color: "#e7c6ad" }} /></div></header>

        {view === "overview" && <>
          <Title eyebrow="YOUR WEEK, AT A GLANCE" title="Good morning, team." description="A clear plan helps everyone know where they need to be and when." action={<Button onClick={() => addShift()}><span className="text-lg leading-none">+</span> Add shift</Button>} />
          <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Shifts planned" value={weekShifts.length} detail={weekLabel} icon="▣" tint="bg-[#edf3e8] text-forest" /><StatCard label="Open shifts" value={openShifts.length} detail={openShifts.length ? "Need a team member" : "Everything has an owner"} icon="◷" tint="bg-[#fff1dd] text-[#946a2a]" /><StatCard label="Team members" value={saved.staff.length} detail="In this demo workspace" icon="♙" tint="bg-[#eaf1fb] text-[#5577a9]" /><StatCard label="Hours planned" value={hours + "h"} detail="All shifts this week" icon="✓" tint="bg-[#fbece9] text-[#b56656]" /></div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
            <section className="rounded-2xl border border-line bg-white p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">This week</h2><p className="mt-1 text-xs text-muted">{weekLabel}</p></div><Button kind="soft" onClick={() => setView("schedule")}>Open schedule <span>→</span></Button></div><div className="space-y-4">{days.map((day) => { const count = weekShifts.filter((s) => s.date === day.key).length; return <div key={day.key} className="grid grid-cols-[60px_minmax(0,1fr)_30px] items-center gap-3"><span><span className="block text-xs font-semibold">{day.weekday}</span><span className="mt-0.5 block text-[11px] text-muted">{day.num} {day.date.toLocaleDateString("en", { month: "short" })}</span></span><span className="h-2 overflow-hidden rounded-full bg-[#eef0eb]"><span className="block h-full rounded-full bg-[#8dbd68]" style={{ width: Math.min(100, count / 4 * 100) + "%" }} /></span><span className="text-right text-xs font-semibold text-muted">{count}</span></div>; })}</div><div className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-[#8dbd68]" /> Shifts scheduled each day <span className="ml-auto">Count</span></div></section>
            <section className="rounded-2xl border border-line bg-white p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Coverage snapshot</h2><p className="mt-1 text-xs text-muted">Assigned shifts this week</p></div><span className="rounded-xl bg-[#edf3e8] px-2.5 py-1.5 text-xs font-bold text-forest">{coverage}%</span></div><div className="mt-6 flex items-center gap-5"><div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full" style={{ background: "conic-gradient(#8dbd68 " + coverage + "%, #edf0e8 0)" }}><div className="flex h-[84px] w-[84px] flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-semibold">{assigned}</span><span className="text-[10px] text-muted">assigned</span></div></div><div className="space-y-3 text-sm"><p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#8dbd68]" /><span className="text-muted">Assigned</span><strong className="ml-4">{assigned}</strong></p><p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#efc28d]" /><span className="text-muted">Open</span><strong className="ml-4">{openShifts.length}</strong></p></div></div>{openShifts.length ? <div className="mt-6 rounded-xl border border-[#f2dfbd] bg-[#fffaf0] p-3.5"><p className="text-sm font-semibold text-[#7b5924]">{openShifts.length} shift{openShifts.length === 1 ? "" : "s"} need cover</p><p className="mt-1 text-xs leading-5 text-[#8b7754]">Review coverage and assign a teammate when ready.</p><Button kind="soft" className="mt-3 w-full" onClick={() => setView("coverage")}>Review open shifts</Button></div> : <div className="mt-6 rounded-xl bg-[#edf7e8] p-3.5 text-sm text-forest">All scheduled shifts have an owner.</div>}</section>
          </div>
          <section className="mt-5 rounded-2xl border border-line bg-white p-5 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Today’s shifts</h2><p className="mt-1 text-xs text-muted">{dateLabel(todayKey, { weekday: "long", month: "long", day: "numeric" })}</p></div><Button kind="ghost" onClick={() => setView("schedule")}>View all →</Button></div>{todayShifts.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{todayShifts.map((s) => <ShiftCard key={s.id} shift={s} member={memberFor(s.staffId)} onEdit={() => editShift(s)} />)}</div> : <EmptyState title="No shifts for today" description="Add a shift to start planning your team’s day." action={<Button kind="soft" onClick={() => addShift(todayKey)}>+ Add shift</Button>} />}</section>
        </>}

        {view === "schedule" && <>
          <Title eyebrow="PLAN THE WORK" title="Team schedule" description="See who is working, keep shift ownership clear, and catch overlaps before they happen." action={<Button onClick={() => addShift()}><span className="text-lg leading-none">+</span> Add shift</Button>} />
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3.5"><div className="flex items-center gap-2"><Button kind="outline" className="!px-3 !py-2" onClick={() => setWeekOffset((v) => v - 1)} aria-label="Previous week">←</Button><Button kind="outline" className="!px-3 !py-2" onClick={() => setWeekOffset(0)}>This week</Button><Button kind="outline" className="!px-3 !py-2" onClick={() => setWeekOffset((v) => v + 1)} aria-label="Next week">→</Button><div className="ml-1"><p className="text-sm font-semibold">{weekLabel}</p><p className="mt-0.5 text-[11px] text-muted">Monday – Sunday</p></div></div><div className="flex items-center gap-2 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-[#8dbd68]" /> Assigned <span className="ml-2 h-2 w-2 rounded-full bg-[#efc28d]" /> Open shift</div></div>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white"><div className="min-w-[860px]"><div className="grid grid-cols-7 border-b border-line bg-[#fafbf8]">{days.map((day) => <div key={day.key} className={"border-r border-line px-3 py-4 last:border-r-0 " + (day.key === todayKey ? "bg-[#f0f6eb]" : "")}><p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{day.weekday}</p><p className={"mt-1 text-lg font-semibold " + (day.key === todayKey ? "text-[#47763e]" : "text-ink")}>{day.num}</p><p className="mt-1 text-[10px] text-muted">{weekShifts.filter((s) => s.date === day.key).length} shifts</p></div>)}</div><div className="grid grid-cols-7 divide-x divide-line">{days.map((day) => { const list = weekShifts.filter((s) => s.date === day.key); return <div key={day.key} className={"min-h-[390px] space-y-2.5 p-2 " + (day.key === todayKey ? "bg-[#fbfdf8]" : "")}>{list.map((s) => <ShiftCard key={s.id} shift={s} member={memberFor(s.staffId)} onEdit={() => editShift(s)} />)}<button type="button" onClick={() => addShift(day.key)} className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[#dfe5da] py-2 text-xs font-semibold text-[#869189] hover:border-[#9bbc89] hover:bg-[#f3f8ee] hover:text-forest">+ Add</button></div>; })}</div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-[#fafbf8] px-4 py-3 text-xs text-muted"><span>{weekShifts.length} shifts · {hours} hours scheduled</span><span>{openShifts.length} open shift{openShifts.length === 1 ? "" : "s"} to cover</span></div></div></div><p className="mt-3 text-xs leading-5 text-muted">Click any shift to edit it. These sample shift windows are saved only in this browser.</p>
        </>}

        {view === "team" && <>
          <Title eyebrow="YOUR PEOPLE" title="Meet the team" description="Keep the roster tidy and give each scheduled shift a clear owner." action={<Button onClick={() => { setTeamForm({ name: "", role: "Service specialist" }); setError(""); setModal("team"); }}><span className="text-lg leading-none">+</span> Add team member</Button>} />
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-center"><input className={inputClass + " max-w-md"} placeholder="Search by name or role…" value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} /><span className="text-xs text-muted">{filteredTeam.length} of {saved.staff.length} team members</span></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredTeam.map((person) => { const own = weekShifts.filter((s) => s.staffId === person.id); const ownHours = own.reduce((sum, s) => sum + duration(s), 0); return <article key={person.id} className="rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(31,42,42,0.06)]"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><Avatar member={person} size="lg" /><div><h2 className="font-semibold">{person.name}</h2><p className="mt-1 text-xs text-muted">{person.role}</p></div></div><span className="rounded-full bg-[#edf7e8] px-2.5 py-1 text-[10px] font-bold text-[#487741]">Active</span></div><div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-[#f7f8f5] p-3.5"><div><p className="text-[11px] text-muted">Shifts this week</p><p className="mt-1 text-lg font-semibold">{own.length}</p></div><div><p className="text-[11px] text-muted">Scheduled hours</p><p className="mt-1 text-lg font-semibold">{ownHours}h</p></div></div><Button kind="outline" className="mt-4 w-full" onClick={() => setView("schedule")}>View schedule →</Button></article>; })}</div>
          {!filteredTeam.length && <div className="mt-4"><EmptyState title="No matching teammates" description="Try a different name or role, or add a new member." action={<Button onClick={() => setModal("team")}>Add team member</Button>} /></div>}
        </>}

        {view === "coverage" && <>
          <Title eyebrow="KEEP THE PLAN COVERED" title="Shift coverage" description="Review open shifts and assign a teammate before the week gets busy." action={<Button onClick={() => addShift()}><span className="text-lg leading-none">+</span> Add shift</Button>} />
          <div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Open shifts" value={openShifts.length} detail="Needs an assignee" icon="◷" tint="bg-[#fff1dd] text-[#946a2a]" /><StatCard label="Assigned shifts" value={assigned} detail="Has a team member" icon="✓" tint="bg-[#edf3e8] text-forest" /><StatCard label="Coverage rate" value={coverage + "%"} detail="For the selected week" icon="◉" tint="bg-[#eaf1fb] text-[#5577a9]" /></div>
          <section className="overflow-hidden rounded-2xl border border-line bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5"><div><h2 className="text-lg font-semibold">Coverage queue</h2><p className="mt-1 text-xs text-muted">{weekLabel}</p></div><div className="flex gap-1 rounded-xl bg-[#f1f3ed] p-1">{[{ id: "open", label: "Open" }, { id: "assigned", label: "Assigned" }, { id: "all", label: "All" }].map((item) => <button key={item.id} type="button" onClick={() => setCoverageFilter(item.id)} className={"rounded-lg px-3 py-2 text-xs font-semibold " + (coverageFilter === item.id ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}>{item.label}</button>)}</div></div>
          {coverageList.length ? <div className="divide-y divide-line">{coverageList.map((s) => <div key={s.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center"><span className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg " + (!s.staffId ? "bg-[#fff1dd] text-[#946a2a]" : "bg-[#edf3e8] text-forest")}>{s.staffId ? "✓" : "◷"}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{shiftType(s.type).label} shift</h3><span className={"rounded-full px-2.5 py-1 text-[10px] font-bold " + (!s.staffId ? "bg-[#fff1dd] text-[#946a2a]" : "bg-[#edf7e8] text-[#487741]")}>{s.staffId ? "Assigned" : "Open"}</span></div><p className="mt-1 text-xs text-muted">{dateLabel(s.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · {timeLabel(shiftType(s.type).start)}–{timeLabel(shiftType(s.type).end)} · {duration(s)} hours</p>{s.note && <p className="mt-1 text-xs text-muted">{s.note}</p>}</div><div className="flex flex-wrap items-center gap-3">{s.staffId ? <span className="flex items-center gap-2 text-sm"><Avatar member={memberFor(s.staffId)} size="sm" />{memberFor(s.staffId)?.name || "Team member"}</span> : <span className="text-sm font-medium text-[#946a2a]">Needs a teammate</span>}<Button kind="outline" onClick={() => editShift(s)}>{s.staffId ? "Edit shift" : "Assign shift"} →</Button></div></div>)}</div> : <EmptyState title={coverageFilter === "open" ? "No open shifts this week" : "No shifts in this view"} description={coverageFilter === "open" ? "Every scheduled shift has an owner. Nice work." : "Add a shift or choose a different filter."} action={<Button onClick={() => addShift()}>+ Add a shift</Button>} />}</section>
          <div className="mt-4 flex justify-start"><Button kind="outline" onClick={() => setWeekOffset((v) => v - 1)}>← Previous week</Button><Button kind="outline" className="ml-2" onClick={() => setWeekOffset((v) => v + 1)}>Next week →</Button></div>
        </>}

        <footer className="mt-8 flex flex-col gap-2 border-t border-line pt-5 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between"><span>ShiftBoard Lite <span className="mx-1 text-[#bac3bc]">/</span> React + Tailwind CSS</span><span>Learning prototype · Browser-local demo data only</span></footer>
      </main>
    </div>

    {modal === "shift" && <Modal title={editingShiftId ? "Edit shift" : "Add a shift"} description="Choose the date, shift window, and team member." onClose={() => setModal(null)}><form onSubmit={saveShift} className="space-y-4">{error && <div role="alert" className="rounded-xl border border-[#f0d0ca] bg-[#fff5f2] px-3.5 py-3 text-sm text-[#9d4537]">{error}</div>}<Field label="Shift date"><input className={inputClass} type="date" value={shiftForm.date} onChange={(e) => setShiftForm((v) => ({ ...v, date: e.target.value }))} required /></Field><Field label="Shift window"><select className={inputClass} value={shiftForm.type} onChange={(e) => setShiftForm((v) => ({ ...v, type: e.target.value }))}>{SHIFT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label} · {timeLabel(t.start)}–{timeLabel(t.end)}</option>)}</select></Field><Field label="Assign team member" hint="Leave unassigned to add it to the coverage queue."><select className={inputClass} value={shiftForm.staffId} onChange={(e) => setShiftForm((v) => ({ ...v, staffId: e.target.value }))}><option value="">Open shift — no assignee</option>{saved.staff.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}</select></Field><Field label="Shift note (optional)"><textarea className={inputClass} rows="3" maxLength={220} value={shiftForm.note} onChange={(e) => setShiftForm((v) => ({ ...v, note: e.target.value }))} placeholder="Site, handover, or useful details…" /></Field><div className="flex flex-col-reverse justify-between gap-2 border-t border-line pt-4 sm:flex-row">{editingShiftId ? <Button kind="danger" onClick={removeShift}>Delete shift</Button> : <span />}<div className="flex gap-2"><Button kind="outline" onClick={() => setModal(null)}>Cancel</Button><Button type="submit">{editingShiftId ? "Save changes" : "Create shift"}</Button></div></div></form></Modal>}

    {modal === "team" && <Modal title="Add team member" description="Add a person to your local demo roster." onClose={() => setModal(null)}><form onSubmit={addTeamMember} className="space-y-4">{error && <div role="alert" className="rounded-xl border border-[#f0d0ca] bg-[#fff5f2] px-3.5 py-3 text-sm text-[#9d4537]">{error}</div>}<Field label="Full name"><input className={inputClass} maxLength={80} value={teamForm.name} onChange={(e) => setTeamForm((v) => ({ ...v, name: e.target.value }))} placeholder="e.g. Jamie Rivera" autoFocus required /></Field><Field label="Role"><select className={inputClass} value={teamForm.role} onChange={(e) => setTeamForm((v) => ({ ...v, role: e.target.value }))}><option>Team lead</option><option>Service specialist</option><option>Operations</option><option>Customer support</option></select></Field><div className="flex justify-end gap-2 border-t border-line pt-4"><Button kind="outline" onClick={() => setModal(null)}>Cancel</Button><Button type="submit">Add member</Button></div></form></Modal>}

    {toast && <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-40px)] items-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white shadow-xl"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-leaf text-xs text-forest">✓</span>{toast}</div>}
  </div>;
}
