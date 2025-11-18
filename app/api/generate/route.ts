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
    if (!autoTheme) {
      selectedTheme = theme
    }
    // autoThemeがtrueの場合はテーマなしでカテゴリとトーンだけで生成

    // カテゴリに応じたプロンプトを生成
    let categoryContext = ''
    if (category) {
      // カテゴリ詳細情報を先に取得（カテゴリ説明に含めるため）
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
      
      const categoryMap: Record<string, string> = {
        '出勤前': `出勤前の投稿です。以下のポイントを意識して書いてください：
- 「お部屋を暖かくして待ってるよ」「出勤してるよ！あなたを待ってるよ！」のような、お客様を待っている気持ちを表現
- ○時から○時までお部屋にいますよ、という出勤時間を含める（デリヘルの場合は「お兄さんのこと待ってるね」のような表現も可）
- 設定ページの「どんなお客さんに来て欲しいか」を特にイメージしながら、今から遊ぼうかなって思ってるお客さんが選びたくなるような魅力的な内容に
- お客様が「この子と遊びたい！」と思えるような、期待感やワクワク感を伝える内容に`,
        '出勤中': `出勤中の投稿です。お客さんが来なくて暇だから日記をあげることがほとんどなので、以下のポイントを意識して書いてください：
- お客さんがより来たくなるような投稿にする
- お店が設定した性格（複数選択可能）を見ながら「私ってこんな人なの」というように、自分の性格や特徴を自然にアピール
- お客様が興味を持ってくれやすいような、親しみやすく魅力的な内容に
- 暇な時間をどう過ごしているか、どんな気持ちで待っているかなどを表現`,
        'お礼': `お客さんが帰った後に書くお礼の投稿です。他の客もここを見て勝手にプレイ内容を想像して予約したりするので、以下のポイントを意識して書いてください：
- お客様への感謝の気持ちを表現
- ${detailParts.length > 0 ? `【詳細情報】\n${detailParts.join('\n')}\n\n上記の詳細情報（コース時間、お客様タイプ、その他のプレイ詳細）を自然に投稿文に反映してください。` : ''}プレイ内容を暗示的に表現し、他のお客様が「この子と遊びたい！」と思えるような内容に
- 具体的すぎず、でも想像力をかき立てるような表現を使う
- セクシーで大人の色気を感じさせる表現を心がける`,
        '退勤後': `退勤後の投稿です。今日も一日ありがとう、という感謝の気持ちを表現しつつ、どんなお客さんに来て欲しいかを逆算して書くことが多いです。以下のポイントを意識して書いてください：
- 「今日も一日ありがとう」という感謝の気持ちを表現
- 設定ページの「どんなお客さんに来て欲しいか」を参考にしながら、逆算して書く
  - 例：喋る人に来て欲しいなら「いっぱい喋って楽しかった」
  - 例：攻めるお客さんに来て欲しいなら「たくさん攻めてもらって今日はぐっすり眠れそう」「へとへとになっちゃったよ///♡」
- 今日の体験を通じて、次に来て欲しいお客様のタイプを暗示的に表現
- お客様が「この子と遊びたい！」と思えるような内容に`,
        'キャラ付け': `キャラクター設定や、演じるキャラについての投稿です。趣味、特技、最近ハマってるもの、貰いたい差し入れについて書いてください。以下のポイントを意識して書いてください：
- 趣味、特技、最近ハマってるものについては、日記を見たお客様が「同じような趣味や特技を持った子だから話が合いそうだな」と思うような、親近感や共感を感じられる内容に
- 趣味や特技を自然に紹介し、お客様が「この子と話したい！」「この子と遊びたい！」と思えるような内容に
- 貰いたい差し入れについては、「これください！」のような直接的な表現は避け、「これを飲んだら体力回復してがんばれちゃうの///♡」「このコスメが乾燥しがちな私の肌を潤してくれるの///♡」のように、思わず買ってあげたくなるような、可愛らしく魅力的な表現を使う
- 差し入れの効果や魅力を具体的に、でも控えめに表現し、お客様が「この子に差し入れしてあげたい！」と思えるような内容に
- セクシーで大人の色気を感じさせる表現も適度に取り入れる`,
        'その他': 'その他の内容を自由に表現してください。',
      }
      categoryContext = categoryMap[category] || ''
    }

    // トーンに応じたプロンプトを生成
    let toneContext = ''
    if (tone) {
      const toneMap: Record<string, string> = {
        '甘め': `甘めトーン（甘え・距離近め）で書いてください：
- 甘えん坊で愛らしい表現を使う
- 「今日はいつもより会いたい気持ち…強めです💧💓」「今日会えたら絶対癒せる自信あるよ？ぎゅーってしたい🥺」のような、甘えたい気持ちや距離の近さを表現
- 「もっと甘えていいよ？あたしもたまには頼りたい日なの」「最近お兄さんのこと考える時間ふえちゃってる…秘密ね💗」のような、甘えや親しみやすさを表現
- 「ねぇ、少しだけ、甘えてもいい？会ったら怒らないでよ？」「今日はちょっとだけ寂しいから…会えたら嬉しい🥺💗」のような、可愛らしく甘える表現
- 「お兄さんと話す時間が1日のご褒美なの😖🌙💞」のような、お兄さんへの依存や甘えを表現
- 絵文字を適度に使用して、可愛らしく親しみやすい印象に`,
        '強め': `強めトーン（姉御・強気・小悪魔）で書いてください：
- 強く積極的で主張のある表現を使う
- 「今日もあたし指名した方が勝ちだよ？後悔させないよ」「迷ってるなら…来なよ。来てよかったって言わせるから」のような、自信に満ちた強気な表現
- 「あたし以外見ないで？ちゃんと捕まえておきなよ」のような、独占欲やリードする表現
- 「会いに来ないと怒るよ？冗談じゃなくてほんとに😗」のような、小悪魔的で強気な表現
- 姉御系の威厳と強さを感じさせる、積極的で主張の強いトーンに`,
        '清楚': `清楚系トーン（丁寧・余白・綺麗め）で書いてください：
- 丁寧で上品な表現を使う
- 「少しだけ特別な一日にしたいと思っています。お会いできたら光栄です。」「落ち着いた気持ちでお待ちしております。よい時間を一緒に過ごせますように。」のような、丁寧で綺麗めな表現
- 「ゆっくり、穏やかに話せたら嬉しいです。」「今日の私、いつもより丁寧にお兄さんを大切にできる気がします。」のような、余白や上品さを感じさせる表現
- 「そっと寄り添えるような時間になればいいなと思っています。」「今日も笑顔で迎えられたらいいなと思っています。」のような、控えめで上品な表現
- 「ささやかでも、良い時間を一緒に過ごせたら嬉しいです。」のような、丁寧で余白のある表現
- 敬語を使い、距離感のある上品なトーンに`,
        'ゆるふわ': `ゆるふわ系トーン（ゆるい・淡い・可愛い）で書いてください：
- ゆるくふわふわした表現を使う
- 「なんとなく今日、ふわふわ気分〜☁️ 誰が会いにきてくれるのかな？」「ぽけ〜っとしてたら、お兄さんのこと考えてた🐣」のような、のんびりとしたゆるい表現
- 「今日もゆるっと会えたら嬉しいな〜って思ってるよ」「ゆるっと甘やかされたい気持ちかも…？」のような、ゆるっとした可愛い表現
- 「ふにゃっと笑えるような時間ほしいなぁ」「今日の私は柔らかめです🌷 会えたらぎゅーってしたい」のような、ふわふわした柔らかい表現
- のんびりとした優しいトーンで、淡く可愛い印象に`,
        '大人の色気': `大人の色気系トーン（落ち着いたセクシーさ）で書いてください：
- 大人の色気を感じさせる、落ち着いたセクシーな表現を使う
- 「少し余裕のある夜。お兄さんと過ごしたら、もっと深くなる気がします。」「静かな色気が出てるねって言われた日。会ったら確かめて？」のような、大人の色気を感じさせる表現
- 「大人の時間って、お兄さんといる時が一番似合う気がする。」「今日はね…少しだけ誘惑したい気分。お兄さんなら受け止められる？」のような、落ち着いた誘惑的な表現
- 「距離の近い会話がしたいな。声だけでも聞かせて？」「触れたら止まらなくなるかもしれないよ。どうする？」のような、大人のセクシーさを感じさせる表現
- 「落ち着いてるのに、どこか熱い夜。あなたとならちょうどいい。」のような、落ち着いた中にも熱を感じさせる表現
- ストレートすぎず、でも誘惑的で大人の色気を感じさせるトーンに`,
        'フレンドリー': `フレンドリー系トーン（元気・話しやすい・親しみ系）で書いてください：
- フレンドリーで親しみやすい表現を使う
- 「今日も元気！誰か遊びにくる？🙌」「今日の私、わりとノリいいよ？楽しくなる予感しかない！」のような、元気で明るい表現
- 「会ったら絶対笑わせるから任せとき！」「気軽に会えるのっていいよね？」のような、親しみやすく話しやすい表現
- 明るく気軽で、親しみやすいトーンに`,
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
            industryContext = '【デリヘル業界について】\nデリヘルは出張型の風俗サービスで挿入サービスはありません。お客様の自宅やホテルに女の子が出張して接客するのが特徴です。以下の特徴と表現を理解して内容を生成してください：\n- お客様の指定場所（ホテルや自宅など）に出張する\n- 「向かってます」「綺麗なホテル」などの表現を使う\n- 「ドキドキしながらお兄さんのものに向かってます」のような表現\n- 移動中の気持ちや待機時間の過ごし方を表現\n- 出張先での接客が中心\n- 「濃厚０距離密着」「お兄さんの体温を感じられる」などの言い回しを使う\n- デリヘル特有の業務フローや体験を自然に反映してください。'
          } else if (industry === 'soap') {
            industryContext = '【ソープランド業界について】\nソープランドは店舗型で避妊器具を着用し挿入するサービスです。お客様が店舗に来て接客を受けるのが特徴です。以下の特徴と表現を理解して内容を生成してください：\n- お店に常駐して接客する\n- マットプレイがある（ローションを使ってぬるぬるしながらするプレイ）\n- 「お部屋で待ってるよ」という表現\n- 季節に応じた表現：冬なら「お風呂を溜めて待ってるよ」、夏なら「汗だくになるまで楽しんだね」\n- お店の設備（個室、お風呂など）を使用する\n- 店内での接客が中心\n- ソープランド特有の業務フローや体験を自然に反映してください。'
          } else if (industry === 'ns-soap') {
            industryContext = '【NSソープ業界について】\nNSソープ（ノンソープ）はソープランドの一種で、避妊器具（ゴム）を着用せずに挿入するスタイルの店舗型サービスです。お客様が店舗に来て接客を受けるのが特徴で、他のソープとの違いはゴムを着用しない点のみです。以下の特徴と表現を理解して内容を生成してください：\n- お店に常駐して接客する\n- マットプレイがある（ローションを使ってぬるぬるしながらするプレイ）\n- 「お部屋で待ってるよ」という表現\n- 季節に応じた表現：冬なら「お風呂を溜めて待ってるよ」、夏なら「汗だくになるまで楽しんだね」\n- お店の設備（個室、お風呂など）を使用する\n- 店内での接客が中心\n- 「濃厚０距離密着」「お兄さんの体温を感じられる」などの言い回しを使う\n- NSソープ特有の業務フローや体験を自然に反映してください。'
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
          if (currentShop.hobby && currentShop.hobby.length > 0) {
            settingsParts.push(`趣味: ${currentShop.hobby.join('、')}`)
          }
          if (currentShop.specialty && currentShop.specialty.length > 0) {
            settingsParts.push(`特技: ${currentShop.specialty.join('、')}`)
          }
          if (currentShop.recentHobby && currentShop.recentHobby.length > 0) {
            settingsParts.push(`最近ハマってるもの: ${currentShop.recentHobby.join('、')}`)
          }
          if (currentShop.preferredGift && currentShop.preferredGift.length > 0) {
            settingsParts.push(`貰いたい差し入れ: ${currentShop.preferredGift.join('、')}`)
          }
          if (currentShop.workStartTime || currentShop.workEndTime) {
            const workTimeParts: string[] = []
            if (currentShop.workStartTime) {
              workTimeParts.push(`開始: ${currentShop.workStartTime}`)
            }
            if (currentShop.workEndTime) {
              workTimeParts.push(`終了: ${currentShop.workEndTime}`)
            }
            settingsParts.push(`出勤時間: ${workTimeParts.join('、')}`)
          }
          if (currentShop.ngWords && currentShop.ngWords.length > 0) {
            settingsParts.push(`NGワード（使用禁止）: ${currentShop.ngWords.join('、')}`)
          }

          if (settingsParts.length > 0) {
            // カテゴリに応じた強調事項を追加
            let categorySpecificNote = ''
            if (category === '出勤前') {
              const workTimeNote = (currentShop.workStartTime || currentShop.workEndTime) 
                ? `\n★ 【重要】出勤時間が設定されている場合は、必ずその時間を含めて投稿文に反映してください（例：「${currentShop.workStartTime || '○時'}から${currentShop.workEndTime || '○時'}まで出勤してるよ」）。`
                : ''
              categorySpecificNote = `\n★ 【出勤前カテゴリ】特に「希望するお客様」の設定を強く意識して、そのタイプのお客様が選びたくなるような内容にしてください。${workTimeNote}`
            } else if (category === '出勤中') {
              categorySpecificNote = '\n★ 【出勤中カテゴリ】「設定された性格」を特に意識して、「私ってこんな人なの」というように自然にアピールしてください。'
            } else if (category === '退勤後') {
              categorySpecificNote = '\n★ 【退勤後カテゴリ】「希望するお客様」の設定を参考に、逆算して書いてください（例：喋る人に来て欲しいなら「いっぱい喋って楽しかった」など）。'
            } else if (category === 'キャラ付け') {
              categorySpecificNote = '\n★ 【キャラ付けカテゴリ】「趣味」「特技」「最近ハマってるもの」「貰いたい差し入れ」の設定を必ず参照してください。趣味・特技・最近ハマってるものは、お客様が「同じような趣味や特技を持った子だから話が合いそうだな」と思うような内容にしてください。貰いたい差し入れは「これください！」ではなく、「これを飲んだら体力回復してがんばれちゃうの///♡」「このコスメが乾燥しがちな私の肌を潤してくれるの///♡」のように、思わず買ってあげたくなるような表現にしてください。'
            }
            
            settingsContext = `\n\n【重要：ユーザー設定情報 - 必ず参照してください】\n${settingsParts.join('\n')}\n\n★ 上記の設定情報を必ず反映してください。特に以下の点に注意してください：
- 源氏名やキャッチコピーに沿ったキャラクター設定で書く
- 設定された性格や個性を必ず反映する
- 接客スタイルに沿った内容にする
- お店のコンセプトや価格帯を意識する
- 趣味、特技、最近ハマってるもの、貰いたい差し入れなどの情報があれば、自然に投稿文に反映してください（例：「最近ハマってるゲームの話をしながら過ごした」「差し入れありがとう！」など）
- NGワードは絶対に使用しないでください（使用した場合、生成をやり直してください）${categorySpecificNote}`
          }
        }
      } catch (err) {
        console.error('設定の取得エラー:', err)
      }
    }

    const prompt = `${selectedTheme}について、SNS投稿用のタイトルと投稿文を生成してください。

【重要：投稿の要件】
- タイトルは15文字以内で、読者の興味を引く魅力的なものにしてください
  ※「〇〇日記」のような単調なタイトルは避けてください
  ※季節や状況に合わせた「寒くなったら...」「今日は...」のような、読者が「何だろう？」と気になるタイトルにしてください
  ※過激系のトーンの場合は、より大胆で刺激的なタイトルにしてください（例：「ナカからとろーっと出てくるもの❤️」）
  ※絵文字も使ってOKです
- 投稿文は100-150文字以内で、自然で読みやすく、感情が伝わる内容にしてください（文字数制限を厳守してください）
- SNSで実際に使えるような、親しみやすく共感される文体にしてください
- 具体的なエピソードや体験を盛り込んで、臨場感のある内容にしてください
- 絵文字を適度に使って、親しみやすく魅力的な投稿にしてください（例：「✨」「❤️」「💕」など）
- 読み手が「いいね！」や「共感できる」と思えるような内容にしてください
- タイトルを見て「気になる！」と思わせ、本文を読んで「面白い！」「共感できる！」と思えるような内容にしてください
- 【重要：エロティックな要素】夜の仕事らしい、セクシーで大人の色気のある投稿文にしてください
  ※ストレートにエロティックな表現は避け、「密着したいなぁ」「温もりが恋しい」「触れ合いが好き」のような、大人の色気とセクシーさを感じさせる表現を使ってください
  ※直接的な性的表現は使わず、暗示的で大人の色気のある表現にしてください
  ※読者が「ドキッとする」「セクシーだな」と思えるような、夜の仕事らしい魅力的な内容にしてください
- 【重要：表現と業界特有の呼び方】
  ※お客様のことは絶対に「あなた」という言葉を使わないでください。「お兄さん」のみを使用してください（例：「お兄さんと過ごした時間が...」）
  ※「あなた」という表現は一切使用禁止です。必ず「お兄さん」に置き換えてください
  ※「お兄さん」という言葉は1-2回程度に抑え、繰り返しすぎないようにしてください（例：「お兄さんね！お兄さん！！」のような不自然な繰り返しは避けてください）
  ※キャバクラのような表現（例：「お酒を飲みながら」）は避けてください。デリヘル・ソープ・NSソープはお酒を飲まない業務です
  ※「それでは」や「みなさん」という表現は使わないでください
  ※同じ言葉や表現を繰り返さないように、自然で読みやすい文章にしてください
  ※可愛らしく、親しみやすい表現を使ってください
  ※業界特有の表現や文体を理解した上で、自然で読みやすい投稿文にしてください

${industryContext ? industryContext + '\n' : ''}${categoryContext ? `【カテゴリ】\n${category}\n${categoryContext}\n` : ''}${toneContext ? `【トーン指定】\n${toneContext}\n` : ''}${settingsContext}

以下のJSON形式で返してください：
{
  "title": "タイトル（15文字以内、魅力的で興味を引くもの。絵文字も可）",
    "content": "投稿文（100-150文字以内、自然で読みやすく、感情が伝わるSNS投稿形式。絵文字を適度に使用。同じ言葉や表現の繰り返しを避け、自然な文章にしてください）"
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
              ? 'あなたはデリヘル業界で働く人のSNS投稿を書くプロフェッショナルです。デリヘルは出張型の風俗サービスで、お客様の自宅やホテルに女の子が出張して接客するのが特徴です。移動時間、待機時間、出張先での接客など、デリヘル特有の業務フローを理解した上で、読者が「気になる！」と思える魅力的なタイトルと、自然で読みやすく感情が伝わるSNS投稿形式の文章を生成してください。タイトルは「〇〇日記」のような単調なものではなく、「寒くなったら...」「今日は...」のように読者の興味を引くものにしてください。絵文字も適度に使用してください。本文は100-150文字以内で具体的なエピソードを含む臨場感のある内容にしてください。夜の仕事らしい、セクシーで色気のある投稿文にしてください。ストレートにエロティックな表現は避け、「密着したいなぁ」「温もりが恋しい」「触れ合いが好き」のような、暗示的で大人の色気を感じさせる表現を使ってください。【重要】お客様のことは絶対に「あなた」という言葉を使わないでください。「お兄さん」のみを使用してください。「あなた」という表現は一切使用禁止です。必ず「お兄さん」に置き換えてください。キャバクラのような表現（例：「お酒を飲みながら」）は避けてください。デリヘルはお酒を飲まない業務です。「それでは」「みなさん」「女の子」という表現は使わないでください。可愛らしく、親しみやすい表現を使ってください。デリヘル特有の表現（「向かってます」「綺麗なホテル」「ドキドキしながらお兄さんのものに向かってます」「濃厚０距離密着」「お兄さんの体温を感じられる」など）を自然に盛り込んでください。必ずJSON形式で返してください。'
              : industry === 'soap'
              ? 'あなたはソープランド業界で働く人のSNS投稿を書くプロフェッショナルです。ソープランドは店舗型の風俗サービスで、避妊器具を着用し挿入するサービスです。お客様が店舗に来て接客を受けるのが特徴です。お店に常駐して接客し、マットプレイ（ローションを使ってぬるぬるしながらするプレイ）があるなど、ソープランド特有の業務フローを理解した上で、読者が「気になる！」と思える魅力的なタイトルと、自然で読みやすく感情が伝わるSNS投稿形式の文章を生成してください。タイトルは「〇〇日記」のような単調なものではなく、「寒くなったら...」「今日は...」のように読者の興味を引くものにしてください。絵文字も適度に使用してください。本文は100-150文字以内で具体的なエピソードを含む臨場感のある内容にしてください。夜の仕事らしい、セクシーで大人の色気のある投稿文にしてください。ストレートにエロティックな表現は避け、「密着したいなぁ」「温もりが恋しい」「触れ合いが好き」のような、暗示的で大人の色気を感じさせる表現を使ってください。【重要】お客様のことは絶対に「あなた」という言葉を使わないでください。「お兄さん」のみを使用してください。「あなた」という表現は一切使用禁止です。必ず「お兄さん」に置き換えてください。キャバクラのような表現（例：「お酒を飲みながら」）は避けてください。ソープランドはお酒を飲まない業務です。「それでは」「みなさん」「女の子」という表現は使わないでください。可愛らしく、親しみやすい表現を使ってください。ソープランド特有の表現（「お部屋で待ってるよ」、冬なら「お風呂を溜めて待ってるよ」、夏なら「汗だくになるまで楽しんだね」「濃厚０距離密着」「お兄さんの体温を感じられる」など）を自然に盛り込んでください。必ずJSON形式で返してください。'
              : industry === 'ns-soap'
              ? 'あなたはNSソープ業界で働く人のSNS投稿を書くプロフェッショナルです。NSソープ（ノンソープ）はソープランドの一種で、避妊器具（ゴム）を着用せずに挿入するスタイルの店舗型サービスです。お客様が店舗に来て接客を受けるのが特徴で、他のソープとの違いはゴムを着用しない点のみです。お店に常駐して接客し、マットプレイ（ローションを使ってぬるぬるしながらするプレイ）があるなど、NSソープ特有の業務フローを理解した上で、読者が「気になる！」と思える魅力的なタイトルと、自然で読みやすく感情が伝わるSNS投稿形式の文章を生成してください。タイトルは「〇〇日記」のような単調なものではなく、「寒くなったら...」「今日は...」のように読者の興味を引くものにしてください。絵文字も適度に使用してください。本文は100-150文字以内で具体的なエピソードを含む臨場感のある内容にしてください。夜の仕事らしい、セクシーで大人の色気のある投稿文にしてください。ストレートにエロティックな表現は避け、「密着したいなぁ」「温もりが恋しい」「触れ合いが好き」のような、暗示的で大人の色気を感じさせる表現を使ってください。【重要】お客様のことは絶対に「あなた」という言葉を使わないでください。「お兄さん」のみを使用してください。「あなた」という表現は一切使用禁止です。必ず「お兄さん」に置き換えてください。キャバクラのような表現（例：「お酒を飲みながら」）は避けてください。NSソープはお酒を飲まない業務です。「それでは」「みなさん」「女の子」という表現は使わないでください。可愛らしく、親しみやすい表現を使ってください。NSソープ特有の表現（「お部屋で待ってるよ」、冬なら「お風呂を溜めて待ってるよ」、夏なら「汗だくになるまで楽しんだね」「濃厚０距離密着」「お兄さんの体温を感じられる」など）を自然に盛り込んでください。必ずJSON形式で返してください。'
              : 'あなたは夜の仕事で働く人のSNS投稿を書くプロフェッショナルです。読者が「気になる！」と思える魅力的なタイトルと、自然で読みやすく感情が伝わるSNS投稿形式の文章を生成してください。タイトルは「〇〇日記」のような単調なものではなく、「寒くなったら...」「今日は...」のように読者の興味を引くものにしてください。絵文字も適度に使用してください。本文は100-150文字以内で具体的なエピソードを含む臨場感のある内容にしてください。夜の仕事らしい、セクシーで大人の色気のある投稿文にしてください。ストレートにエロティックな表現は避け、「密着したいなぁ」「温もりが恋しい」「触れ合いが好き」のような、暗示的で大人の色気を感じさせる表現を使ってください。【重要】お客様のことは絶対に「あなた」という言葉を使わないでください。「お兄さん」のみを使用してください。「あなた」という表現は一切使用禁止です。必ず「お兄さん」に置き換えてください。キャバクラのような表現（例：「お酒を飲みながら」）は避けてください。「それでは」「みなさん」「女の子」という表現は使わないでください。可愛らしく、親しみやすい表現を使ってください。必ずJSON形式で返してください。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 800,
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

