'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getDocumentsByUserId, deleteDocument, DiaryEntry } from '@/lib/firestore'
import { Timestamp } from 'firebase/firestore'
import Header from '@/components/Header'

export default function PostsPage() {
  const { currentUser } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentUser) {
      router.push('/login')
      return
    }
    loadEntries()
  }, [currentUser, router])

  const loadEntries = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const loadedEntries = await getDocumentsByUserId<DiaryEntry>(
        'diaries',
        currentUser.uid
      )
      // 日付順（新しい順）にソート
      loadedEntries.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0
        const bTime = b.createdAt?.toMillis() || 0
        return bTime - aTime
      })
      setEntries(loadedEntries)
    } catch (err) {
      console.error('投稿の読み込みエラー:', err)
      setError('投稿の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (entryId: string) => {
    if (!confirm('この投稿を削除しますか？')) {
      return
    }

    try {
      await deleteDocument('diaries', entryId)
      await loadEntries()
    } catch (err: any) {
      setError(err.message || '投稿の削除に失敗しました')
    }
  }

  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}年${month}月${day}日`
  }

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }

  const formatTimestamp = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return ''
    const date = timestamp.toDate()
    return `${formatDate(date)} ${formatTime(date)}`
  }

  if (!currentUser) {
    return null
  }

  return (
    <main>
      <Header showBackButton={true} showSettingsButton={true} showLogoutButton={true} />

      <div className="posts-container">
        <div className="posts-card">
          <h2 className="posts-title">投稿一覧</h2>

          {error && <div className="posts-error">{error}</div>}

          {loading ? (
            <div className="posts-loading">読み込み中...</div>
          ) : entries.length === 0 ? (
            <div className="empty-message">まだ投稿がありません</div>
          ) : (
            <div className="posts-list">
              {entries.map((entry) => (
                <div key={entry.id} className="posts-item">
                  <div className="posts-item-header">
                    <h3 className="posts-item-title">{entry.title}</h3>
                    <button
                      onClick={() => entry.id && handleDelete(entry.id)}
                      className="posts-delete-button"
                    >
                      削除
                    </button>
                  </div>
                  <div className="posts-item-meta">
                    {entry.postDate && entry.postTime
                      ? `${entry.postDate} ${entry.postTime}`
                      : formatTimestamp(entry.createdAt)}
                  </div>
                  <div className="posts-item-content">{entry.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

