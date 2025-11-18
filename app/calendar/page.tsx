'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/Header'
import { getDocument, getDocumentsByUserId, createDocument, updateDocument, deleteDocument, UserSettings, SalesEntry, ShopSetting, AttendanceEntry } from '@/lib/firestore'

export default function CalendarPage() {
  const { currentUser } = useAuth()
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [salesEntries, setSalesEntries] = useState<SalesEntry[]>([])
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedShopIndex, setSelectedShopIndex] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isWorkDay, setIsWorkDay] = useState(false)
  const [attendanceId, setAttendanceId] = useState<string | null>(null)
  
  // 売上入力フォームのstate（複数エントリー対応）
  interface SalesEntryItem {
    id?: string // 既存エントリーのID（編集時のみ）
    courseMinutes: string
    nominationType: 'free' | 'panel' | 'net' | 'direct' | ''
    count: number
    calculatedAmount: number
  }
  const [salesEntriesForDate, setSalesEntriesForDate] = useState<SalesEntryItem[]>([])

  useEffect(() => {
    if (!currentUser) {
      router.push('/login')
      return
    }
    loadData()
  }, [currentUser, router])

  const loadData = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const [loadedSettings, loadedSales, loadedAttendance] = await Promise.all([
        getDocument<UserSettings>('userSettings', currentUser.uid),
        getDocumentsByUserId<SalesEntry>('sales', currentUser.uid),
        getDocumentsByUserId<AttendanceEntry>('attendance', currentUser.uid)
      ])
      setSettings(loadedSettings)
      setSalesEntries(loadedSales || [])
      setAttendanceEntries(loadedAttendance || [])
      if (loadedSettings?.currentShopIndex !== undefined) {
        setSelectedShopIndex(loadedSettings.currentShopIndex)
      }
    } catch (error: any) {
      console.error('データの読み込みエラー:', error)
      console.error('エラー詳細:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      })
      // オフライン時はエラーを無視（キャッシュから読み込めなかった場合）
      if (error.code !== 'unavailable' && !error.message?.includes('offline')) {
        // 権限エラーの場合はより詳しいメッセージを表示
        if (error.code === 'permission-denied') {
          alert('データの読み込み権限がありません。Firestoreのセキュリティルールを確認してください。')
        } else {
          alert(`データの読み込みに失敗しました: ${error.message || error.code || '不明なエラー'}`)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // 売上を計算
  const calculateSales = (
    courseMinutes: string,
    nominationType: 'free' | 'panel' | 'net' | 'direct' | '',
    count: number,
    shop: ShopSetting | undefined
  ): number => {
    if (!shop || !courseMinutes || !nominationType) return 0

    // バック料金を取得（コース時間に一致するものを探す）
    let backPrice = 0
    if (shop.backs && shop.backs.length > 0) {
      const matchingBack = shop.backs.find(back => {
        // "60分 | 10,000円" のような形式から時間を抽出
        const match = back.match(/(\d+)\s*分/)
        if (match) {
          const backMinutes = parseInt(match[1])
          return backMinutes.toString() === courseMinutes
        }
        return false
      })
      
      if (matchingBack) {
        // 価格を抽出（数字とカンマを抽出して数値に変換）
        const priceMatch = matchingBack.match(/[|｜]\s*([\d,]+)/)
        if (priceMatch) {
          backPrice = parseInt(priceMatch[1].replace(/,/g, ''))
        }
      }
    }

    // 指名料を取得
    let nominationFee = 0
    switch (nominationType) {
      case 'free':
        nominationFee = parseInt(shop.nominationFeeFree?.replace(/,/g, '') || '0')
        break
      case 'panel':
        nominationFee = parseInt(shop.nominationFeePanel?.replace(/,/g, '') || '0')
        break
      case 'net':
        nominationFee = parseInt(shop.nominationFeeNet?.replace(/,/g, '') || '0')
        break
      case 'direct':
        nominationFee = parseInt(shop.nominationFeeDirect?.replace(/,/g, '') || '0')
        break
    }

    // 本数 × (バック料金 + 指名料)
    const totalAmount = count * (backPrice + nominationFee)

    // 雑費％を引く
    const miscFeePercent = parseFloat(shop.miscFeePercent || '0')
    const finalAmount = totalAmount * (1 - miscFeePercent / 100)

    return Math.round(finalAmount)
  }

  // 売上エントリーを追加
  const addSalesEntry = () => {
    setSalesEntriesForDate([...salesEntriesForDate, {
      courseMinutes: '',
      nominationType: '',
      count: 1,
      calculatedAmount: 0
    }])
  }

  // 売上エントリーを更新
  const updateSalesEntry = (index: number, updates: Partial<SalesEntryItem>) => {
    const currentShop = settings?.shops?.[selectedShopIndex]
    const entry = { ...salesEntriesForDate[index], ...updates }
    
    // 金額を再計算
    if (entry.courseMinutes && entry.nominationType) {
      entry.calculatedAmount = calculateSales(
        entry.courseMinutes,
        entry.nominationType as 'free' | 'panel' | 'net' | 'direct',
        entry.count,
        currentShop
      )
    } else {
      entry.calculatedAmount = 0
    }
    
    const updated = [...salesEntriesForDate]
    updated[index] = entry
    setSalesEntriesForDate(updated)
  }

  // 売上エントリーを削除
  const removeSalesEntry = (index: number) => {
    const updated = salesEntriesForDate.filter((_, i) => i !== index)
    setSalesEntriesForDate(updated)
  }

  // 合計金額を計算
  const getTotalAmount = (): number => {
    return salesEntriesForDate.reduce((sum, entry) => sum + entry.calculatedAmount, 0)
  }

  // 日付をクリック
  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(dateStr)
    
    // 既存の売上を全て取得
    const existingSalesForDate = salesEntries.filter(
      sale => sale.date === dateStr && sale.shopIndex === selectedShopIndex
    )
    
    if (existingSalesForDate.length > 0) {
      // 既存の売上を配列に変換
      const entries: SalesEntryItem[] = existingSalesForDate.map(sale => ({
        id: sale.id,
        courseMinutes: sale.courseMinutes,
        nominationType: sale.nominationType,
        count: sale.count,
        calculatedAmount: sale.calculatedAmount
      }))
      setSalesEntriesForDate(entries)
    } else {
      // 新しいエントリーを1つ追加
      setSalesEntriesForDate([{
        courseMinutes: '',
        nominationType: '',
        count: 1,
        calculatedAmount: 0
      }])
    }
    
    // 既存の出勤日を取得
    const existingAttendance = attendanceEntries.find(
      att => att.date === dateStr && att.shopIndex === selectedShopIndex
    )
    setIsWorkDay(existingAttendance?.isWorkDay || false)
    setAttendanceId(existingAttendance?.id || null)
    
    setIsModalOpen(true)
  }

  // 売上を保存
  const handleSaveSales = async () => {
    if (!currentUser || !selectedDate) {
      alert('日付が選択されていません')
      return
    }

    // 入力済みのエントリーをフィルタ
    const validEntries = salesEntriesForDate.filter(
      entry => entry.courseMinutes && entry.nominationType
    )

    // 出勤日がチェックされていない場合、売上エントリーが必要
    if (!isWorkDay && validEntries.length === 0) {
      alert('少なくとも1つの売上エントリーを入力するか、出勤日をチェックしてください')
      return
    }

    const currentShop = settings?.shops?.[selectedShopIndex]
    if (!currentShop) {
      alert('店舗設定が見つかりません')
      return
    }

    try {
      // 売上エントリーを保存（入力がある場合のみ）
      if (validEntries.length > 0) {
        // 既存のエントリーIDを取得
        const existingIds = salesEntries
          .filter(sale => sale.date === selectedDate && sale.shopIndex === selectedShopIndex)
          .map(sale => sale.id)
          .filter((id): id is string => !!id)

        // 既存のエントリーを全て削除
        for (const id of existingIds) {
          await deleteDocument('sales', id)
        }

        // 新しいエントリーを全て作成
        for (const entry of validEntries) {
          await createDocument<SalesEntry>('sales', {
            userId: currentUser.uid,
            shopIndex: selectedShopIndex,
            date: selectedDate,
            courseMinutes: entry.courseMinutes,
            nominationType: entry.nominationType as 'free' | 'panel' | 'net' | 'direct',
            count: entry.count,
            calculatedAmount: entry.calculatedAmount,
          })
        }
      } else {
        // 売上エントリーがない場合は既存のエントリーを削除
        const existingIds = salesEntries
          .filter(sale => sale.date === selectedDate && sale.shopIndex === selectedShopIndex)
          .map(sale => sale.id)
          .filter((id): id is string => !!id)

        for (const id of existingIds) {
          await deleteDocument('sales', id)
        }
      }

      // 出勤日を保存
      if (attendanceId) {
        // 既存の出勤日を更新
        if (isWorkDay) {
          await updateDocument('attendance', attendanceId, {
            isWorkDay: isWorkDay,
          })
        } else {
          // チェックが外された場合は削除
          await deleteDocument('attendance', attendanceId)
        }
      } else if (isWorkDay) {
        // 新しい出勤日を作成
        await createDocument<AttendanceEntry>('attendance', {
          userId: currentUser.uid,
          shopIndex: selectedShopIndex,
          date: selectedDate,
          isWorkDay: true,
        })
      }

      await loadData()
      setIsModalOpen(false)
      if (validEntries.length > 0 && isWorkDay) {
        alert('売上と出勤日を保存しました')
      } else if (validEntries.length > 0) {
        alert('売上を保存しました')
      } else if (isWorkDay) {
        alert('出勤日を保存しました')
      }
    } catch (error: any) {
      console.error('売上の保存エラー:', error)
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        alert('オフラインのため保存できませんでした。オンラインになったら再度お試しください。')
      } else {
        alert('売上の保存に失敗しました')
      }
    }
  }

  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdays[date.getDay()]
    return `${year}年${month}月${day}日(${weekday})`
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month, 1).getDay()
  }

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  const today = new Date()

  // カレンダーの日付配列を生成
  const calendarDays: (number | null)[] = []
  // 前月の日付を埋める
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null)
  }
  // 今月の日付
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  // 特定の日付の売上を取得（合計金額を返す）
  const getSalesForDate = (day: number | null): number => {
    if (day === null) return 0
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const salesForDate = salesEntries.filter(
      sale => sale.date === dateStr && sale.shopIndex === selectedShopIndex
    )
    return salesForDate.reduce((sum, sale) => sum + sale.calculatedAmount, 0)
  }

  // 特定の日付が出勤日かどうかを取得
  const isWorkDayForDate = (day: number | null): boolean => {
    if (day === null) return false
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const attendance = attendanceEntries.find(
      att => att.date === dateStr && att.shopIndex === selectedShopIndex
    )
    return attendance?.isWorkDay || false
  }

  // 今月の売上合計を計算
  const getMonthlyTotal = (): number => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const monthlySales = salesEntries.filter(
      sale => {
        const saleMonth = sale.date?.substring(0, 7) // "YYYY-MM"形式
        return saleMonth === monthStr && sale.shopIndex === selectedShopIndex
      }
    )
    return monthlySales.reduce((sum, sale) => sum + sale.calculatedAmount, 0)
  }

  // 店舗選択用のバックリストを取得
  const getAvailableBacks = (): string[] => {
    if (!settings || !settings.shops || settings.shops.length === 0) {
      return []
    }
    const currentShop = settings.shops[selectedShopIndex]
    if (!currentShop || !currentShop.backs) {
      return []
    }
    return currentShop.backs
  }

  if (!currentUser) {
    return null
  }

  return (
    <main>
      <Header 
        showBackButton={true} 
        showSettingsButton={true} 
        showPostsButton={true}
        showLogoutButton={true}
      />
      
      <div className="calendar-container">
        <div className="calendar-card">
          <h2 className="calendar-title">カレンダー</h2>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>読み込み中...</div>
          ) : (
            <>
              {/* 店舗選択 */}
              {settings && settings.shops && settings.shops.length > 0 && (
                <div className="calendar-shop-selector">
                  <label>店舗選択: </label>
                  {settings.shops.length === 1 ? (
                    <span>{settings.shops[0].stageName || '未設定'} - {settings.shops[0].shopName || '未設定'}</span>
                  ) : (
                    <select
                      value={selectedShopIndex}
                      onChange={(e) => setSelectedShopIndex(parseInt(e.target.value))}
                      className="calendar-shop-select"
                    >
                      {settings.shops.map((shop, index) => (
                        <option key={index} value={index}>
                          {shop.stageName || '未設定'} - {shop.shopName || '未設定'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* 今月の売上合計 */}
              <div className="calendar-monthly-total">
                <div className="calendar-monthly-total-label">{year}年{month}月の売上合計</div>
                <div className="calendar-monthly-total-amount">¥{getMonthlyTotal().toLocaleString()}</div>
              </div>

              {/* カレンダーコントロール */}
              <div className="calendar-controls">
                <button onClick={goToPreviousMonth} className="calendar-nav-button">
                  ←
                </button>
                <h3 className="calendar-month-title">
                  {year}年{month}月
                </h3>
                <button onClick={goToNextMonth} className="calendar-nav-button">
                  →
                </button>
              </div>
             

              {/* カレンダーグリッド */}
              <div className="calendar-grid">
                {/* 曜日ヘッダー */}
                {weekdays.map((day) => (
                  <div key={day} className="calendar-weekday-header">
                    {day}
                  </div>
                ))}
                
                {/* 日付セル */}
                {calendarDays.map((day, index) => {
                  const isToday = day !== null && 
                    year === today.getFullYear() && 
                    month === today.getMonth() + 1 && 
                    day === today.getDate()
                  
                  const totalSales = getSalesForDate(day)
                  const hasSales = totalSales > 0
                  const isWorkDay = isWorkDayForDate(day)
                  
                  return (
                    <div
                      key={index}
                      className={`calendar-day ${day === null ? 'calendar-day-empty' : ''} ${isToday ? 'calendar-day-today' : ''} ${hasSales ? 'calendar-day-has-sales' : ''}`}
                      onClick={() => day !== null && handleDayClick(day)}
                    >
                      {day !== null && (
                        <>
                          <div className="calendar-day-header">
                            <div className="calendar-day-number">{day}</div>
                            {isWorkDay && (
                              <span className="calendar-day-work-star">⭐</span>
                            )}
                          </div>
                          {hasSales && (
                            <div className="calendar-day-sales">
                              ¥{totalSales.toLocaleString()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 売上入力モーダル */}
      {isModalOpen && (
        <div className="sales-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="sales-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="sales-modal-title">
              {selectedDate && formatDate(new Date(selectedDate))} の売上
            </h3>
            
            <div className="sales-form">
              {/* 出勤日チェックボックス */}
              <div className="sales-form-group">
                <label className="sales-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isWorkDay}
                    onChange={(e) => setIsWorkDay(e.target.checked)}
                    className="sales-checkbox"
                  />
                  <span>出勤日</span>
                </label>
              </div>

              {salesEntriesForDate.map((entry, index) => (
                <div key={index} className="sales-entry-item">
                  <div className="sales-entry-header">
                    <h4>売上 {index + 1}</h4>
                    {salesEntriesForDate.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSalesEntry(index)}
                        className="sales-entry-delete-button"
                      >
                        削除
                      </button>
                    )}
                  </div>

                  <div className="sales-form-group">
                    <label>コース時間（分）</label>
                    <select
                      value={entry.courseMinutes}
                      onChange={(e) => updateSalesEntry(index, { courseMinutes: e.target.value })}
                      className="sales-input"
                    >
                      <option value="">選択してください</option>
                      {getAvailableBacks().length > 0 ? (
                        getAvailableBacks().map((back, backIndex) => {
                          const match = back.match(/(\d+)\s*分/)
                          const minutes = match ? match[1] : ''
                          return (
                            <option key={backIndex} value={minutes}>
                              {back}
                            </option>
                          )
                        })
                      ) : (
                        <option value="" disabled>設定ページでバックを設定してください</option>
                      )}
                    </select>
                  </div>

                  <div className="sales-form-group">
                    <label>指名</label>
                    <div className="sales-radio-group">
                      <label className="sales-radio">
                        <input
                          type="radio"
                          value="free"
                          checked={entry.nominationType === 'free'}
                          onChange={(e) => updateSalesEntry(index, { nominationType: e.target.value as 'free' })}
                        />
                        <span>フリー</span>
                      </label>
                      <label className="sales-radio">
                        <input
                          type="radio"
                          value="panel"
                          checked={entry.nominationType === 'panel'}
                          onChange={(e) => updateSalesEntry(index, { nominationType: e.target.value as 'panel' })}
                        />
                        <span>パネル</span>
                      </label>
                      <label className="sales-radio">
                        <input
                          type="radio"
                          value="net"
                          checked={entry.nominationType === 'net'}
                          onChange={(e) => updateSalesEntry(index, { nominationType: e.target.value as 'net' })}
                        />
                        <span>ネット</span>
                      </label>
                      <label className="sales-radio">
                        <input
                          type="radio"
                          value="direct"
                          checked={entry.nominationType === 'direct'}
                          onChange={(e) => updateSalesEntry(index, { nominationType: e.target.value as 'direct' })}
                        />
                        <span>本指名</span>
                      </label>
                    </div>
                  </div>

                  <div className="sales-form-group">
                    <label>本数</label>
                    <select
                      value={entry.count}
                      onChange={(e) => updateSalesEntry(index, { count: parseInt(e.target.value) })}
                      className="sales-input"
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>
                          {num}本
                        </option>
                      ))}
                    </select>
                  </div>

                  {entry.calculatedAmount > 0 && (
                    <div className="sales-form-group">
                      <label>計算された売上（雑費引いた後）</label>
                      <div className="sales-calculated-amount-small">
                        ¥{entry.calculatedAmount.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="sales-add-entry-button-wrapper">
                <button
                  type="button"
                  onClick={addSalesEntry}
                  className="sales-add-entry-button"
                >
                  + 売上を追加
                </button>
              </div>

              {getTotalAmount() > 0 && (
                <div className="sales-form-group">
                  <label>合計売上（雑費引いた後）</label>
                  <div className="sales-calculated-amount">
                    ¥{getTotalAmount().toLocaleString()}
                  </div>
                </div>
              )}

              <div className="sales-modal-buttons">
                <button
                  onClick={handleSaveSales}
                  className="sales-save-button"
                  disabled={salesEntriesForDate.every(entry => !entry.courseMinutes || !entry.nominationType)}
                >
                  保存
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="sales-cancel-button"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

