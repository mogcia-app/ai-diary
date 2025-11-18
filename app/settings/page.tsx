'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getDocument, updateDocument, UserSettings, ShopSetting } from '@/lib/firestore'
import { db } from '@/lib/firebase'
import { doc, setDoc, Timestamp } from 'firebase/firestore'
import Link from 'next/link'
import Header from '@/components/Header'

export default function SettingsPage() {
  const { currentUser } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 店舗管理のstate
  const [shops, setShops] = useState<ShopSetting[]>([])
  const [currentShopIndex, setCurrentShopIndex] = useState(0)
  const [settingsId, setSettingsId] = useState<string | null>(null)

  // 現在の店舗の設定項目のstate
  const [stageName, setStageName] = useState('')
  const [catchphrase, setCatchphrase] = useState('')
  const [shopIndustry, setShopIndustry] = useState<'delivery' | 'soap' | 'ns-soap' | ''>('')
  const [shopIndustryOpen, setShopIndustryOpen] = useState(false)
  const [shopName, setShopName] = useState('')
  const [shopCourses, setShopCourses] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<'low' | 'medium' | 'high' | ''>('')
  const [shopConcept, setShopConcept] = useState('')
  const [shopPersonalities, setShopPersonalities] = useState<string[]>([])
  const [shopTraits, setShopTraits] = useState<string[]>([])
  const [serviceStyle, setServiceStyle] = useState('')
  const [ngWords, setNgWords] = useState<string[]>([])
  const [targetCustomers, setTargetCustomers] = useState('')

  // 入力用のstate
  const [courseInput, setCourseInput] = useState('')
  const [personalityInput, setPersonalityInput] = useState('')
  const [traitInput, setTraitInput] = useState('')
  const [ngWordInput, setNgWordInput] = useState('')

  const shopIndustries = [
    { value: 'delivery', label: 'デリヘル' },
    { value: 'soap', label: 'ソープ' },
    { value: 'ns-soap', label: 'NSソープ' },
  ]

  useEffect(() => {
    if (!currentUser) {
      router.push('/login')
      return
    }
    loadSettings()
  }, [currentUser, router])

  // 現在の店舗の設定をstateに反映
  useEffect(() => {
    if (shops.length > 0 && currentShopIndex >= 0 && currentShopIndex < shops.length) {
      const currentShop = shops[currentShopIndex]
      setStageName(currentShop.stageName || '')
      setCatchphrase(currentShop.catchphrase || '')
      setShopIndustry(currentShop.shopIndustry || '')
      setShopName(currentShop.shopName || '')
      setShopCourses(currentShop.shopCourses || [])
      setPriceRange(currentShop.priceRange || '')
      setShopConcept(currentShop.shopConcept || '')
      setShopPersonalities(currentShop.shopPersonalities || [])
      setShopTraits(currentShop.shopTraits || [])
      setServiceStyle(currentShop.serviceStyle || '')
      setNgWords(currentShop.ngWords || [])
      setTargetCustomers(currentShop.targetCustomers || '')
    }
  }, [shops, currentShopIndex])

  const loadSettings = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const settings = await getDocument<UserSettings>('userSettings', currentUser.uid)
      if (settings && settings.shops && settings.shops.length > 0) {
        setSettingsId(currentUser.uid)
        setShops(settings.shops)
        setCurrentShopIndex(settings.currentShopIndex ?? 0)
      } else {
        // 初回は空の店舗を1つ作成
        setSettingsId(currentUser.uid)
        const initialShop: ShopSetting = {}
        setShops([initialShop])
        setCurrentShopIndex(0)
      }
    } catch (err) {
      console.error('設定の読み込みエラー:', err)
      // エラー時も空の店舗を1つ作成
      const initialShop: ShopSetting = {}
      setShops([initialShop])
      setCurrentShopIndex(0)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // 現在の店舗の設定を更新
      const updatedShops = [...shops]
      updatedShops[currentShopIndex] = {
        stageName,
        catchphrase,
        shopIndustry: shopIndustry || undefined,
        shopName,
        shopCourses,
        priceRange: priceRange || undefined,
        shopConcept,
        shopPersonalities,
        shopTraits,
        serviceStyle,
        ngWords,
        targetCustomers,
      }

      const settingsData: Omit<UserSettings, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: currentUser.uid,
        shops: updatedShops,
        currentShopIndex,
      }

      // userIdをドキュメントIDとして使用
      const docId = currentUser.uid
      
      // 既存のドキュメントを確認
      const existing = await getDocument<UserSettings>('userSettings', docId)
      
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
      
      setSettingsId(docId)
      setShops(updatedShops)

      setSuccess('設定を保存しました')
    } catch (err: any) {
      setError(err.message || '設定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleAddShop = () => {
    const newShop: ShopSetting = {}
    setShops([...shops, newShop])
    setCurrentShopIndex(shops.length)
  }

  const handleDeleteShop = (index: number) => {
    if (shops.length <= 1) {
      setError('最低1つの店舗設定が必要です')
      return
    }
    const updatedShops = shops.filter((_, i) => i !== index)
    setShops(updatedShops)
    if (currentShopIndex >= updatedShops.length) {
      setCurrentShopIndex(updatedShops.length - 1)
    } else if (currentShopIndex > index) {
      setCurrentShopIndex(currentShopIndex - 1)
    }
  }

  const handleTabChange = (index: number) => {
    // 現在の店舗の設定を保存
    const updatedShops = [...shops]
    updatedShops[currentShopIndex] = {
      stageName,
      catchphrase,
      shopIndustry: shopIndustry || undefined,
      shopName,
      shopCourses,
      priceRange: priceRange || undefined,
      shopConcept,
      shopPersonalities,
      shopTraits,
      serviceStyle,
      ngWords,
      targetCustomers,
    }
    setShops(updatedShops)
    setCurrentShopIndex(index)
  }

  const getShopDisplayName = (shop: ShopSetting, index: number) => {
    if (shop.shopName) {
      return shop.shopName
    }
    if (shop.stageName) {
      return shop.stageName
    }
    return `店舗${index + 1}`
  }

  const addPersonality = () => {
    if (personalityInput.trim() && !shopPersonalities.includes(personalityInput.trim())) {
      setShopPersonalities([...shopPersonalities, personalityInput.trim()])
      setPersonalityInput('')
    }
  }

  const removePersonality = (item: string) => {
    setShopPersonalities(shopPersonalities.filter(p => p !== item))
  }

  const addTrait = () => {
    if (traitInput.trim() && !shopTraits.includes(traitInput.trim())) {
      setShopTraits([...shopTraits, traitInput.trim()])
      setTraitInput('')
    }
  }

  const removeTrait = (item: string) => {
    setShopTraits(shopTraits.filter(t => t !== item))
  }

  const addCourse = () => {
    if (courseInput.trim() && !shopCourses.includes(courseInput.trim())) {
      setShopCourses([...shopCourses, courseInput.trim()])
      setCourseInput('')
    }
  }

  const removeCourse = (item: string) => {
    setShopCourses(shopCourses.filter(c => c !== item))
  }

  const addNgWord = () => {
    if (ngWordInput.trim() && !ngWords.includes(ngWordInput.trim())) {
      setNgWords([...ngWords, ngWordInput.trim()])
      setNgWordInput('')
    }
  }

  const removeNgWord = (item: string) => {
    setNgWords(ngWords.filter(w => w !== item))
  }


  if (!currentUser) {
    return null
  }

  return (
    <main>
      <Header showBackButton={true} showPostsButton={true} />

      <div className="settings-container">
        <div className="settings-card">
          <h2 className="settings-title">設定</h2>

          {error && <div className="settings-error">{error}</div>}
          {success && <div className="settings-success">{success}</div>}

          {loading ? (
            <div className="settings-loading">読み込み中...</div>
          ) : (
            <>
              {/* タブ */}
              <div className="settings-tabs">
                {shops.map((shop, index) => (
                  <div key={index} className="settings-tab-wrapper">
                    <button
                      type="button"
                      onClick={() => handleTabChange(index)}
                      className={`settings-tab ${currentShopIndex === index ? 'active' : ''}`}
                    >
                      {getShopDisplayName(shop, index)}
                    </button>
                    {shops.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteShop(index)}
                        className="settings-tab-delete"
                        title="削除"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddShop}
                  className="settings-tab settings-tab-add"
                >
                  + 新しい店舗
                </button>
              </div>

              <form onSubmit={handleSave} className="settings-form">
                <div className="settings-section">
                  <h3 className="settings-section-title">基本情報</h3>
                  
                  <div className="settings-item">
                    <label className="settings-label" htmlFor="stageName">源氏名</label>
                    <input
                      id="stageName"
                      type="text"
                      value={stageName}
                      onChange={(e) => setStageName(e.target.value)}
                      className="settings-input"
                      placeholder="源氏名を入力"
                    />
                  </div>

                  <div className="settings-item">
                    <label className="settings-label" htmlFor="catchphrase">キャッチコピー</label>
                    <input
                      id="catchphrase"
                      type="text"
                      value={catchphrase}
                      onChange={(e) => setCatchphrase(e.target.value)}
                      className="settings-input"
                      placeholder="キャッチコピーを入力"
                    />
                  </div>

                  <div className="settings-item">
                    <button
                      type="button"
                      onClick={() => setShopIndustryOpen(!shopIndustryOpen)}
                      className="category-toggle-header"
                    >
                      <label className="settings-label">お店の業種</label>
                      <span className="category-toggle-icon">
                        {shopIndustryOpen ? '▼' : '▶'}
                      </span>
                    </button>
                    {shopIndustryOpen && (
                      <div className="category-options">
                        {shopIndustries.map((industry) => (
                          <button
                            key={industry.value}
                            type="button"
                            onClick={() => setShopIndustry(shopIndustry === industry.value ? '' : industry.value as 'delivery' | 'soap' | 'ns-soap')}
                            className={`category-option-button ${shopIndustry === industry.value ? 'active' : ''}`}
                          >
                            {industry.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {shopIndustry && (
                      <div className="category-selected">
                        選択中: {shopIndustries.find(i => i.value === shopIndustry)?.label}
                      </div>
                    )}
                  </div>

                  <div className="settings-item">
                    <label className="settings-label" htmlFor="shopName">お店の名前</label>
                    <input
                      id="shopName"
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="settings-input"
                      placeholder="お店の名前を入力"
                    />
                  </div>

                  <div className="settings-item">
                    <label className="settings-label">お店のコース（追加可能）</label>
                    <div className="settings-tag-input">
                      <input
                        type="text"
                        value={courseInput}
                        onChange={(e) => setCourseInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addCourse()
                          }
                        }}
                        className="settings-input"
                        placeholder="コース名を入力してEnter"
                      />
                      <button type="button" onClick={addCourse} className="settings-add-button">
                        追加
                      </button>
                    </div>
                    <div className="settings-tags">
                      {shopCourses.map((course) => (
                        <span key={course} className="settings-tag">
                          {course}
                          <button type="button" onClick={() => removeCourse(course)} className="settings-tag-remove">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="settings-item">
                    <label className="settings-label">お店の価格帯</label>
                    <div className="settings-radio-group">
                      <label className="settings-radio">
                        <input
                          type="radio"
                          value="low"
                          checked={priceRange === 'low'}
                          onChange={(e) => setPriceRange(e.target.value as 'low' | 'medium' | 'high')}
                        />
                        <span>低</span>
                      </label>
                      <label className="settings-radio">
                        <input
                          type="radio"
                          value="medium"
                          checked={priceRange === 'medium'}
                          onChange={(e) => setPriceRange(e.target.value as 'low' | 'medium' | 'high')}
                        />
                        <span>中</span>
                      </label>
                      <label className="settings-radio">
                        <input
                          type="radio"
                          value="high"
                          checked={priceRange === 'high'}
                          onChange={(e) => setPriceRange(e.target.value as 'low' | 'medium' | 'high')}
                        />
                        <span>高</span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-item">
                    <label className="settings-label" htmlFor="shopConcept">お店のコンセプト</label>
                    <textarea
                      id="shopConcept"
                      value={shopConcept}
                      onChange={(e) => setShopConcept(e.target.value)}
                      className="settings-textarea"
                      rows={3}
                      placeholder="お店のコンセプトを入力"
                    />
                  </div>
                </div>

                <div className="settings-section">
                  <h3 className="settings-section-title">キャラクター設定</h3>

                  <div className="settings-item">
                    <label className="settings-label">お店が設定した性格（複数選択可能）</label>
                    <div className="settings-tag-input">
                      <input
                        type="text"
                        value={personalityInput}
                        onChange={(e) => setPersonalityInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addPersonality()
                          }
                        }}
                        className="settings-input"
                        placeholder="性格を入力してEnter"
                      />
                      <button type="button" onClick={addPersonality} className="settings-add-button">
                        追加
                      </button>
                    </div>
                    <div className="settings-tags">
                      {shopPersonalities.map((p) => (
                        <span key={p} className="settings-tag">
                          {p}
                          <button type="button" onClick={() => removePersonality(p)} className="settings-tag-remove">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="settings-item">
                    <label className="settings-label">お店が設定した個性（複数選択可能）</label>
                    <div className="settings-tag-input">
                      <input
                        type="text"
                        value={traitInput}
                        onChange={(e) => setTraitInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addTrait()
                          }
                        }}
                        className="settings-input"
                        placeholder="個性を入力してEnter"
                      />
                      <button type="button" onClick={addTrait} className="settings-add-button">
                        追加
                      </button>
                    </div>
                    <div className="settings-tags">
                      {shopTraits.map((t) => (
                        <span key={t} className="settings-tag">
                          {t}
                          <button type="button" onClick={() => removeTrait(t)} className="settings-tag-remove">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="settings-item">
                    <label className="settings-label" htmlFor="serviceStyle">接客スタイル</label>
                    <textarea
                      id="serviceStyle"
                      value={serviceStyle}
                      onChange={(e) => setServiceStyle(e.target.value)}
                      className="settings-textarea"
                      rows={4}
                      placeholder="接客スタイルを記述"
                    />
                  </div>
                </div>

                <div className="settings-section">
                  <h3 className="settings-section-title">その他設定</h3>

                  <div className="settings-item">
                    <label className="settings-label">NGワード設定（複数設定可能）</label>
                    <div className="settings-tag-input">
                      <input
                        type="text"
                        value={ngWordInput}
                        onChange={(e) => setNgWordInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addNgWord()
                          }
                        }}
                        className="settings-input"
                        placeholder="NGワードを入力してEnter"
                      />
                      <button type="button" onClick={addNgWord} className="settings-add-button">
                        追加
                      </button>
                    </div>
                    <div className="settings-tags">
                      {ngWords.map((w) => (
                        <span key={w} className="settings-tag">
                          {w}
                          <button type="button" onClick={() => removeNgWord(w)} className="settings-tag-remove">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="settings-item">
                    <label className="settings-label" htmlFor="targetCustomers">どんなお客さんに来て欲しいか</label>
                    <textarea
                      id="targetCustomers"
                      value={targetCustomers}
                      onChange={(e) => setTargetCustomers(e.target.value)}
                      className="settings-textarea"
                      rows={4}
                      placeholder="希望するお客様像を記述"
                    />
                  </div>
                </div>

                <div className="settings-actions">
                  <button type="submit" disabled={saving} className="settings-save-button">
                    {saving ? '保存中...' : '設定を保存'}
                  </button>
                </div>

                <div className="settings-section">
                  <h3 className="settings-section-title">アカウント情報</h3>
                  <div className="settings-item">
                    <label className="settings-label">メールアドレス</label>
                    <div className="settings-value">{currentUser.email}</div>
                  </div>
                </div>

                <div className="settings-back">
                  <Link href="/" className="settings-back-link">
                    ← ホームに戻る
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
