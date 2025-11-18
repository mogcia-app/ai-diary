'use client'

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint,
  getDocFromCache,
} from 'firebase/firestore'
import { db } from './firebase'

// 基本的なCRUD操作

/**
 * コレクションにドキュメントを追加
 */
export async function createDocument<T extends Record<string, any>>(
  collectionName: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) {
    throw new Error('Firestore is not initialized')
  }
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return docRef.id
}

/**
 * ドキュメントを取得（キャッシュ優先で高速化）
 */
export async function getDocument<T>(
  collectionName: string,
  documentId: string
): Promise<T | null> {
  if (!db) {
    throw new Error('Firestore is not initialized')
  }
  const docRef = doc(db, collectionName, documentId)
  
  // まずキャッシュから取得を試みる（高速）
  try {
    const cachedDoc = await getDocFromCache(docRef)
    if (cachedDoc.exists()) {
      return {
        id: cachedDoc.id,
        ...cachedDoc.data(),
      } as T
    }
  } catch (error) {
    // キャッシュにない場合はサーバーから取得
  }
  
  // サーバーから取得
  const docSnap = await getDoc(docRef)

  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as T
  }
  return null
}

/**
 * コレクション内のすべてのドキュメントを取得
 */
export async function getDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  if (!db) {
    throw new Error('Firestore is not initialized')
  }
  const q = query(collection(db, collectionName), ...constraints)
  const querySnapshot = await getDocs(q)

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[]
}

/**
 * ユーザーIDでフィルタリングしてドキュメントを取得
 * （FirestoreのgetDocsはデフォルトでキャッシュを優先するため高速）
 */
export async function getDocumentsByUserId<T>(
  collectionName: string,
  userId: string,
  additionalConstraints: QueryConstraint[] = []
): Promise<T[]> {
  if (!db) {
    throw new Error('Firestore is not initialized')
  }
  const constraints = [
    where('userId', '==', userId),
    ...additionalConstraints,
  ]
  const q = query(collection(db, collectionName), ...constraints)
  // getDocsはデフォルトでキャッシュを優先するため、高速に動作します
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[]
}

/**
 * ドキュメントを更新
 */
export async function updateDocument(
  collectionName: string,
  documentId: string,
  data: Partial<Record<string, any>>
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized')
  }
  const docRef = doc(db, collectionName, documentId)
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

/**
 * ドキュメントを削除
 */
export async function deleteDocument(
  collectionName: string,
  documentId: string
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized')
  }
  const docRef = doc(db, collectionName, documentId)
  await deleteDoc(docRef)
}

// 使用例の型定義
export interface DiaryEntry {
  id?: string
  userId: string
  title: string
  content: string
  postDate?: string
  postTime?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface ShopSetting {
  stageName?: string // 源氏名
  catchphrase?: string // キャッチコピー
  shopIndustry?: 'delivery' | 'soap' | 'ns-soap' // お店の業種
  shopName?: string // お店の名前
  shopCourses?: string[] // お店のコース（複数追加可能）
  priceRange?: 'low' | 'medium' | 'high' // 価格帯
  shopConcept?: string // お店のコンセプト
  shopPersonalities?: string[] // お店が設定した性格（複数選択）
  shopTraits?: string[] // お店が設定した個性（複数選択）
  serviceStyle?: string // 接客スタイル
  ngWords?: string[] // NGワード設定
  targetCustomers?: string // どんなお客さんに来て欲しいか
}

export interface UserSettings {
  id?: string
  userId: string
  shops?: ShopSetting[] // 店舗設定の配列
  currentShopIndex?: number // 現在選択中の店舗インデックス
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

