'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  signup: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  function signup(email: string, password: string) {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized')
    }
    return createUserWithEmailAndPassword(auth, email, password).then(() => {
      // ユーザー作成成功
    })
  }

  function login(email: string, password: string) {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized')
    }
    return signInWithEmailAndPassword(auth, email, password).then(() => {
      // ログイン成功
    })
  }

  function logout() {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized')
    }
    return signOut(auth)
  }

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value: AuthContextType = {
    currentUser,
    loading,
    signup,
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

