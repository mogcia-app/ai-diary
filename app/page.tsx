'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createDocument, getDocumentsByUserId, getDocument, updateDocument, DiaryEntry, UserSettings } from '@/lib/firestore'
import { Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'
import Header from '@/components/Header'

export default function Home() {
  const { currentUser } = useAuth()
  const router = useRouter()
  const [selectedShopIndex, setSelectedShopIndex] = useState(0)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [category, setCategory] = useState<string>('')
  const [toneOpen, setToneOpen] = useState(false)
  const [tone, setTone] = useState<string>('')
  const [courseMinutes, setCourseMinutes] = useState<string>('')
  const [customerType, setCustomerType] = useState<string>('')
  const [otherInfo, setOtherInfo] = useState<string>('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [aiTheme, setAiTheme] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [endingTemplate, setEndingTemplate] = useState('')
  // 初期テンプレート
  const defaultTemplates = [
    'SNSでも投稿発信してるので見てね！\nTwitter→',
    'ご予約はこちら\nメールアドレス→',
    '今月限定クーポン配信中\n合言葉→\n予約の際にお店に伝えてね',
  ]
  const [endingTemplates, setEndingTemplates] = useState<string[]>(defaultTemplates)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)

  const categories = [
    '出勤前',
    '出勤中',
    'お礼',
    '退勤後',
    'キャラ付け',
    'その他',
  ]

  useEffect(() => {
    if (!currentUser) {
      router.push('/login')
      return
    }
    
    // データ読み込みを即座に開始（非同期で実行）
    const loadData = async () => {
      try {
        await Promise.all([loadEntries(), loadSettings()])
      } catch (error) {
        console.error('データ読み込みエラー:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, router])

  // 文末テンプレートが変更されたときに自動保存（初期読み込み時は除外）
  useEffect(() => {
    if (!isLoadingTemplates && currentUser) {
      saveEndingTemplates(endingTemplates)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endingTemplates])

  const loadSettings = async () => {
    if (!currentUser) return
    try {
      const userSettings = await getDocument<UserSettings>('userSettings', currentUser.uid)
      if (userSettings) {
        setSettings(userSettings)
        // 設定から現在の店舗インデックスを取得して更新
        if (userSettings.currentShopIndex !== undefined) {
          setSelectedShopIndex(userSettings.currentShopIndex)
        }
        // 設定から文末テンプレートを読み込む（デフォルト値がある場合はそれを使用）
        if (userSettings.endingTemplates && userSettings.endingTemplates.length > 0) {
          setEndingTemplates(userSettings.endingTemplates)
        }
      }
      setIsLoadingTemplates(false)
    } catch (err: any) {
      // オフライン時はエラーを無視（キャッシュから読み込めなかった場合）
      if (err.code !== 'unavailable' && !err.message?.includes('offline')) {
        console.error('設定の読み込みエラー:', err)
      }
      setIsLoadingTemplates(false)
    }
  }

  const saveEndingTemplates = async (templates: string[]) => {
    if (!currentUser) return
    try {
      const docId = currentUser.uid
      const existing = await getDocument<UserSettings>('userSettings', docId)
      
      const settingsData: Omit<UserSettings, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: currentUser.uid,
        shops: existing?.shops || [],
        currentShopIndex: existing?.currentShopIndex ?? 0,
        endingTemplates: templates,
      }

      if (existing) {
        // 更新
        await updateDocument('userSettings', docId, settingsData)
      } else {
        // 新規作成
        if (!db) {
          throw new Error('Firestore is not initialized')
        }
        const docRef = doc(db, 'userSettings', docId)
        await setDoc(docRef, {
          ...settingsData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }, { merge: false })
      }
    } catch (err: any) {
      console.error('文末テンプレートの保存エラー:', err)
    }
  }

  const handleShopSelect = (index: number) => {
    setSelectedShopIndex(index)
    setShopDropdownOpen(false)
  }

  const loadEntries = async () => {
    if (!currentUser) return
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
    } catch (err: any) {
      // オフライン時はエラーを無視（キャッシュから読み込めなかった場合）
      if (err.code !== 'unavailable' && !err.message?.includes('offline')) {
        console.error('投稿の読み込みエラー:', err)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    if (!title.trim() || !content.trim()) {
      setError('タイトルと投稿文を入力してください')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await createDocument<DiaryEntry>('diaries', {
        userId: currentUser.uid,
        title: title.trim(),
        content: content.trim(),
      } as Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>)
      
      // フォームをリセット
      setTitle('')
      setContent('')
      
      // 投稿一覧を再読み込み（オフライン時はエラーを無視）
      try {
        await loadEntries()
      } catch (loadErr) {
        // オフライン時の読み込みエラーは無視
      }
      
      // オフライン時でも保存成功メッセージを表示
      if (!navigator.onLine) {
        setSuccess('オフラインです。投稿は保存され、オンライン時に自動的に同期されます。')
      } else {
        setSuccess('投稿を保存しました')
      }
      
      // 3秒後に成功メッセージを非表示
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      // オフライン時のエラーは特別なメッセージを表示
      if (err.code === 'unavailable' || !navigator.onLine) {
        setError('オフラインです。投稿は保存され、オンライン時に自動的に同期されます。')
      } else {
        setError(err.message || '投稿の保存に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAiGenerate = async (autoTheme: boolean) => {
    if (!currentUser) return
    
    setAiGenerating(true)
    setError('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          theme: aiTheme,
          autoTheme: autoTheme,
          category: category,
          tone: tone,
          courseMinutes: courseMinutes,
          customerType: customerType,
          otherInfo: otherInfo,
          userId: currentUser.uid,
          shopIndex: selectedShopIndex,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'AI生成に失敗しました')
      }

      const data = await response.json()
      
      if (data.theme) {
        setAiTheme(data.theme)
      }
      
      if (data.title) {
        setTitle(data.title)
      }
      
      if (data.content) {
        setContent(data.content)
      }
    } catch (err: any) {
      // ネットワークエラーの場合
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || !navigator.onLine) {
        setError('インターネット接続が必要です。AI生成機能はオンライン時のみ利用できます。')
      } else {
        setError(err.message || 'AI生成に失敗しました')
      }
    } finally {
      setAiGenerating(false)
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
      <Header 
        showSettingsButton={true} 
        showPostsButton={true} 
        showCalendarButton={true}
        showLogoutButton={true}
      />
      
      <div className="editor-container">
        <div className="editor-card">
          <h2 className="editor-title">新規投稿</h2>
          
          {loading && (
            <div className="editor-loading" style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
              読み込み中...
            </div>
          )}
          
          {error && <div className="editor-error">{error}</div>}
          {success && <div className="settings-success">{success}</div>}
          
          {!loading && (

          <form onSubmit={handleSubmit} className="editor-form">
            {settings && settings.shops && settings.shops.length > 0 && (
              <div className="editor-form-group">
                <label>源氏名・店舗</label>
                {settings.shops.length === 1 ? (
                  <div className="shop-selector-single">
                    {settings.shops[0].stageName || '未設定'} - {settings.shops[0].shopName || '未設定'}
                  </div>
                ) : (
                  <div className="shop-selector-dropdown">
                    <button
                      type="button"
                      onClick={() => setShopDropdownOpen(!shopDropdownOpen)}
                      className="shop-selector-dropdown-button"
                    >
                      {settings.shops[selectedShopIndex]?.stageName || '未設定'} - {settings.shops[selectedShopIndex]?.shopName || '未設定'}
                      <span className="shop-selector-dropdown-icon">
                        {shopDropdownOpen ? '▼' : '▶'}
                      </span>
                    </button>
                    {shopDropdownOpen && (
                      <div className="shop-selector-dropdown-menu">
                        {settings.shops.map((shop, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleShopSelect(index)}
                            className={`shop-selector-dropdown-item ${selectedShopIndex === index ? 'active' : ''}`}
                          >
                            {shop.stageName || '未設定'} - {shop.shopName || '未設定'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="ai-generator-section">
              <h3 className="ai-generator-title">AI投稿文生成</h3>
              
              <div className="editor-form-group">
                <button
                  type="button"
                  onClick={() => setCategoryOpen(!categoryOpen)}
                  className="category-toggle-header"
                >
                  <label>カテゴリ</label>
                  <span className="category-toggle-icon">
                    ▼
                  </span>
                </button>
                {categoryOpen && (
                  <div className="category-options">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(category === cat ? '' : cat)}
                        className={`category-option-button ${category === cat ? 'active' : ''}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
                {category && (
                  <div className="category-selected">
                    選択中: {category}
                  </div>
                )}
                
                {category === 'お礼' && (
                  <div className="category-details" style={{ marginTop: '16px' }}>
                    <div className="editor-form-group" style={{ marginBottom: '12px' }}>
                      <label htmlFor="courseMinutes">コース時間（分）</label>
                      <input
                        id="courseMinutes"
                        type="text"
                        value={courseMinutes}
                        onChange={(e) => setCourseMinutes(e.target.value)}
                        placeholder="例: 60, 90, 120"
                        className="editor-input"
                      />
                    </div>
                    
                    <div className="editor-form-group" style={{ marginBottom: '12px' }}>
                      <label>お客様タイプ</label>
                      <div className="customer-type-options">
                        {['新規', 'フリー', 'リピーター'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setCustomerType(customerType === type ? '' : type)}
                            className={`customer-type-button ${customerType === type ? 'active' : ''}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="editor-form-group">
                      <label htmlFor="otherInfo">その他</label>
                      <textarea
                        id="otherInfo"
                        value={otherInfo}
                        onChange={(e) => setOtherInfo(e.target.value)}
                        placeholder="その他の情報を入力"
                        className="editor-textarea"
                        rows={3}
                      />
                    </div>
                  </div>
                )}
                
                {category === 'その他' && (
                  <div className="category-details" style={{ marginTop: '16px' }}>
                    <div className="editor-form-group">
                      <label htmlFor="otherInfo">その他</label>
                      <textarea
                        id="otherInfo"
                        value={otherInfo}
                        onChange={(e) => setOtherInfo(e.target.value)}
                        placeholder="その他の情報を入力"
                        className="editor-textarea"
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="editor-form-group">
                <button
                  type="button"
                  onClick={() => setToneOpen(!toneOpen)}
                  className="category-toggle-header"
                >
                  <label>トーン</label>
                  <span className="category-toggle-icon">
                    ▼
                  </span>
                </button>
                {toneOpen && (
                  <div className="tone-options">
                    {['甘め', '強め', '清楚', 'ゆるふわ', '大人の色気', 'フレンドリー'].map((toneOption) => (
                      <button
                        key={toneOption}
                        type="button"
                        onClick={() => setTone(tone === toneOption ? '' : toneOption)}
                        className={`tone-option-button ${tone === toneOption ? 'active' : ''}`}
                      >
                        {toneOption}
                      </button>
                    ))}
                  </div>
                )}
                {tone && (
                  <div className="tone-selected">
                    選択中: {tone}
                  </div>
                )}
              </div>
              
              <div className="editor-form-group">
                <label htmlFor="aiTheme">
                  投稿テーマ（オプション）
                </label>
                <input
                  id="aiTheme"
                  type="text"
                  value={aiTheme}
                  onChange={(e) => setAiTheme(e.target.value)}
                  placeholder="例: 出勤しました、今日の1日など..."
                  className="editor-input"
                />
                
              </div>

              <div className="ai-generator-buttons">
                <button
                  type="button"
                  onClick={() => handleAiGenerate(true)}
                  disabled={aiGenerating}
                  className="ai-generator-button ai-generator-button-auto"
                >
                  {aiGenerating ? '生成中...' : '自動生成（テーマも自動選択）'}
                </button>
                <button
                  type="button"
                  onClick={() => handleAiGenerate(false)}
                  disabled={aiGenerating || !aiTheme.trim()}
                  className="ai-generator-button ai-generator-button-theme"
                >
                  {aiGenerating ? '生成中...' : 'テーマ指定生成'}
                </button>
              </div>
            </div>

            <div className="editor-form-group">
              <label htmlFor="title">タイトル</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="タイトルを入力"
                className="editor-input"
                required
              />
            </div>

            <div className="editor-form-group">
              <label htmlFor="content">投稿文</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="投稿文を入力"
                className="editor-textarea"
                rows={8}
                required
              />
            </div>

            <div className="ending-template-section">
              <h3 className="ending-template-title">文末テンプレート</h3>
              <div className="editor-form-group">
                <div className="ending-template-input-group">
                  <textarea
                    value={endingTemplate}
                    onChange={(e) => setEndingTemplate(e.target.value)}
                    placeholder="例: 今日もありがとうございました！"
                    className="ending-template-input-textarea"
                    rows={3}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (endingTemplate.trim()) {
                        const updated = [...endingTemplates, endingTemplate.trim()]
                        setEndingTemplates(updated)
                        setEndingTemplate('')
                      }
                    }}
                    className="ending-template-add-button"
                  >
                    追加
                  </button>
                </div>
                {endingTemplates.length > 0 && (
                  <div className="ending-templates-list">
                    {endingTemplates.map((template, index) => (
                      <div key={index} className="ending-template-item">
                        {editingIndex === index ? (
                          <>
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="ending-template-edit-textarea"
                              rows={3}
                            />
                            <div className="ending-template-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...endingTemplates]
                                  updated[index] = editingText.trim()
                                  setEndingTemplates(updated)
                                  setEditingIndex(null)
                                  setEditingText('')
                                }}
                                className="ending-template-save-button"
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingIndex(null)
                                  setEditingText('')
                                }}
                                className="ending-template-cancel-button"
                              >
                                キャンセル
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="ending-template-text">{template}</span>
                            <div className="ending-template-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  setContent((prev) => {
                                    const trimmed = prev.trim()
                                    return trimmed ? `${trimmed}\n\n${template}` : template
                                  })
                                }}
                                className="ending-template-apply-button"
                              >
                                適用
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingIndex(index)
                                  setEditingText(template)
                                }}
                                className="ending-template-edit-button"
                              >
                                編集
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = endingTemplates.filter((_, i) => i !== index)
                                  setEndingTemplates(updated)
                                }}
                                className="ending-template-remove-button"
                              >
                                削除
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="preview-section">
              <h3 className="preview-title">プレビュー</h3>
              {title || content ? (
                <div className="preview-content">
                  <div className="preview-item">
                    <div className="preview-item-header">
                      <label className="preview-label">タイトル</label>
                    </div>
                    <div className="preview-text">{title || '（未入力）'}</div>
                  </div>
                  <div className="preview-item">
                    <div className="preview-item-header">
                      <label className="preview-label">本文</label>
                    </div>
                    <div className="preview-text preview-text-content">{content || '（未入力）'}</div>
                  </div>
                </div>
              ) : (
                <div className="preview-empty-message">
                  タイトルまたは本文を入力すると、ここでプレビューを確認できます
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="editor-submit-button"
            >
              {loading ? '保存中...' : '投稿を保存'}
            </button>
          </form>
          )}
        </div>
      </div>
    </main>
  )
}

