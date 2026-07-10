import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ko } from 'date-fns/locale'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Search, Trash2 } from 'lucide-react'

type Transcription = Database['public']['Tables']['transcriptions']['Row']

export function TranscriptionHistory() {
  const [items, setItems] = useState<Transcription[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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
    } else {
      setItems((prev) => prev.filter((item) => item.id !== id))
      toast.success('삭제되었습니다')
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
          <Card key={item.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">
                  {formatDistanceToNow(new Date(item.created_at), {
                    addSuffix: true,
                    locale: ko,
                  })}
                </p>
                <p className="text-base whitespace-pre-wrap">
                  {item.edited_text || item.raw_text}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(item.edited_text || item.raw_text)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
