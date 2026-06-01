import { useSessionStore } from '../store/sessionStore'

export function ControlRequestToast() {
  const requests = useSessionStore((s) => s.controlRequests)
  const removeRequest = useSessionStore((s) => s.removeControlRequest)

  if (requests.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {requests.map((req) => (
        <div
          key={req.requestId}
          className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl min-w-[280px]"
        >
          <p className="text-sm text-white mb-2">
            <span className="text-blue-400">{req.username}</span> requests control of this terminal
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                useSessionStore.getState().sendGrantControl?.(req.requestId)
                removeRequest(req.requestId)
              }}
              className="flex-1 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors"
            >
              Grant
            </button>
            <button
              onClick={() => {
                useSessionStore.getState().sendDenyControl?.(req.requestId)
                removeRequest(req.requestId)
              }}
              className="flex-1 px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-xs font-medium hover:bg-gray-600 transition-colors"
            >
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
