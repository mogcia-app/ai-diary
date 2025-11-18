'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
  showSettingsButton?: boolean
  showBackButton?: boolean
  showLogoutButton?: boolean
  showPostsButton?: boolean
}

export default function Header({ 
  showSettingsButton = false, 
  showBackButton = false,
  showLogoutButton = false,
  showPostsButton = false
}: HeaderProps) {
  const { currentUser, logout } = useAuth()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

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

  return (
    <header className="header">
      <div className="header-logo">
        <Link href="/">
          <img 
            src="/2.png" 
            alt="AI Diary" 
            className="header-logo-image"
            style={{
              height: '200px',
              position: 'absolute',
              top: '50%',
              left: '0px',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
            }}
          />
        </Link>
      </div>
      <div className="header-user">
        {/* デスクトップ用のボタン */}
        <div className="header-desktop-buttons">
          {showBackButton && (
            <Link href="/" className="settings-button">
              ←
            </Link>
          )}
          {showPostsButton && (
            <Link href="/posts" className="settings-button">
              📝
            </Link>
          )}
          {showSettingsButton && (
            <Link href="/settings" className="settings-button">
              ⚙️
            </Link>
          )}
          {showLogoutButton && (
            <button onClick={handleLogout} className="settings-button logout-icon-button" title="ログアウト">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <rect x="3" y="6" width="12" height="12" rx="2" />
                <path d="M15 12h6M18 9l3 3-3 3" />
              </svg>
            </button>
          )}
        </div>
        
        {/* スマホ用のハンバーガーメニュー */}
        <div className="header-mobile-menu">
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="header-hamburger-button"
            aria-label="メニュー"
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
          
          {menuOpen && (
            <div className="header-mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
              <div className="header-mobile-menu-content" onClick={(e) => e.stopPropagation()}>
                {showBackButton && (
                  <Link href="/" className="header-mobile-menu-item" onClick={() => setMenuOpen(false)}>
                    ホーム
                  </Link>
                )}
                {showPostsButton && (
                  <Link href="/posts" className="header-mobile-menu-item" onClick={() => setMenuOpen(false)}>
                    投稿一覧
                  </Link>
                )}
                {showSettingsButton && (
                  <Link href="/settings" className="header-mobile-menu-item" onClick={() => setMenuOpen(false)}>
                    設定
                  </Link>
                )}
                {showLogoutButton && (
                  <button 
                    onClick={() => {
                      setMenuOpen(false)
                      handleLogout()
                    }} 
                    className="header-mobile-menu-item header-mobile-menu-item-logout"
                  >
                    ログアウト
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

