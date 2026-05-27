let permissionGranted = false
// 安全修复[W25]: 持有当前通知引用，创建新通知前关闭旧通知，避免通知堆积
let currentNotification: Notification | null = null

export async function requestNotificationPermission(): Promise<void> {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    permissionGranted = true
    return
  }
  if (Notification.permission !== 'denied') {
    const result = await Notification.requestPermission()
    permissionGranted = result === 'granted'
  }
}

export function sendNotification(title: string, body: string): void {
  if (!permissionGranted || document.hidden !== true) return

  try {
    // 创建新通知前关闭旧通知
    if (currentNotification) {
      currentNotification.close()
      currentNotification = null
    }

    const notification = new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: 'ai-cli-notification',
    })
    currentNotification = notification

    setTimeout(() => {
      notification.close()
      if (currentNotification === notification) {
        currentNotification = null
      }
    }, 10_000)
  } catch {
    // Notification constructor may fail in some contexts
  }
}
