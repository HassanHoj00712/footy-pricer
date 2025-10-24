'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ===================== Admin / Viewer mode (env-based) ===================== */
const ADMIN_CODE = (process.env.NEXT_PUBLIC_ADMIN_CODE || "").trim();

function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = sessionStorage.getItem("fp_admin");
    setIsAdmin(s === "1");
    if (!ADMIN_CODE) {
      console.warn("Admin PIN not set. Add NEXT_PUBLIC_ADMIN_CODE to .env.local and restart dev server.");
    }
  }, []);

  const login = () => {
    const code = (prompt("Admin code?") || "").trim();
    if (code && ADMIN_CODE && code === ADMIN_CODE) {
      sessionStorage.setItem("fp_admin", "1");
      setIsAdmin(true);
      alert("Admin mode unlocked.");
    } else if (!ADMIN_CODE) {
      alert("Admin PIN not set. Add NEXT_PUBLIC_ADMIN_CODE in .env.local and restart the dev server.");
    } else {
      alert("Wrong code.");
    }
  };

  const logout = () => {
    sessionStorage.removeItem("fp_admin");
    setIsAdmin(false);
  };

  return { isAdmin, login, logout };
}

/* ===================== Types ===================== */
type Role = 'GK' | 'DEF' | 'MID' | 'FWD';

type Player = {
  id: string;
  name: string;
  photo: string;        // URL or dataURL
  role: Role;
  goals: number;
  assists: number;
  matches: number;
  motmCount: number;     // +0.5 each
  hattrickCount: number; // +0.3 each
  cleanSheetCount: number;// +0.3 each
};

type NewsItem = { id: string; title: string; details?: string; rivalry?: string; date: string; img?: string };

type MatchStatus = 'upcoming' | 'played';

type MatchItem = {
  id: string;
  date: string;     // YYYY-MM-DD
  time?: string;    // HH:MM
  location?: string;
  rivalry?: string;
  notes?: string;
  status: MatchStatus;

  teamA: string[];  // playerIds
  teamB: string[];
  teamC: string[];

  stats: Record<string, { goals: number; assists: number }>; // per playerId
  motm: string[];        // multiple players
  hattricks: string[];   // multiple players
  cleanSheetPlayer?: string; // one player

  applied?: Record<string, { goals: number; assists: number; counted: boolean }>;
};

/* ===================== Ladder (barème) ===================== */
const LADDER = [
  { s: 0.0, p: 0.3, l: 'TA3BENNN' },
  { s: 0.2, p: 0.5, l: 'Koussa' },
  { s: 0.4, p: 1.0, l: 'Fesh amal' },
  { s: 0.6, p: 1.5, l: 'Lache le foot' },
  { s: 0.8, p: 2.0, l: 'Bencher' },
  { s: 1.0, p: 2.5, l: 'Imohem lniye' },
  { s: 1.2, p: 3.0, l: '3ade' },
  { s: 1.4, p: 3.5, l: 'Ma2boul' },
  { s: 1.6, p: 4.0, l: 'Fi ta2adom' },
  { s: 1.8, p: 5.0, l: 'Mesh 3ali' },
  { s: 2.0, p: 6.0, l: 'Starter' },
  { s: 2.2, p: 7.0, l: 'Fi mahara' },
  { s: 2.4, p: 8.0, l: 'Superstar' },
  { s: 2.6, p: 9.0, l: '7ellooo' },
  { s: 2.8, p: 10.0, l: 'wooow' },
  { s: 3.0, p: 11.0, l: 'Machinee' },
  { s: 3.2, p: 12.0, l: 'Crazyyy' },
  { s: 3.4, p: 13.0, l: 'Sobhanallah' },
  { s: 3.6, p: 14.0, l: 'De2o 3al khashab' },
  { s: 3.8, p: 15.0, l: 'La3ibbb' },
  { s: 4.0, p: 16.0, l: 'btestehel duaa men Rayan' },
  { s: 4.2, p: 17.0, l: '3ndo fans' },
  { s: 4.4, p: 18.0, l: 'Ossa kbir eee' },
  { s: 4.6, p: 19.0, l: 'Wa7echhh' },
  { s: 4.8, p: 20.0, l: 'Messi' },
  { s: 5.0, p: 25.0, l: 'GOAT (adam level)' },
].sort((a, b) => a.s - b.s);

function priceLookup(score: number) {
  let row = LADDER[0];
  for (const r of LADDER) { if (score >= r.s) row = r; else break; }
  return row; // { p, l }
}

/* ===================== Helpers ===================== */
const uid = () => Math.random().toString(36).slice(2, 9);

function load<T>(k: string, d: T): T {
  if (typeof window === 'undefined') return d;
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
}
function save(k: string, v: any) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

