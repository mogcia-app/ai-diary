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
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return docRef.id
}

/**
 * ドキュメントを取得
 */
export async function getDocument<T>(
  collectionName: string,
  documentId: string
): Promise<T | null> {
  const docRef = doc(db, collectionName, documentId)
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
  const q = query(collection(db, collectionName), ...constraints)
  const querySnapshot = await getDocs(q)

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[]
}

/**
 * ユーザーIDでフィルタリングしてドキュメントを取得
 */
export async function getDocumentsByUserId<T>(
  collectionName: string,
  userId: string,
  additionalConstraints: QueryConstraint[] = []
): Promise<T[]> {
  const constraints = [
    where('userId', '==', userId),
    ...additionalConstraints,
  ]
  return getDocuments<T>(collectionName, constraints)
}

/**
 * ドキュメントを更新
 */
export async function updateDocument(
  collectionName: string,
  documentId: string,
  data: Partial<Record<string, any>>
): Promise<void> {
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
  const docRef = doc(db, collectionName, documentId)
  await deleteDoc(docRef)
}

// 使用例の型定義
export interface DiaryEntry {
  id?: string
  userId: string
  title: string
  content: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

