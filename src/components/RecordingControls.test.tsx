import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RecordingControls } from '@/components/RecordingControls'

afterEach(() => cleanup())

describe('RecordingControls', () => {
  it('대기 상태에서 시작 버튼을 렌더링하고 클릭 시 onStartRecording을 호출한다', () => {
    const onStartRecording = vi.fn()
    const onStopRecording = vi.fn()
    render(
      <RecordingControls
        isRecording={false}
        isProcessing={false}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
      />,
    )

    expect(screen.getByText('녹음을 시작하려면 버튼을 누르세요')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: '녹음 시작' })
    fireEvent.click(button)

    expect(onStartRecording).toHaveBeenCalledTimes(1)
    expect(onStopRecording).not.toHaveBeenCalled()
  })

  it('녹음 중 상태에서 중지 버튼을 렌더링하고 클릭 시 onStopRecording을 호출한다', () => {
    const onStartRecording = vi.fn()
    const onStopRecording = vi.fn()
    render(
      <RecordingControls
        isRecording={true}
        isProcessing={false}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
      />,
    )

    expect(screen.getByText('녹음 중...')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: '녹음 중지' })
    fireEvent.click(button)

    expect(onStopRecording).toHaveBeenCalledTimes(1)
    expect(onStartRecording).not.toHaveBeenCalled()
  })

  it('변환 처리 중일 때 상태 텍스트를 표시한다', () => {
    render(
      <RecordingControls
        isRecording={false}
        isProcessing={true}
        onStartRecording={vi.fn()}
        onStopRecording={vi.fn()}
      />,
    )

    expect(screen.getByText('텍스트로 변환 중...')).toBeInTheDocument()
  })

  it('변환 처리 중일 때 버튼이 비활성화되어 클릭해도 콜백이 호출되지 않는다', () => {
    const onStartRecording = vi.fn()
    const onStopRecording = vi.fn()
    render(
      <RecordingControls
        isRecording={false}
        isProcessing={true}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
      />,
    )

    const button = screen.getByRole('button', { name: '녹음 시작' })
    expect(button).toBeDisabled()

    fireEvent.click(button)
    expect(onStartRecording).not.toHaveBeenCalled()
    expect(onStopRecording).not.toHaveBeenCalled()
  })
})
