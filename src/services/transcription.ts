import { supabase } from '@/lib/supabase'
import * as Sentry from '@sentry/react'
import { FunctionsHttpError } from '@supabase/supabase-js'

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
