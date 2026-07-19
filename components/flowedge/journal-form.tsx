'use client'

import { useRef, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createJournalEntry, type JournalFormState } from '@/app/actions/journal'
import {
  MISTAKE_TAGS,
  SETUP_LABELS,
  SESSION_LABELS,
  REGIME_LABELS,
} from '@/lib/engine/types'
import { cn } from '@/lib/utils'

const initialState: JournalFormState = { ok: false }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Log entry'}
    </Button>
  )
}

export function JournalForm({ symbols }: { symbols: string[] }) {
  const [state, formAction] = useFormState(createJournalEntry, initialState)
  const [mistakes, setMistakes] = useState<string[]>([])
  const [taken, setTaken] = useState(true)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Log a trade or a skip</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={(fd) => {
            formAction(fd)
            // optimistic reset on submit; server errors keep state.error visible
          }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <div className="space-y-1">
            <Label htmlFor="j-symbol">Pair</Label>
            <Select id="j-symbol" name="symbol" defaultValue={symbols[0]}>
              {symbols.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="j-direction">Direction</Label>
            <Select id="j-direction" name="direction" defaultValue="long">
              <option value="long">Long</option>
              <option value="short">Short</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="j-setup">Setup</Label>
            <Select id="j-setup" name="setupType" defaultValue="pullback_continuation">
              {Object.entries(SETUP_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="j-session">Session</Label>
            <Select id="j-session" name="sessionTag" defaultValue="london">
              {Object.entries(SESSION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="j-regime">Regime</Label>
            <Select id="j-regime" name="regimeTag" defaultValue="ranging">
              {Object.entries(REGIME_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="j-grade">Grade</Label>
            <Select id="j-grade" name="grade" defaultValue="B">
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="blocked">Blocked</option>
            </Select>
          </div>

          <div className="col-span-2 flex items-center gap-2 sm:col-span-3">
            <input
              type="checkbox"
              id="j-taken"
              name="taken"
              checked={taken}
              onChange={(e) => setTaken(e.target.checked)}
              className="h-4 w-4 accent-[#3d8ef5]"
            />
            <Label htmlFor="j-taken" className="normal-case tracking-normal text-sm text-foreground">
              Trade was taken {taken ? '' : '(logging a deliberate skip — record the hypothetical result)'}
            </Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="j-r">Result (R)</Label>
            <Input id="j-r" name="resultR" type="number" step="0.01" placeholder="+1.80 / −1.00" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="j-pips">Result (pips)</Label>
            <Input id="j-pips" name="resultPips" type="number" step="0.1" placeholder="+24.5" />
          </div>
          <div className="space-y-1 sm:col-span-1 col-span-2">
            <Label htmlFor="j-shots">Screenshot URLs</Label>
            <Input id="j-shots" name="screenshots" placeholder="https://… , https://…" />
          </div>

          <div className="col-span-2 space-y-1 sm:col-span-3">
            <Label>Mistake tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {MISTAKE_TAGS.map((tag) => {
                const active = mistakes.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setMistakes(active ? mistakes.filter((m) => m !== tag) : [...mistakes, tag])
                    }
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs transition-colors',
                      active
                        ? 'border-short/50 bg-short/15 text-short'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tag.replace(/_/g, ' ')}
                  </button>
                )
              })}
            </div>
            <input type="hidden" name="mistakes" value={mistakes.join(',')} />
          </div>

          <div className="col-span-2 space-y-1 sm:col-span-3">
            <Label htmlFor="j-notes">Notes</Label>
            <Textarea id="j-notes" name="notes" rows={2} placeholder="What did the market do, what did you do…" />
          </div>

          <div className="col-span-2 flex items-center gap-3 sm:col-span-3">
            <SubmitButton />
            {state.error && <span className="text-xs text-destructive">{state.error}</span>}
            {state.ok && <span className="text-xs text-long">Logged.</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
