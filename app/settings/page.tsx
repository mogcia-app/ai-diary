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
  const [hobby, setHobby] = useState<string[]>([])
  const [specialty, setSpecialty] = useState<string[]>([])
  const [recentHobby, setRecentHobby] = useState<string[]>([])
  const [preferredGift, setPreferredGift] = useState<string[]>([])
  const [workStartTime, setWorkStartTime] = useState('')
  const [workEndTime, setWorkEndTime] = useState('')
  const [nominationFeeFree, setNominationFeeFree] = useState('')
  const [nominationFeePanel, setNominationFeePanel] = useState('')
  const [nominationFeeNet, setNominationFeeNet] = useState('')
  const [nominationFeeDirect, setNominationFeeDirect] = useState('')
  const [backs, setBacks] = useState<string[]>([])
  const [miscFeePercent, setMiscFeePercent] = useState('')

  // 入力用のstate
  const [courseInput, setCourseInput] = useState('')
  const [personalityInput, setPersonalityInput] = useState('')
  const [traitInput, setTraitInput] = useState('')
  const [ngWordInput, setNgWordInput] = useState('')
  const [hobbyInput, setHobbyInput] = useState('')
  const [specialtyInput, setSpecialtyInput] = useState('')
  const [recentHobbyInput, setRecentHobbyInput] = useState('')
  const [preferredGiftInput, setPreferredGiftInput] = useState('')
  const [backTimeInput, setBackTimeInput] = useState('')
  const [backPriceInput, setBackPriceInput] = useState('')

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
      setHobby(currentShop.hobby || [])
      setSpecialty(currentShop.specialty || [])
      setRecentHobby(currentShop.recentHobby || [])
      setPreferredGift(currentShop.preferredGift || [])
      setWorkStartTime(currentShop.workStartTime || '')
      setWorkEndTime(currentShop.workEndTime || '')
      setNominationFeeFree(currentShop.nominationFeeFree || '')
      setNominationFeePanel(currentShop.nominationFeePanel || '')
      setNominationFeeNet(currentShop.nominationFeeNet || '')
      setNominationFeeDirect(currentShop.nominationFeeDirect || '')
      setBacks(currentShop.backs || [])
      setMiscFeePercent(currentShop.miscFeePercent || '')
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
    } catch (err: any) {
      // オフライン時はエラーを無視（キャッシュから読み込めなかった場合）
      if (err.code !== 'unavailable' && !err.message?.includes('offline')) {
        console.error('設定の読み込みエラー:', err)
      }
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
        hobby,
        specialty,
        recentHobby,
        preferredGift,
        workStartTime: workStartTime || undefined,
        workEndTime: workEndTime || undefined,
        nominationFeeFree: nominationFeeFree || undefined,
        nominationFeePanel: nominationFeePanel || undefined,
        nominationFeeNet: nominationFeeNet || undefined,
        nominationFeeDirect: nominationFeeDirect || undefined,
        backs,
        miscFeePercent: miscFeePercent || undefined,
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

      // オフライン時でも保存成功メッセージを表示
      if (!navigator.onLine) {
        setSuccess('オフラインです。設定は保存され、オンライン時に自動的に同期されます。')
      } else {
        setSuccess('設定を保存しました')
      }
    } catch (err: any) {
      // オフライン時のエラーは特別なメッセージを表示
      if (err.code === 'unavailable' || !navigator.onLine) {
        setError('オフラインです。設定は保存され、オンライン時に自動的に同期されます。')
      } else {
        setError(err.message || '設定の保存に失敗しました')
      }
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
      hobby,
      specialty,
      recentHobby,
      preferredGift,
      workStartTime: workStartTime || undefined,
      workEndTime: workEndTime || undefined,
      nominationFeeFree: nominationFeeFree || undefined,
      nominationFeePanel: nominationFeePanel || undefined,
      nominationFeeNet: nominationFeeNet || undefined,
      nominationFeeDirect: nominationFeeDirect || undefined,
      backs,
      miscFeePercent: miscFeePercent || undefined,
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

  const addHobby = () => {
    if (hobbyInput.trim() && !hobby.includes(hobbyInput.trim())) {
      setHobby([...hobby, hobbyInput.trim()])
      setHobbyInput('')
    }
  }

  const removeHobby = (item: string) => {
    setHobby(hobby.filter(h => h !== item))
  }

  const addSpecialty = () => {
    if (specialtyInput.trim() && !specialty.includes(specialtyInput.trim())) {
      setSpecialty([...specialty, specialtyInput.trim()])
      setSpecialtyInput('')
    }
  }

  const removeSpecialty = (item: string) => {
    setSpecialty(specialty.filter(s => s !== item))
  }

  const addRecentHobby = () => {
    if (recentHobbyInput.trim() && !recentHobby.includes(recentHobbyInput.trim())) {
      setRecentHobby([...recentHobby, recentHobbyInput.trim()])
      setRecentHobbyInput('')
    }
  }

  const removeRecentHobby = (item: string) => {
    setRecentHobby(recentHobby.filter(r => r !== item))
  }

  const addPreferredGift = () => {
    if (preferredGiftInput.trim() && !preferredGift.includes(preferredGiftInput.trim())) {
      setPreferredGift([...preferredGift, preferredGiftInput.trim()])
      setPreferredGiftInput('')
    }
  }

  const removePreferredGift = (item: string) => {
    setPreferredGift(preferredGift.filter(p => p !== item))
  }

  const addBack = () => {
    const time = backTimeInput.trim()
    const price = backPriceInput.trim()
    if (time && price) {
      const backEntry = `${time} | ${price}`
      if (!backs.includes(backEntry)) {
        setBacks([...backs, backEntry])
        setBackTimeInput('')
        setBackPriceInput('')
      }
    }
  }

  const removeBack = (item: string) => {
    setBacks(backs.filter(b => b !== item))
  }

  if (!currentUser) {
    return null
  }

  return (
    <main>
      <Header showBackButton={true} showPostsButton={true} showCalendarButton={true} />

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
                    <label className="settings-label" htmlFor="workStartTime">出勤開始時間</label>
                    <input
                      id="workStartTime"
                      type="time"
                      value={workStartTime}
                      onChange={(e) => setWorkStartTime(e.target.value)}
                      className="settings-input"
                    />
                  </div>

                  <div className="settings-item">
                    <label className="settings-label" htmlFor="workEndTime">出勤終了時間</label>
                    <input
                      id="workEndTime"
                      type="time"
                      value={workEndTime}
                      onChange={(e) => setWorkEndTime(e.target.value)}
                      className="settings-input"
                    />
                  </div>

                  <div className="settings-item">
                    <label className="settings-label">指名料</label>
                    <div className="settings-form-group" style={{ marginBottom: '12px' }}>
                      <label htmlFor="nominationFeeFree" style={{ fontSize: '14px', marginBottom: '4px', display: 'block' }}>フリー</label>
                      <input
                        id="nominationFeeFree"
                        type="text"
                        value={nominationFeeFree}
                        onChange={(e) => setNominationFeeFree(e.target.value)}
                        className="settings-input"
                        placeholder="フリー指名料を入力"
                      />
                    </div>
                    <div className="settings-form-group" style={{ marginBottom: '12px' }}>
                      <label htmlFor="nominationFeePanel" style={{ fontSize: '14px', marginBottom: '4px', display: 'block' }}>パネル</label>
                      <input
                        id="nominationFeePanel"
                        type="text"
                        value={nominationFeePanel}
                        onChange={(e) => setNominationFeePanel(e.target.value)}
                        className="settings-input"
                        placeholder="パネル指名料を入力"
                      />
                    </div>
                    <div className="settings-form-group" style={{ marginBottom: '12px' }}>
                      <label htmlFor="nominationFeeNet" style={{ fontSize: '14px', marginBottom: '4px', display: 'block' }}>ネット</label>
                      <input
                        id="nominationFeeNet"
                        type="text"
                        value={nominationFeeNet}
                        onChange={(e) => setNominationFeeNet(e.target.value)}
                        className="settings-input"
                        placeholder="ネット指名料を入力"
                      />
                    </div>
                    <div className="settings-form-group">
                      <label htmlFor="nominationFeeDirect" style={{ fontSize: '14px', marginBottom: '4px', display: 'block' }}>本指名</label>
                      <input
                        id="nominationFeeDirect"
                        type="text"
                        value={nominationFeeDirect}
                        onChange={(e) => setNominationFeeDirect(e.target.value)}
                        className="settings-input"
                        placeholder="本指名料を入力"
                      />
                    </div>
                  </div>

                  <div className="settings-item">
                    <label className="settings-label">バック（追加可能）</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label htmlFor="backTimeInput" style={{ fontSize: '14px', marginBottom: '4px', display: 'block' }}>コース時間</label>
                        <input
                          id="backTimeInput"
                          type="text"
                          value={backTimeInput}
                          onChange={(e) => setBackTimeInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addBack()
                            }
                          }}
                          className="settings-input"
                          placeholder="例: 60分"
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label htmlFor="backPriceInput" style={{ fontSize: '14px', marginBottom: '4px', display: 'block' }}>料金</label>
                        <input
                          id="backPriceInput"
                          type="text"
                          value={backPriceInput}
                          onChange={(e) => setBackPriceInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addBack()
                            }
                          }}
                          className="settings-input"
                          placeholder="例: 10,000円"
                        />
                      </div>
                      <button type="button" onClick={addBack} className="settings-add-button">
                        追加
                      </button>
                    </div>
                    <div className="settings-tags">
                      {backs.map((back) => (
                        <span key={back} className="settings-tag">
                          {back}
                          <button type="button" onClick={() => removeBack(back)} className="settings-tag-remove">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="settings-item">
                    <label className="settings-label">雑費</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        id="miscFeePercent"
                        type="text"
                        value={miscFeePercent}
                        onChange={(e) => setMiscFeePercent(e.target.value)}
                        className="settings-input"
                        placeholder="例: 10"
                        style={{ flex: '0 0 auto', width: '120px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#374151' }}>％</span>
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

                  <div className="settings-item">
                    <label className="settings-label">趣味（追加可能）</label>
                    <div className="settings-tag-input">
                      <input
                        type="text"
                        value={hobbyInput}
                        onChange={(e) => setHobbyInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addHobby()
                          }
                        }}
                        className="settings-input"
                        placeholder="趣味を入力してEnter"
                      />
                      <button type="button" onClick={addHobby} className="settings-add-button">
                        追加
                      </button>
                    </div>
                    <div className="settings-tags">
                      {hobby.map((h) => (
                        <span key={h} className="settings-tag">
                          {h}
                          <button type="button" onClick={() => removeHobby(h)} className="settings-tag-remove">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="settings-item">
                    <label className="settings-label">特技（追加可能）</label>
                    <div className="settings-tag-input">
                      <input
                        type="text"
                        value={specialtyInput}
                        onChange={(e) => setSpecialtyInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addSpecialty()
                          }
                        }}
                        className="settings-input"
                        placeholder="特技を入力してEnter"
                      />
                      <button type="button" onClick={addSpecialty} className="settings-add-button">
                        追加
                      </button>
                    </div>
                    <div className="settings-tags">
                      {specialty.map((s) => (
                        <span key={s} className="settings-tag">
                          {s}
                          <button type="button" onClick={() => removeSpecialty(s)} className="settings-tag-remove">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="settings-item">
                    <label className="settings-label">最近ハマってるもの（追加可能）</label>
                    <div className="settings-tag-input">
                      <input
                        type="text"
                        value={recentHobbyInput}
                        onChange={(e) => setRecentHobbyInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addRecentHobby()
                          }
                        }}
                        className="settings-input"
                        placeholder="最近ハマってるものを入力してEnter"
                      />
                      <button type="button" onClick={addRecentHobby} className="settings-add-button">
                        追加
                      </button>
                    </div>
                    <div className="settings-tags">
                      {recentHobby.map((r) => (
                        <span key={r} className="settings-tag">
                          {r}
                          <button type="button" onClick={() => removeRecentHobby(r)} className="settings-tag-remove">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="settings-item">
                    <label className="settings-label">貰いたい差し入れ（追加可能）</label>
                    <div className="settings-tag-input">
                      <input
                        type="text"
                        value={preferredGiftInput}
                        onChange={(e) => setPreferredGiftInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addPreferredGift()
                          }
                        }}
                        className="settings-input"
                        placeholder="貰いたい差し入れを入力してEnter"
                      />
                      <button type="button" onClick={addPreferredGift} className="settings-add-button">
                        追加
                      </button>
                    </div>
                    <div className="settings-tags">
                      {preferredGift.map((p) => (
                        <span key={p} className="settings-tag">
                          {p}
                          <button type="button" onClick={() => removePreferredGift(p)} className="settings-tag-remove">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
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
