import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ensureSession, recoverSession } from '@/api/session'
import { getToken, getUserId } from '@/utils/storage'
export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken())
  const userId = ref(getUserId())
  const isLoggedIn = ref(false)
  async function checkAuth() {
    token.value = await ensureSession()
    userId.value = getUserId()
    isLoggedIn.value = true
  }
  async function resetDevice() {
    await recoverSession(getToken() || '')
    await checkAuth()
  }
  return { token, userId, isLoggedIn, checkAuth, resetDevice }
})
