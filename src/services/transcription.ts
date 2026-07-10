import { supabase } from '@/lib/supabase'
import * as Sentry from '@sentry/react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type TranscriptionInsert = Database['public']['Tables']['transcriptions']['Insert']

export interface TranscriptionResult {
  text: string
  language?: string
  duration?: number
}

export class TranscriptionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'TranscriptionError'
  }
}

interface TranscribeFunctionResponse {
  text?: string
  language?: string
  duration?: number
  error?: string
}

async function readErrorMessage(error: FunctionsHttpError): Promise<string> {
  try {
    const body = (await error.context.json()) as { error?: string }
    return body.error ?? error.message
  } catch {
    return error.message
  }
}

export async function transcribeAudio(
  audioBlob: Blob,
  language = 'ko',
): Promise<TranscriptionResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new TranscriptionError('User not authenticated')
    }

    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    formData.append('language', language)

    const { data, error } = await supabase.functions.invoke<TranscribeFunctionResponse>(
      'transcribe',
      {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    )

    if (error) {
      const message =
        error instanceof FunctionsHttpError ? await readErrorMessage(error) : error.message
      throw new TranscriptionError(message, error)
    }

    if (!data?.text) {
      throw new TranscriptionError('Transcription response missing text')
    }

    return {
      text: data.text,
      language: data.language,
      duration: data.duration,
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: 'transcription' },
      contexts: { audio: { size: audioBlob.size, type: audioBlob.type } },
    })
    throw error
  }
}

export async function saveTranscription(
  text: string,
  language?: string,
  audioDuration?: number,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new TranscriptionError('User not authenticated')
  }

  const transcription: TranscriptionInsert = {
    user_id: user.id,
    raw_text: text,
    edited_text: null,
    audio_duration_seconds: audioDuration,
    language: language || 'ko',
  }

  const { data, error } = await supabase
    .from('transcriptions')
    .insert(transcription)
    .select('id')
    .single()

  if (error) {
    Sentry.captureException(error, {
      tags: { service: 'transcription', action: 'save' },
    })
    throw error
  }

  return data.id
}
