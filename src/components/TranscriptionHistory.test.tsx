import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import type { Database } from '@/types/supabase'
import { TranscriptionHistory } from '@/components/TranscriptionHistory'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

type Transcription = Database['public']['Tables']['transcriptions']['Row']

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

// Mimics the shape of a real supabase-js PostgrestFilterBuilder: every query
// method returns the same chainable object, and the object itself is a
// thenable so `await supabase.from(...).select(...).order(...).limit(...)`
// resolves to the configured result.
function makeQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const methods = ['select', 'order', 'limit', 'or', 'eq', 'delete', 'update', 'insert'] as const
  const builder: Record<string, unknown> = {}
  methods.forEach((method) => {
    builder[method] = vi.fn(() => builder)
  })
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return builder as Record<(typeof methods)[number], ReturnType<typeof vi.fn>> & {
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => unknown
  }
}

function makeItem(overrides: Partial<Transcription> = {}): Transcription {
  return {
    id: '1',
    raw_text: '첫번째 항목',
    edited_text: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    language: 'ko',
    user_id: 'user-1',
    audio_duration_seconds: 3,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TranscriptionHistory', () => {
  it('마운트 시 히스토리 목록을 불러와 렌더링한다', async () => {
    const item = makeItem({ raw_text: '변환된 텍스트입니다' })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: [item], error: null }))

    render(<TranscriptionHistory />)

    expect(screen.getByText('로딩 중...')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('변환된 텍스트입니다')).toBeInTheDocument())
    expect(screen.getByText('변환 히스토리')).toBeInTheDocument()
    expect(screen.getAllByTestId('transcription-item')).toHaveLength(1)
  })

  it('복사 버튼 클릭 시 클립보드에 복사하고 토스트를 표시한다', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    const item = makeItem({ raw_text: '복사할 항목', edited_text: null })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: [item], error: null }))

    render(<TranscriptionHistory />)
    await waitFor(() => expect(screen.getByText('복사할 항목')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '복사' }))

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('복사할 항목'),
    )
    expect(toast.success).toHaveBeenCalledWith('클립보드에 복사되었습니다')
  })

  it('삭제 확인 시 항목을 삭제하고 onDataChange를 호출한다', async () => {
    const item = makeItem({ raw_text: '삭제할 항목' })
    const fetchBuilder = makeQueryBuilder({ data: [item], error: null })
    const deleteBuilder = makeQueryBuilder({ error: null })
    vi.mocked(supabase.from)
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(deleteBuilder)
    const onDataChange = vi.fn()

    render(<TranscriptionHistory onDataChange={onDataChange} />)
    await waitFor(() => expect(screen.getByText('삭제할 항목')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(screen.queryByText('삭제할 항목')).not.toBeInTheDocument())
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', item.id)
    expect(toast.success).toHaveBeenCalledWith('삭제되었습니다')
    expect(onDataChange).toHaveBeenCalledTimes(1)
  })

  it('편집 후 저장하면 수정된 텍스트로 업데이트된다', async () => {
    const item = makeItem({ raw_text: '원본 텍스트', edited_text: null })
    const fetchBuilder = makeQueryBuilder({ data: [item], error: null })
    const updateBuilder = makeQueryBuilder({ error: null })
    vi.mocked(supabase.from)
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(updateBuilder)

    render(<TranscriptionHistory />)
    await waitFor(() => expect(screen.getByText('원본 텍스트')).toBeInTheDocument())

    const historyItem = screen.getByTestId('transcription-item')
    fireEvent.click(within(historyItem).getByRole('button', { name: '편집' }))
    const textarea = within(historyItem).getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '수정된 텍스트' } })
    fireEvent.click(within(historyItem).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.getByText('수정된 텍스트')).toBeInTheDocument())
    expect(updateBuilder.update).toHaveBeenCalledWith({ edited_text: '수정된 텍스트' })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', item.id)
    expect(toast.success).toHaveBeenCalledWith('수정되었습니다')
  })

  it('검색 결과가 없을 때와 히스토리 자체가 없을 때 서로 다른 안내 문구를 표시한다', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: [], error: null }))

    render(<TranscriptionHistory />)
    await waitFor(() => expect(screen.getByText('아직 변환 기록이 없습니다')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('변환 결과 검색...'), {
      target: { value: '검색어' },
    })

    await waitFor(() => expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument())
  })

  it('삭제 요청이 실패하면 항목을 유지하고 실패 토스트를 표시한다', async () => {
    const item = makeItem({ raw_text: '삭제 실패 항목' })
    const fetchBuilder = makeQueryBuilder({ data: [item], error: null })
    const deleteBuilder = makeQueryBuilder({ error: { message: 'delete failed' } })
    vi.mocked(supabase.from)
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(deleteBuilder)

    render(<TranscriptionHistory />)
    await waitFor(() => expect(screen.getByText('삭제 실패 항목')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('삭제에 실패했습니다'))
    expect(screen.getByText('삭제 실패 항목')).toBeInTheDocument()
  })
})
