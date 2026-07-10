import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ko } from 'date-fns/locale'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, Copy, Pencil, Search, Trash2, X } from 'lucide-react'

type Transcription = Database['public']['Tables']['transcriptions']['Row']

const DELETE_ANIMATION_MS = 200

export function TranscriptionHistory() {
  const [items, setItems] = useState<Transcription[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchHistory = async (search: string) => {
    let query = supabase
      .from('transcriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (search.trim()) {
      query = query.or(`raw_text.ilike.%${search}%,edited_text.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('히스토리 조회 실패:', error)
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast.success('클립보드에 복사되었습니다')
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('transcriptions').delete().eq('id', id)

    if (error) {
      toast.error('삭제에 실패했습니다')
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      return
    }

    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id))
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, DELETE_ANIMATION_MS)
    toast.success('삭제되었습니다')
  }

  const confirmDelete = (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id))
    void handleDelete(id)
  }

  const startEdit = (item: Transcription) => {
    setEditingId(item.id)
    setEditText(item.edited_text || item.raw_text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const saveEdit = async (id: string) => {
    if (isSaving) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('transcriptions')
        .update({ edited_text: editText })
        .eq('id', id)

      if (error) throw error

      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, edited_text: editText } : item))
      )
      setEditingId(null)
      toast.success('수정되었습니다')
    } catch (error) {
      toast.error('저장에 실패했습니다')
      console.error('Edit save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      saveEdit(id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  if (loading) return <div>로딩 중...</div>

  return (
    <div className="w-full max-w-4xl space-y-4">
      <h2 className="text-2xl font-bold">변환 히스토리</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="변환 결과 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">
          {searchQuery.trim() ? '검색 결과가 없습니다' : '아직 변환 기록이 없습니다'}
        </p>
      ) : (
        items.map((item) => (
          <Card
            key={item.id}
            data-testid="transcription-item"
            className={`p-4 transition-all duration-200 ${
              deletingIds.has(item.id) ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">
                  {formatDistanceToNow(new Date(item.created_at), {
                    addSuffix: true,
                    locale: ko,
                  })}
                </p>
                {editingId === item.id ? (
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, item.id)}
                    className="min-h-[100px]"
                    disabled={isSaving}
                    autoFocus
                  />
                ) : (
                  <p className="text-base whitespace-pre-wrap">
                    {item.edited_text || item.raw_text}
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                {editingId === item.id ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="저장"
                      disabled={isSaving}
                      onClick={() => saveEdit(item.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="편집 취소"
                      disabled={isSaving}
                      onClick={cancelEdit}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="편집"
                      onClick={() => startEdit(item)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="복사"
                            onClick={() => handleCopy(item.edited_text || item.raw_text)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        }
                      />
                      <TooltipContent>클립보드에 복사</TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button type="button" variant="ghost" size="sm" aria-label="삭제">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription>
                            이 작업은 되돌릴 수 없습니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => confirmDelete(item.id)}
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