/* ===================== Component ===================== */
export default function App() {
  const { isAdmin, login, logout } = useAdmin();

  /* ---------- State ---------- */
  const [hydrated, setHydrated] = useState(false);

  // players
  const [players, setPlayers] = useState<Player[]>([]);
  const emptyPlayer: Player = { id: uid(), name: '', photo: '', role: 'MID', goals: 0, assists: 0, matches: 0, motmCount: 0, hattrickCount: 0, cleanSheetCount: 0 };
  const [form, setForm] = useState<Player>({ ...emptyPlayer });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // news
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsDetails, setNewsDetails] = useState('');
  const [newsRivalry, setNewsRivalry] = useState('');
  const [newsImg, setNewsImg] = useState<string>('');

  // news editing
  const [newsEditingId, setNewsEditingId] = useState<string>('');
  const [newsEdit, setNewsEdit] = useState<{title:string; details:string; rivalry:string; img?:string}>({title:'', details:'', rivalry:'', img:''});

  // matches
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');

  // forms Upcoming
  const [uDate, setUDate] = useState(''); const [uTime, setUTime] = useState(''); const [uLoc, setULoc] = useState('');
  const [uRiv, setURiv] = useState('');   const [uNotes, setUNotes] = useState('');

  // forms Played
  const [pDate, setPDate] = useState(''); const [pTime, setPTime] = useState(''); const [pLoc, setPLoc] = useState('');
  const [pRiv, setPRiv] = useState('');   const [pNotes, setPNotes] = useState('');

  /* ---------- Effects ---------- */
  useEffect(() => {
    const defaults: Player[] = [
      { id: uid(), name: 'Hassan Hojeij', photo: '/players/hassan.jpg', role: 'FWD', goals: 2, assists: 1, matches: 2, motmCount: 0, hattrickCount: 0, cleanSheetCount: 0 },
      { id: uid(), name: 'Mhmd Badran',   photo: '/players/badran.jpg', role: 'MID', goals: 1, assists: 1, matches: 1, motmCount: 0, hattrickCount: 0, cleanSheetCount: 0 },
      { id: uid(), name: 'Ali Awada',     photo: '/players/ali.jpg',    role: 'DEF', goals: 0, assists: 0, matches: 2, motmCount: 0, hattrickCount: 0, cleanSheetCount: 1 },
    ];
    setPlayers(load<Player[]>("fp_players", defaults));
    setNews(load<NewsItem[]>("fp_news", []));
    setMatches(load<MatchItem[]>("fp_matches", []));
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) save("fp_players", players); }, [players, hydrated]);
  useEffect(() => { if (hydrated) save("fp_news", news); }, [news, hydrated]);
  useEffect(() => { if (hydrated) save("fp_matches", matches); }, [matches, hydrated]);

  /* ---------- Computed ---------- */
  const playersComputed = useMemo(() => players.map(p => {
    const score = p.matches > 0 ? ((p.goals) + (p.assists * 0.7)) / p.matches : 0;
    const { p: pricePerMatch, l: level } = priceLookup(score);
    const bonus = (p.motmCount * 0.5) + (p.hattrickCount * 0.3) + (p.cleanSheetCount * 0.3);
    const total = pricePerMatch * (p.matches / 2) + bonus; // current rule
    return { ...p, score: Number(score.toFixed(2)), pricePerMatch, level, bonus: Number(bonus.toFixed(1)), total: Number(total.toFixed(1)) };
  }), [players]);

  const ranking = useMemo(() => [...playersComputed].sort((a, b) => b.total - a.total), [playersComputed]);
  const filteredPlayers = useMemo(() => playersComputed.filter(p => p.name.toLowerCase().includes(search.toLowerCase())), [playersComputed, search]);

  const selectedMatch = matches.find(m => m.id === selectedMatchId) || null;
  const teamPlayersForSelected = useMemo(() => {
    if (!selectedMatch) return [];
    const ids = new Set<string>([
      ...selectedMatch.teamA,
      ...selectedMatch.teamB,
      ...selectedMatch.teamC,
    ]);
    return players.filter(p => ids.has(p.id));
  }, [selectedMatch, players]);

  /* ---------- Loading gate ---------- */
  if (!hydrated) {
    return (
      <div className="min-h-screen p-6 text-gray-600 bg-gradient-to-br from-blue-50 via-teal-50 to-green-50">
        Loading…
      </div>
    );
  }

  /* ---------- Actions ---------- */
  const selectMatch = (id?: string) => setSelectedMatchId(id || '');

  // players
  const resetForm = () => { setForm({ ...emptyPlayer, id: uid() }); setEditingId(null); };
  const addOrEditPlayer = () => {
    if (!form.name.trim()) return;
    setPlayers(prev => editingId ? prev.map(p => p.id === editingId ? { ...form, id: editingId } : p) : [...prev, form]);
    resetForm();
  };
  const editPlayer = (id: string) => { const p = players.find(x => x.id === id); if (!p) return; setForm({ ...p }); setEditingId(id); };
  const delPlayer = (id: string) => setPlayers(prev => prev.filter(p => p.id !== id));

  // news
  const addNews = () => {
    if (!newsTitle.trim()) return;
    setNews(prev => [{ id: uid(), title: newsTitle, details: newsDetails || undefined, rivalry: newsRivalry || undefined, date: new Date().toISOString(), img: newsImg || undefined }, ...prev]);
    setNewsTitle(''); setNewsDetails(''); setNewsRivalry(''); setNewsImg('');
  };
  const delNews = (id: string) => setNews(prev => prev.filter(n => n.id !== id));

  const startEditNews = (n: NewsItem) => {
    setNewsEditingId(n.id);
    setNewsEdit({ title: n.title, details: n.details || '', rivalry: n.rivalry || '', img: n.img });
  };
  const cancelEditNews = () => { setNewsEditingId(''); setNewsEdit({ title:'', details:'', rivalry:'', img:'' }); };
  const saveEditNews = () => {
    if (!newsEditingId) return;
    setNews(prev => prev.map(n => n.id === newsEditingId ? { ...n, title: newsEdit.title, details: newsEdit.details || undefined, rivalry: newsEdit.rivalry || undefined, img: newsEdit.img || undefined } : n));
    cancelEditNews();
  };

  // matches
  const addUpcomingMatch = () => {
    if (!uDate) return;
    setMatches(prev => [{
      id: uid(), date: uDate, time: uTime || undefined, location: uLoc || undefined, rivalry: uRiv || undefined, notes: uNotes || undefined,
      status: 'upcoming',
      teamA: [], teamB: [], teamC: [],
      stats: {},
      motm: [], hattricks: [],
      applied: {}
    }, ...prev]);
    setUDate(''); setUTime(''); setULoc(''); setURiv(''); setUNotes('');
  };

  const addPlayedMatch = () => {
    if (!pDate) return;
    setMatches(prev => [{
      id: uid(), date: pDate, time: pTime || undefined, location: pLoc || undefined, rivalry: pRiv || undefined, notes: pNotes || undefined,
      status: 'played',
      teamA: [], teamB: [], teamC: [],
      stats: {},
      motm: [], hattricks: [],
      applied: {}
    }, ...prev]);
    setPDate(''); setPTime(''); setPLoc(''); setPRiv(''); setPNotes('');
  };

  const delMatch = (id: string) => setMatches(prev => prev.filter(m => m.id !== id));

  const convertUpcomingToPlayed = (id: string) => {
    setMatches(prev => prev.map(m => {
      if (m.id !== id || m.status !== 'upcoming') return m;
      return { ...m, status: 'played', applied: m.applied || {} };
    }));
  };

  const addPlayerToTeam = (matchId: string, playerId: string, team: 'A'|'B'|'C') => {
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m;
      let { teamA, teamB, teamC, stats } = m;
      teamA = teamA.filter(id => id !== playerId);
      teamB = teamB.filter(id => id !== playerId);
      teamC = teamC.filter(id => id !== playerId);
      if (team === 'A') teamA.push(playerId);
      if (team === 'B') teamB.push(playerId);
      if (team === 'C') teamC.push(playerId);
      if (!stats[playerId]) stats = { ...stats, [playerId]: { goals: 0, assists: 0 } };
      return { ...m, teamA, teamB, teamC, stats };
    }));
  };

  const removePlayerFromTeams = (matchId: string, playerId: string) => {
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m;
      const { [playerId]: _ignore, ...restStats } = m.stats || {};
      return {
        ...m,
        teamA: m.teamA.filter(id => id !== playerId),
        teamB: m.teamB.filter(id => id !== playerId),
        teamC: m.teamC.filter(id => id !== playerId),
        stats: restStats
      };
    }));
  };

  // ✅ Fixed: safe merge of existing stats (no duplicate keys)
  const setMatchStat = (
  matchId: string,
  playerId: string,
  kind: 'goals' | 'assists',
  value: number
) => {
  setMatches(prev =>
    prev.map(m => {
      if (m.id !== matchId) return m;

      // SAFE merge: never declare goals/assists twice
      const prevFor = m.stats?.[playerId] ?? { goals: 0, assists: 0 };
      const nextFor = { ...prevFor, [kind]: Math.max(0, value) };

      return {
        ...m,
        stats: {
          ...m.stats,
          [playerId]: nextFor,
        },
      };
    })
  );
};

  const toggleAward = (matchId: string, field: 'motm'|'hattricks', playerId: string) => {
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m;
      const arr = new Set<string>(m[field] || []);
      if (arr.has(playerId)) arr.delete(playerId); else arr.add(playerId);
      return { ...m, [field]: Array.from(arr) } as MatchItem;
    }));
  };

  const clearAward = (matchId: string, field: 'motm'|'hattricks') => {
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, [field]: [] } as MatchItem : m));
  };

  const clearCleanSheet = (matchId: string) => {
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, cleanSheetPlayer: undefined } : m));
  };

  // idempotent apply
  const applyPlayedStatsToTotals = (matchId: string) => {
    const m = matches.find(x => x.id === matchId);
    if (!m) return;

    const teamSet = new Set<string>([...m.teamA, ...m.teamB, ...m.teamC]);
    const statIds = Object.keys(m.stats || {});
    const allIds = new Set<string>([...teamSet, ...statIds]);

    setPlayers(prev => prev.map(p => {
      if (!allIds.has(p.id)) return p;

      const old = (m.applied && m.applied[p.id]) || { goals: 0, assists: 0, counted: false };
      const curr = m.stats[p.id] || { goals: 0, assists: 0 };
      const isInTeam = teamSet.has(p.id);

      const deltaGoals = (curr.goals ?? 0) - (old.goals ?? 0);
      const deltaAssists = (curr.assists ?? 0) - (old.assists ?? 0);
      const deltaMatches = (isInTeam ? 1 : 0) - (old.counted ? 1 : 0);

      return {
        ...p,
        goals: p.goals + deltaGoals,
        assists: p.assists + deltaAssists,
        matches: p.matches + deltaMatches,
      };
    }));

    const newApplied: Record<string, { goals: number; assists: number; counted: boolean }> = { ...(m.applied || {}) };
    allIds.forEach(pid => {
      const curr = m.stats[pid] || { goals: 0, assists: 0 };
      const isInTeam = teamSet.has(pid);
      newApplied[pid] = { goals: curr.goals ?? 0, assists: curr.assists ?? 0, counted: isInTeam };
    });

    setMatches(prev => prev.map(mm => mm.id === matchId ? { ...mm, applied: newApplied } : mm));
    if (selectedMatchId === matchId) setSelectedMatchId('');
  };

  const upcoming = matches.filter(m => m.status === 'upcoming').sort((a,b)=> (a.date+a.time) > (b.date+b.time ? 1 : -1));
  const played   = matches.filter(m => m.status === 'played'  ).sort((a,b)=> (b.date+b.time) > (a.date+a.time ? 1 : -1));

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-blue-50 via-teal-50 to-green-50">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="rounded-3xl p-6 shadow-xl bg-gradient-to-r from-blue-600 via-teal-500 to-green-500 text-white ring-1 ring-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">⚽ Youth Football Tracker</h1>
            <p className="opacity-90 text-sm mt-1">Manage players, matches, stats & news — with automatic pricing and rankings.</p>
          </div>
          <div className="text-sm">
            {/* Admin toggle */}
            <button className="opacity-80 hover:opacity-100 underline" onClick={!isAdmin ? login : logout}>
              {!isAdmin ? '🔒 Viewer' : '🔓 Admin'}
            </button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="home" className="max-w-7xl mx-auto">
        <TabsList className="grid grid-cols-6 w-full rounded-2xl bg-white/70 backdrop-blur border shadow-sm">
          <TabsTrigger value="home">Home / News</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="matches">Matches (played)</TabsTrigger>
          <TabsTrigger value="calendar">Calendar (upcoming)</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* HOME / NEWS */}
        <TabsContent value="home" className="mt-6 grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 shadow-xl border-0 bg-white/90 backdrop-blur rounded-3xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-3">📰 Latest News & Rivalries</h2>
              {isAdmin && (
                <div className="grid gap-2 mb-4">
                  <Input placeholder="Title" value={newsTitle} onChange={e => setNewsTitle(e.target.value)} />
                  <Input placeholder="Details (optional)" value={newsDetails} onChange={e => setNewsDetails(e.target.value)} />
                  <Input placeholder="Rivalry (optional)" value={newsRivalry} onChange={e => setNewsRivalry(e.target.value)} />
                  <div className="flex items-center gap-2">
                    <input className="text-sm" type="file" accept="image/*" onChange={e => { const f=e.target.files?.[0]; if(!f) return; const fr=new FileReader(); fr.onload=()=>setNewsImg(String(fr.result)); fr.readAsDataURL(f); }} />
                    {newsImg && <span className="text-xs text-gray-600">Image ready ✓</span>}
                  </div>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={addNews}>Add news</Button>
                </div>
              )}
              <div className="space-y-3">
                {news.length === 0 ? (
                  <div className="text-gray-500">No news yet.</div>
                ) : (
                  news.map(n => {
                    const isEditing = n.id === newsEditingId;
                    return (
                      <div key={n.id} className="border rounded-2xl p-4 bg-white/90 backdrop-blur shadow-sm hover:shadow-md transition-shadow">
                        {!isEditing && (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="font-semibold">{n.title}</div>
                              <div className="text-xs text-gray-500">{new Date(n.date).toLocaleString()}</div>
                            </div>
                            {n.rivalry && <div className="text-xs mt-1">🔥 Rivalry: <b>{n.rivalry}</b></div>}
                            {n.img && (
                              <img
                                src={n.img}
                                alt="news"
                                className="mt-3 w-full max-h-[70vh] object-contain rounded-2xl bg-gradient-to-br from-blue-50 to-green-50 p-2 shadow"
                              />
                            )}
                            {n.details && <div className="text-sm mt-2">{n.details}</div>}
                            {isAdmin && (
                              <div className="mt-2 flex gap-2">
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={()=>startEditNews(n)}>Edit</Button>
                                <Button size="sm" variant="secondary" onClick={() => delNews(n.id)}>Delete</Button>
                              </div>
                            )}
                          </>
                        )}

                        {isEditing && (
                          <div className="space-y-2">
                            <Input placeholder="Title" value={newsEdit.title} onChange={e=>setNewsEdit({...newsEdit, title:e.target.value})} disabled={!isAdmin} />
                            <Input placeholder="Details" value={newsEdit.details} onChange={e=>setNewsEdit({...newsEdit, details:e.target.value})} disabled={!isAdmin} />
                            <Input placeholder="Rivalry" value={newsEdit.rivalry} onChange={e=>setNewsEdit({...newsEdit, rivalry:e.target.value})} disabled={!isAdmin} />
                            <div className="flex items-center gap-2">
                              <input type="file" accept="image/*" disabled={!isAdmin}
                                     onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const fr=new FileReader(); fr.onload=()=>setNewsEdit(prev=>({...prev, img:String(fr.result)})); fr.readAsDataURL(f); }} />
                              {newsEdit.img && <span className="text-xs text-gray-600">New image ✓</span>}
                            </div>
                            {(newsEdit.img || n.img) && (
                              <img src={newsEdit.img || n.img} alt="preview" className="mt-2 w-full max-h-[60vh] object-contain rounded-xl bg-gradient-to-br from-blue-50 to-green-50 p-2" />
                            )}
                            {isAdmin && (
                              <div className="flex gap-2">
                                <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={saveEditNews}>Save</Button>
                                <Button size="sm" variant="secondary" onClick={cancelEditNews}>Cancel</Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur rounded-3xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-3">📌 Tips</h2>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Friends see Viewer mode. Click <b>🔒 Viewer</b> and enter your PIN to edit.</li>
                <li>All data is stored locally in the browser (localStorage).</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLAYERS */}
        <TabsContent value="players" className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <Input placeholder="Search a player..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs bg-white/80 backdrop-blur" />
          </div>

          {isAdmin && (
            <Card className="mb-6 shadow-xl border-0 bg-white/90 backdrop-blur rounded-3xl">
              <CardContent className="p-6 grid md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Name</div>
                  <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Photo URL (optional)</div>
                  <Input placeholder="https://…" value={form.photo} onChange={e => setForm({ ...form, photo: e.target.value })} />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Upload photo</div>
                  <input type="file" accept="image/*" onChange={(e) => { const f=e.target.files?.[0]; if(!f) return; const fr=new FileReader(); fr.onload=()=>setForm({...form, photo:String(fr.result)}); fr.readAsDataURL(f); }} />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Role</div>
                  <select className="border rounded px-3 py-2 bg-white w-full" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>
                    <option value="GK">GK</option><option value="DEF">DEF</option><option value="MID">MID</option><option value="FWD">FWD</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Goals</div>
                  <Input type="number" value={form.goals} onChange={e => setForm({ ...form, goals: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Assists</div>
                  <Input type="number" value={form.assists} onChange={e => setForm({ ...form, assists: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Matches</div>
                  <Input type="number" value={form.matches} onChange={e => setForm({ ...form, matches: Number(e.target.value) })} />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-600">MOTM (×0.5M)</div>
                  <Input type="number" value={form.motmCount} onChange={e => setForm({ ...form, motmCount: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Hat-tricks (×0.3M)</div>
                  <Input type="number" value={form.hattrickCount} onChange={e => setForm({ ...form, hattrickCount: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Clean sheets (×0.3M)</div>
                  <Input type="number" value={form.cleanSheetCount} onChange={e => setForm({ ...form, cleanSheetCount: Number(e.target.value) })} />
                </div>

                <div className="flex gap-2 col-span-full">
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={addOrEditPlayer}>{editingId ? 'Save changes' : 'Add player'}</Button>
                  {editingId && <Button variant="secondary" onClick={resetForm}>Cancel</Button>}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            {filteredPlayers.map(p => (
              <Card key={p.id} className="shadow-xl border-0 bg-white/90 backdrop-blur rounded-3xl hover:shadow-2xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-48 h-48 ring-2 ring-teal-500/40 shadow-sm">
                      <AvatarImage src={p.photo || '/default-player.png'} alt={p.name} />
                    </Avatar>
                    <div>
                      <div className="font-semibold text-lg">{p.name}</div>
                      <div className="text-xs text-gray-500">Role: {p.role}</div>
                      <div className="text-xs text-gray-500">Lvl: <b>{(p as any).level}</b> • Price/m: <b>{(p as any).pricePerMatch} M$</b></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                    <div><b>G</b>: {p.goals}</div><div><b>A</b>: {p.assists}</div><div><b>M</b>: {p.matches}</div>
                    <div><b>Score/m</b>: {(p as any).score}</div><div><b>Bonus</b>: {(p as any).bonus} M$</div><div><b>Total</b>: {(p as any).total} M$</div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => editPlayer(p.id)}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => delPlayer(p.id)}>Delete</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* RANKING (Total only) */}
        <TabsContent value="ranking" className="mt-6">
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur rounded-3xl"><CardContent className="p-6">
            <h2 className="text-xl font-bold mb-3">🏆 Ranking (Total value)</h2>
            <div className="grid grid-cols-12 font-semibold border-b pb-2 mb-2 text-sm">
              <div>#</div>
              <div className="col-span-3">Player</div>
              <div>Role</div>
              <div>G</div>
              <div>A</div>
              <div>M</div>
              <div>Score/m</div>
              <div>Lvl</div>
              <div>Bonus</div>
              <div>Total</div>
            </div>
            {ranking.map((p, i) => (
              <div key={p.id} className="grid grid-cols-12 items-center py-1 border-b text-sm">
                <div>{i + 1}</div>
                <div className="col-span-3">{p.name}</div>
                <div>{p.role}</div>
                <div>{p.goals}</div>
                <div>{p.assists}</div>
                <div>{p.matches}</div>
                <div>{(p as any).score}</div>
                <div>{(p as any).level}</div>
                <div>{(p as any).bonus}</div>
                <div className="font-semibold">{(p as any).total}</div>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        {/* MATCHES (played) */}
        <TabsContent value="matches" className="mt-6 grid md:grid-cols-5 gap-4">
          <Card className="md:col-span-2 shadow-xl border-0 bg-white/90 backdrop-blur rounded-3xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-3">➕ Add played match</h2>
              {isAdmin && (
                <div className="grid gap-2">
                  <Input type="date" value={pDate} onChange={e=>setPDate(e.target.value)} />
                  <Input type="time" value={pTime} onChange={e=>setPTime(e.target.value)} />
                  <Input placeholder="Location" value={pLoc} onChange={e=>setPLoc(e.target.value)} />
                  <Input placeholder="Rivalry (optional)" value={pRiv} onChange={e=>setPRiv(e.target.value)} />
                  <Input placeholder="Notes (optional)" value={pNotes} onChange={e=>setPNotes(e.target.value)} />
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={addPlayedMatch}>Add match</Button>
                </div>
              )}

              <h2 className="text-xl font-bold mt-6 mb-3">📋 Played matches</h2>
              {played.length === 0 && <div className="text-gray-500">No played matches.</div>}
              {played.map(m => (
                <div key={m.id} className={`border rounded-2xl p-3 mb-2 bg-white shadow-sm ${selectedMatchId===m.id ? 'ring-2 ring-teal-400/50': ''}`}>
                  <div className="flex justify-between items-center">
                    <div className="font-semibold">{m.date} {m.time? `• ${m.time}`:''}</div>
                    <div className="flex gap-2">
                      {selectedMatchId===m.id ? (
                        <Button size="sm" variant="secondary" onClick={()=>selectMatch('')}>Close</Button>
                      ) : (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={()=>selectMatch(m.id)}>Open</Button>
                      )}
                      {isAdmin && <Button size="sm" variant="secondary" onClick={()=>delMatch(m.id)}>Delete</Button>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">{m.location||'—'} {m.rivalry? `• 🔥 ${m.rivalry}`:''}</div>
                  {m.notes && <div className="text-sm mt-1">{m.notes}</div>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-3 shadow-xl border-0 bg-white/90 backdrop-blur rounded-3xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-3">📑 Match details (played)</h2>
              {!selectedMatch && <div className="text-gray-500">Select a played match to view teams, stats & awards.</div>}
              {selectedMatch && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-gray-700">
                      {selectedMatch.date} {selectedMatch.time? `• ${selectedMatch.time}`:''} — {selectedMatch.location || '—'}
                      {selectedMatch.rivalry && <> • 🔥 {selectedMatch.rivalry}</>}
                    </div>
                    <div className="flex gap-2">
                      {isAdmin && <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => applyPlayedStatsToTotals(selectedMatch.id)}>Save changes & close</Button>}
                      <Button size="sm" variant="secondary" onClick={()=>selectMatch('')}>Close</Button>
                    </div>
                  </div>

                  {/* teams */}
                  <div className="grid md:grid-cols-3 gap-3 mb-4">
                    {(['A','B','C'] as const).map(team => {
                      const teamIds = team==='A'?selectedMatch.teamA:team==='B'?selectedMatch.teamB:selectedMatch.teamC;
                      return (
                        <div key={team} className="border rounded-2xl p-3 bg-white/70">
                          <div className="font-semibold mb-2">Team {team}</div>
                          <div className="flex gap-2">
                            <select className="border rounded px-2 py-1 bg-white flex-1" disabled={!isAdmin}
                              onChange={e => { const val=e.target.value; if (val) addPlayerToTeam(selectedMatch.id, val, team); e.currentTarget.selectedIndex = 0; }}>
                              <option value="">Add player…</option>
                              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                          <ul className="text-sm mt-3 space-y-1">
                            {teamIds.map(pid => {
                              const pl = players.find(pp=>pp.id===pid);
                              if (!pl) return null;
                              return (
                                <li key={pid} className="flex items-center justify-between">
                                  <span>{pl.name} <span className="text-xs text-gray-500">({pl.role})</span></span>
                                  {isAdmin && (
                                    <button
                                      className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100"
                                      onClick={()=>removePlayerFromTeams(selectedMatch.id, pid)}
                                      title="Remove from team"
                                    >✕</button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>

                  {/* stats */}
                  <div className="grid gap-2 mb-5">
                    {teamPlayersForSelected.length === 0 && (
                      <div className="text-xs text-gray-500">Add players to teams to edit their stats.</div>
                    )}
                    {teamPlayersForSelected.map(p => {
                      const st = selectedMatch.stats[p.id] || { goals: 0, assists: 0 };
                      return (
                        <div key={p.id} className="grid grid-cols-12 items-center gap-2 border rounded-2xl px-3 py-2 bg-white/70">
                          <div className="col-span-4 text-sm">{p.name}</div>
                          <div className="col-span-2">
                            <div className="text-[11px] text-gray-500 mb-0.5">Goals</div>
                            <Input type="number" value={st.goals} disabled={!isAdmin} onChange={e => setMatchStat(selectedMatch.id, p.id, 'goals', Number(e.target.value))} />
                          </div>
                          <div className="col-span-2">
                            <div className="text-[11px] text-gray-500 mb-0.5">Assists</div>
                            <Input type="number" value={st.assists} disabled={!isAdmin} onChange={e => setMatchStat(selectedMatch.id, p.id, 'assists', Number(e.target.value))} />
                          </div>
                          <div className="col-span-4 text-xs text-gray-500">Stats for this match</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* awards */}
                  <div className="grid md:grid-cols-3 gap-4 mb-5">
                    <div className="border rounded-2xl p-3 bg-white/70">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold">MOTM</label>
                        {isAdmin && <Button size="sm" variant="secondary" onClick={()=>clearAward(selectedMatch.id, 'motm')}>Clear</Button>}
                      </div>
                      <div className="max-h-44 overflow-auto space-y-1 pr-1">
                        {players.map(p => {
                          const checked = (selectedMatch.motm||[]).includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={checked} disabled={!isAdmin} onChange={()=>toggleAward(selectedMatch.id, 'motm', p.id)} />
                              <span>{p.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border rounded-2xl p-3 bg-white/70">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold">Hat-tricks</label>
                        {isAdmin && <Button size="sm" variant="secondary" onClick={()=>clearAward(selectedMatch.id, 'hattricks')}>Clear</Button>}
                      </div>
                      <div className="max-h-44 overflow-auto space-y-1 pr-1">
                        {players.map(p => {
                          const checked = (selectedMatch.hattricks||[]).includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={checked} disabled={!isAdmin} onChange={()=>toggleAward(selectedMatch.id, 'hattricks', p.id)} />
                              <span>{p.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border rounded-2xl p-3 bg-white/70">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold">Clean sheet</label>
                        {isAdmin && <Button size="sm" variant="secondary" onClick={()=>clearCleanSheet(selectedMatch.id)}>Clear</Button>}
                      </div>
                      <select
                        className="border rounded px-3 py-2 w-full bg-white"
                        value={selectedMatch.cleanSheetPlayer || ''}
                        disabled={!isAdmin}
                        onChange={e => setMatches(prev => prev.map(m => m.id === selectedMatch.id ? { ...m, cleanSheetPlayer: e.target.value || undefined } : m))}
                      >
                        <option value="">—</option>
                        {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CALENDAR (upcoming) */}
        <TabsContent value="calendar" className="mt-6 grid md:grid-cols-5 gap-4">
          <Card className="md:col-span-2 shadow-xl border-0 bg-white/90 backdrop-blur rounded-3xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-3">📅 Add upcoming match</h2>
              {isAdmin && (
                <div className="grid gap-2">
                  <Input type="date" value={uDate} onChange={e => setUDate(e.target.value)} />
                  <Input type="time" value={uTime} onChange={e => setUTime(e.target.value)} />
                  <Input placeholder="Location" value={uLoc} onChange={e => setULoc(e.target.value)} />
                  <Input placeholder="Rivalry (optional)" value={uRiv} onChange={e => setURiv(e.target.value)} />
                  <Input placeholder="Notes (optional)" value={uNotes} onChange={e => setUNotes(e.target.value)} />
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={addUpcomingMatch}>Add to calendar</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-3 shadow-xl border-0 bg-white/90 backdrop-blur rounded-3xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-3">📆 Upcoming</h2>
              {upcoming.length === 0 && <div className="text-gray-500">No upcoming matches.</div>}
              {upcoming.map(m => (
                <div key={m.id} className={`border rounded-2xl p-3 mb-3 bg-white shadow-sm ${selectedMatchId===m.id ? 'ring-2 ring-teal-400/50': ''}`}>
                  <div className="flex justify-between items-center">
                    <div className="font-semibold">{m.date} {m.time? `• ${m.time}`:''}</div>
                    <div className="flex gap-2">
                      {selectedMatchId===m.id ? (
                        <Button size="sm" variant="secondary" onClick={()=>selectMatch('')}>Close</Button>
                      ) : (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={()=>selectMatch(m.id)}>Open</Button>
                      )}
                      {isAdmin && <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={()=>convertUpcomingToPlayed(m.id)}>Convert to played</Button>}
                      {isAdmin && <Button size="sm" variant="secondary" onClick={()=>delMatch(m.id)}>Delete</Button>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">{m.location || '—'} {m.rivalry? `• 🔥 ${m.rivalry}`:''}</div>
                  {m.notes && <div className="text-sm mt-1">{m.notes}</div>}

                  {selectedMatchId===m.id && (
                    <div className="mt-3 grid md:grid-cols-3 gap-3">
                      {(['A','B','C'] as const).map(team => {
                        const teamIds = team==='A'?m.teamA:team==='B'?m.teamB:m.teamC;
                        return (
                          <div key={team} className="border rounded-2xl p-3 bg-white/70">
                            <div className="font-semibold mb-2">Team {team}</div>
                            <div className="flex gap-2">
                              <select className="border rounded px-2 py-1 bg-white flex-1" disabled={!isAdmin}
                                onChange={e => { const val=e.target.value; if (val) addPlayerToTeam(m.id, val, team); e.currentTarget.selectedIndex = 0; }}>
                                <option value="">Add player…</option>
                                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </div>
                            <ul className="text-sm mt-3 space-y-1">
                              {teamIds.map(pid => {
                                const pl = players.find(pp=>pp.id===pid);
                                if (!pl) return null;
                                return (
                                  <li key={pid} className="flex items-center justify-between">
                                    <span>{pl.name} <span className="text-xs text-gray-500">({pl.role})</span></span>
                                    {isAdmin && (
                                      <button
                                        className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100"
                                        onClick={()=>removePlayerFromTeams(m.id, pid)}
                                        title="Remove from team"
                                      >✕</button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings" className="mt-6">
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur rounded-3xl"><CardContent className="p-6">
            <h2 className="text-xl font-bold mb-3">⚙️ Settings / Info</h2>
            <p className="text-sm mb-2">Score moyen = ((Buts × 1) + (Assists × 0.7)) ÷ Matchs</p>
            <p className="text-sm mb-2">Barème (LADDER) modifiable dans le code.</p>
            <p className="text-sm">Bonus: MOTM +0.5, Hat-trick +0.3, Clean sheet +0.3.</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
