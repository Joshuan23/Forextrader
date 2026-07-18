import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import type { JournalRow } from '@/api/types'

const KEY = 'flowedge.journal'

// Journal storage: Supabase when configured (RLS-scoped per user), local
// AsyncStorage otherwise. Same shape either way.

async function loadLocal(): Promise<JournalRow[]> {
  const raw = await AsyncStorage.getItem(KEY)
  return raw ? (JSON.parse(raw) as JournalRow[]) : []
}

async function listJournal(): Promise<JournalRow[]> {
  const supabase = getSupabase()
  if (!supabase) return loadLocal()
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return loadLocal()
  return data.map((r) => ({
    id: r.id as string,
    pair: r.pair as string,
    direction: r.direction as JournalRow['direction'],
    setupType: r.setup_type as string,
    session: r.session_tag as string,
    grade: r.grade as JournalRow['grade'],
    taken: r.taken as boolean,
    resultR: (r.result_r as number | null) ?? undefined,
    resultPips: (r.result_pips as number | null) ?? undefined,
    mistakes: (r.mistakes as string[]) ?? [],
    notes: (r.notes as string) ?? '',
    screenshotUrl: (r.screenshot_url as string | null) ?? undefined,
    createdAt: Date.parse(r.created_at as string),
  }))
}

async function addJournal(entry: Omit<JournalRow, 'id' | 'createdAt'>): Promise<void> {
  const supabase = getSupabase()
  if (supabase) {
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      await supabase.from('journal_entries').insert({
        user_id: data.user.id,
        pair: entry.pair,
        direction: entry.direction,
        setup_type: entry.setupType,
        session_tag: entry.session,
        grade: entry.grade,
        taken: entry.taken,
        result_r: entry.resultR,
        result_pips: entry.resultPips,
        mistakes: entry.mistakes,
        notes: entry.notes,
        screenshot_url: entry.screenshotUrl,
      })
      return
    }
  }
  const rows = await loadLocal()
  rows.unshift({ ...entry, id: `j-${Date.now()}`, createdAt: Date.now() })
  await AsyncStorage.setItem(KEY, JSON.stringify(rows))
}

export function useJournal() {
  return useQuery({ queryKey: ['journal'], queryFn: listJournal })
}

export function useAddJournalEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addJournal,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['journal'] }),
  })
}
