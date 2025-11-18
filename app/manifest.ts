import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Diary',
    short_name: 'AI Diary',
    description: '忙しいあなたにピッタリ、文章自動生成で毎日の投稿をラクに',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ff69b4',
    icons: [
      {
        src: '/1.png',
        sizes: 'any',
        type: 'image/png',
      },
      {
        src: '/1.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/1.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

