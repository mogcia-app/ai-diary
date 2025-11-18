import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import { UserSettings, ShopSetting } from '@/lib/firestore'

// サーバーサイド用のFirebase初期化
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app
if (!getApps().length) {
  app = initializeApp(firebaseConfig)
} else {
  app = getApps()[0]
}

const db = getFirestore(app)

export async function POST(request: NextRequest) {
  try {
    const { theme, autoTheme, category, tone, courseMinutes, customerType, otherInfo, userId, shopIndex } = await request.json()

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    // プロンプトを生成
    let selectedTheme = ''
    if (autoTheme) {
      // 自動テーマ選択の場合
      const themes = [
        '今日の1日',
        '出勤しました',
        '今日の出来事',
        '日記',
        '今日の気持ち',
        '今日の学び',
        '今日の食事',
        '今日の運動',
      ]
      selectedTheme = themes[Math.floor(Math.random() * themes.length)]
    } else {
      selectedTheme = theme
    }

    // カテゴリに応じたプロンプトを生成
    let categoryContext = ''
    if (category) {
      const categoryMap: Record<string, string> = {
        '出勤前': '出勤前の準備や気持ち、今日への期待などを表現してください。',
        '出勤中': '出勤中の業務や接客、お客様とのやり取り、現場での体験を表現してください。',
        'お礼': 'お客様への感謝の気持ちや、お礼のメッセージを表現してください。',
        '退勤後': '退勤後の振り返りや、今日の感想、明日への思いなどを表現してください。',
        'キャラ付け': '自分のキャラクター設定や、演じるキャラについての内容を表現してください。',
        'その他': 'その他の内容を自由に表現してください。',
      }
      categoryContext = categoryMap[category] || ''
      
      // カテゴリ詳細情報を追加
      const detailParts: string[] = []
      if (courseMinutes) {
        detailParts.push(`コース時間: ${courseMinutes}分`)
      }
      if (customerType) {
        detailParts.push(`お客様タイプ: ${customerType}`)
      }
      if (otherInfo) {
        detailParts.push(`その他: ${otherInfo}`)
      }
      if (detailParts.length > 0) {
        categoryContext += `\n\n【詳細情報】\n${detailParts.join('\n')}\n\n上記の詳細情報を自然に投稿文に反映してください。`
      }
    }

    // トーンに応じたプロンプトを生成
    let toneContext = ''
    if (tone) {
      const toneMap: Record<string, string> = {
        '過激': '過激で刺激的な表現を使い、大胆で情熱的なトーンで書いてください。',
        '素人': '素人らしい自然な表現を使い、恥ずかしがり屋で夜のお仕事に慣れていないトーンで書いてください。',
        '清楚': '清楚で上品な表現を使い、優しく控えめなトーンで書いてください。',
        'フレンドリー': 'フレンドリーで親しみやすい表現を使い、明るく気軽なトーンで書いてください。',
        '真面目': '真面目で誠実な表現を使い、真摯で落ち着いたトーンで書いてください。',
      }
      toneContext = toneMap[tone] || ''
    }

    // ユーザー設定を取得
    let settingsContext = ''
    let industryContext = ''
    let industry = ''
    
    if (userId) {
      try {
        const docRef = doc(db, 'userSettings', userId)
        const docSnap = await getDoc(docRef)
        const settings = docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as UserSettings : null
        
        if (settings && settings.shops && settings.shops.length > 0) {
          // リクエストで指定された店舗インデックスを使用（デフォルトは最初の店舗）
          const currentShopIndex = shopIndex !== undefined ? shopIndex : (settings.currentShopIndex ?? 0)
          const currentShop = settings.shops[currentShopIndex] || settings.shops[0]
          
          // 業種を店舗設定から取得
          industry = currentShop.shopIndustry || ''
          
          // 業種に応じたプロンプトを生成
          if (industry === 'delivery') {
            industryContext = '【デリヘル業界について】\nデリヘルは出張型の風俗サービスで挿入サービスはあるません。以下の特徴を理解して内容を生成してください：\n- お客様の指定場所（ホテルや自宅など）に出張する\n- 時間制のサービスが基本\n- お客様との事前のやり取り（電話やメッセージ）が重要\n- 移動時間や待機時間がある\n- 出張先での接客が中心\n- デリヘル特有の業務フローや体験を反映してください。'
          } else if (industry === 'soap') {
            industryContext = '【ソープランド業界について】\nソープランドは店舗型で避妊器具を着用し挿入するサービスです。以下の特徴を理解して内容を生成してください：\n- お店に常駐して接客する\n- お店の設備（個室、お風呂など）を使用する\n- 店内での接客が中心\n- お店の雰囲気や環境が重要\n- 他のスタッフとの交流がある\n- ソープランド特有の業務フローや体験を反映してください。'
          } else if (industry === 'ns-soap') {
            industryContext = '【NSソープ業界について】\nNSソープ（ノンソープ）はソープランドの一種で、避妊器具を使わず挿入するスタイルの店舗型サービスです。以下の特徴を理解して内容を生成してください：\n- お店に常駐して接客する\n- お風呂を使わない（個室のみ）\n- 店内での接客が中心\n- ソープランドよりシンプルな設備\n- 他のスタッフとの交流がある\n- NSソープ特有の業務フローや体験を反映してください。'
          }
          
          const settingsParts: string[] = []
          
          if (currentShop.stageName) {
            settingsParts.push(`源氏名: ${currentShop.stageName}`)
          }
          if (currentShop.catchphrase) {
            settingsParts.push(`キャッチコピー: ${currentShop.catchphrase}`)
          }
          if (currentShop.shopIndustry) {
            const industryLabels = { delivery: 'デリヘル', soap: 'ソープ', 'ns-soap': 'NSソープ' }
            settingsParts.push(`お店の業種: ${industryLabels[currentShop.shopIndustry] || currentShop.shopIndustry}`)
          }
          if (currentShop.shopName) {
            settingsParts.push(`お店の名前: ${currentShop.shopName}`)
          }
          if (currentShop.shopCourses && currentShop.shopCourses.length > 0) {
            settingsParts.push(`お店のコース: ${currentShop.shopCourses.join('、')}`)
          }
          if (currentShop.priceRange) {
            const priceLabels = { low: '低', medium: '中', high: '高' }
            settingsParts.push(`価格帯: ${priceLabels[currentShop.priceRange]}`)
          }
          if (currentShop.shopConcept) {
            settingsParts.push(`お店のコンセプト: ${currentShop.shopConcept}`)
          }
          if (currentShop.shopPersonalities && currentShop.shopPersonalities.length > 0) {
            settingsParts.push(`設定された性格: ${currentShop.shopPersonalities.join('、')}`)
          }
          if (currentShop.shopTraits && currentShop.shopTraits.length > 0) {
            settingsParts.push(`設定された個性: ${currentShop.shopTraits.join('、')}`)
          }
          if (currentShop.serviceStyle) {
            settingsParts.push(`接客スタイル: ${currentShop.serviceStyle}`)
          }
          if (currentShop.targetCustomers) {
            settingsParts.push(`希望するお客様: ${currentShop.targetCustomers}`)
          }
          if (currentShop.ngWords && currentShop.ngWords.length > 0) {
            settingsParts.push(`NGワード（使用禁止）: ${currentShop.ngWords.join('、')}`)
          }

          if (settingsParts.length > 0) {
            settingsContext = `\n\n【重要：ユーザー設定情報 - 必ず参照してください】\n${settingsParts.join('\n')}\n\n★ 上記の設定情報を必ず反映してください。特に以下の点に注意してください：
- 源氏名やキャッチコピーに沿ったキャラクター設定で書く
- 設定された性格や個性を必ず反映する
- 接客スタイルに沿った内容にする
- お店のコンセプトや価格帯を意識する
- NGワードは絶対に使用しないでください（使用した場合、生成をやり直してください）`
          }
        }
      } catch (err) {
        console.error('設定の取得エラー:', err)
      }
    }

    const prompt = `${selectedTheme}について、日記のタイトルと投稿文を生成してください。
${industryContext ? industryContext + '\n' : ''}${categoryContext ? `カテゴリ: ${category}\n${categoryContext}\n` : ''}${toneContext ? `【トーン指定】\n${toneContext}\n` : ''}${settingsContext}

以下のJSON形式で返してください：
{
  "title": "タイトル（20文字以内）",
  "content": "投稿文（200文字程度、自然で読みやすく、感情が伝わる内容）"
}`

    // OpenAI APIを呼び出し
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: industry === 'delivery' 
              ? 'あなたはデリヘル業界で働く人の日記を書くのが得意なアシスタントです。デリヘルは出張型の風俗サービスで、お客様の指定場所に出張して接客する業務です。移動時間、待機時間、出張先での接客など、デリヘル特有の業務フローを理解した上で、自然で読みやすく、感情が伝わる日記形式の文章を生成してください。必ずJSON形式で返してください。'
              : industry === 'soap'
              ? 'あなたはソープランド業界で働く人の日記を書くのが得意なアシスタントです。ソープランドは店舗型の風俗サービスで、お店に常駐して接客する業務です。店内の設備（個室、お風呂など）を使用し、お店の雰囲気や環境の中で接客する、ソープランド特有の業務フローを理解した上で、自然で読みやすく、感情が伝わる日記形式の文章を生成してください。必ずJSON形式で返してください。'
              : industry === 'ns-soap'
              ? 'あなたはNSソープ業界で働く人の日記を書くのが得意なアシスタントです。NSソープ（ノンソープ）はソープランドの一種で、お風呂を使わないスタイルの店舗型サービスです。お店に常駐して接客しますが、お風呂を使わず個室のみで接客する、NSソープ特有の業務フローを理解した上で、自然で読みやすく、感情が伝わる日記形式の文章を生成してください。必ずJSON形式で返してください。'
              : 'あなたは日記を書くのが得意なアシスタントです。自然で読みやすく、感情が伝わる日記形式の文章を生成してください。必ずJSON形式で返してください。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'AI生成に失敗しました')
    }

    const data = await response.json()
    const generatedText = data.choices[0]?.message?.content || ''
    
    // JSONをパース
    let parsedData
    try {
      parsedData = JSON.parse(generatedText)
    } catch (e) {
      // JSON形式でない場合、テキストから抽出を試みる
      const titleMatch = generatedText.match(/"title":\s*"([^"]+)"/)
      const contentMatch = generatedText.match(/"content":\s*"([^"]+)"/)
      parsedData = {
        title: titleMatch ? titleMatch[1] : selectedTheme,
        content: contentMatch ? contentMatch[1] : generatedText,
      }
    }

    return NextResponse.json({
      title: parsedData.title || selectedTheme,
      content: parsedData.content || generatedText,
      theme: selectedTheme,
    })
  } catch (error: any) {
    console.error('AI生成エラー:', error)
    return NextResponse.json(
      { error: error.message || 'AI生成に失敗しました' },
      { status: 500 }
    )
  }
}

