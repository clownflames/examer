'use client'

import * as React from 'react'
import {
  AlertCircle,
  Check,
  Loader2,
  Mic,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getUploadPresignedUrl } from '../../actions'
// ↑ Neeche wala server action import karo (agar path alag ho to adjust karna)

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function fmtTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function AudioRecorder({
  examId,
  questionId,
  /** Existing URL — used when returning to a question already recorded. */
  value,
  onChange,
}: {
  examId: string
  questionId: string
  value?: string | null
  onChange: (publicUrl: string | null) => void
}) {
  const [state, setState] = React.useState<
    'idle' | 'recording' | 'stopped' | 'uploading' | 'uploaded'
  >(value ? 'uploaded' : 'idle')

  const [audioUrl, setAudioUrl] = React.useState<string | null>(value ?? null)
  const [seconds, setSeconds] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const streamRef = React.useRef<MediaStream | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  /* -------------------- cleanup -------------------- */
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  /* -------------------- recording -------------------- */

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType: mime })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: mime })
        void handleUpload(blob)
      }

      recorder.start()
      setSeconds(0)
      setState('recording')

      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1)
      }, 1000)
    } catch (err) {
      console.error(err)
      setError(
        'Could not access your microphone. Please allow mic permission and try again.'
      )
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    mediaRecorderRef.current?.stop()
    setState('stopped')
  }

  /* -------------------- upload -------------------- */

  async function handleUpload(blob: Blob) {
    setState('uploading')
    try {
      const presignRes = await getUploadPresignedUrl({
        examId,
        questionId,
        contentType: blob.type || 'audio/webm',
      })

      if (!presignRes.success) {
        throw new Error(presignRes.error)
      }

      const putRes = await fetch(presignRes.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': blob.type || 'audio/webm' },
      })

      if (!putRes.ok) {
        throw new Error('Upload failed')
      }

      setAudioUrl(presignRes.publicUrl)
      onChange(presignRes.publicUrl)
      setState('uploaded')
      toast.success('Voice answer uploaded')
    } catch (err) {
      console.error(err)
      setError('Could not upload your recording. Please try again.')
      setState('idle')
      toast.error('Upload failed')
    }
  }

  /* -------------------- delete -------------------- */

  function deleteRecording() {
    setAudioUrl(null)
    onChange(null)
    setSeconds(0)
    setState('idle')
  }

  /* -------------------- render -------------------- */

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        state === 'recording'
          ? 'border-destructive/40 bg-destructive/5'
          : 'bg-muted/30'
      )}
    >
      {/* IDLE */}
      {state === 'idle' && (
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background border">
            <Mic className="text-muted-foreground h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium">Record your answer</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Speak clearly. You can re-record before submitting.
            </p>
          </div>
          <Button type="button" onClick={startRecording} className="gap-2">
            <Mic className="h-4 w-4" />
            Start recording
          </Button>
          {error && (
            <p className="text-destructive flex items-center gap-1 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
        </div>
      )}

      {/* RECORDING */}
      {state === 'recording' && (
        <div className="flex flex-col items-center gap-3 py-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
            </span>
            <span className="text-destructive text-sm font-semibold">
              Recording
            </span>
          </div>

          <p className="font-mono text-2xl font-semibold tabular-nums">
            {fmtTime(seconds)}
          </p>

          {/* Waveform (visual only) */}
          <div className="flex h-8 items-end gap-0.5">
            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={i}
                className="bg-destructive/60 w-1 rounded-full"
                style={{
                  height: `${20 + Math.abs(Math.sin(i * 0.7 + seconds)) * 60}%`,
                  animation: `pulse 0.9s ease-in-out ${i * 0.03}s infinite alternate`,
                }}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={stopRecording}
            className="gap-2"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop recording
          </Button>
        </div>
      )}

      {/* UPLOADING */}
      {state === 'uploading' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          <p className="text-sm font-medium">Uploading your recording…</p>
          <p className="text-muted-foreground text-xs">
            Please wait, don&apos;t close this page.
          </p>
        </div>
      )}

      {/* UPLOADED */}
      {state === 'uploaded' && audioUrl && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-600">
              Recording saved
            </span>
          </div>

          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            controls
            src={audioUrl}
            className="w-full"
            preload="metadata"
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                deleteRecording()
                void startRecording()
              }}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Re-record
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={deleteRecording}
              className="text-destructive hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}