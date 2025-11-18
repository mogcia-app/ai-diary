'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const { currentUser, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!currentUser) {
      router.push('/login')
    }
  }, [currentUser, router])

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/login')
    } catch (error) {
      console.error('ログアウトエラー:', error)
    }
  }

  if (!currentUser) {
    return null
  }

  const tiles = [
    {
      id: 1,
      title: 'タイル 1',
      content: 'これは最初のタイルウィンドウです。',
    },
    {
      id: 2,
      title: 'タイル 2',
      content: '2番目のタイルウィンドウのコンテンツです。',
    },
    {
      id: 3,
      title: 'タイル 3',
      content: '3番目のタイルウィンドウです。',
    },
    {
      id: 4,
      title: 'タイル 4',
      content: '4番目のタイルウィンドウのコンテンツです。',
    },
    {
      id: 5,
      title: 'タイル 5',
      content: '5番目のタイルウィンドウです。',
    },
    {
      id: 6,
      title: 'タイル 6',
      content: '6番目のタイルウィンドウのコンテンツです。',
    },
  ]

  return (
    <main>
      <header className="header">
        <h1>AI Diary</h1>
        <div className="header-user">
          <span className="header-email">{currentUser.email}</span>
          <button onClick={handleLogout} className="logout-button">
            ログアウト
          </button>
        </div>
      </header>
      <div className="tile-window-container">
        {tiles.map((tile) => (
          <div key={tile.id} className="tile-window">
            <div className="tile-window-header">{tile.title}</div>
            <div className="tile-window-content">{tile.content}</div>
          </div>
        ))}
      </div>
    </main>
  )
}

