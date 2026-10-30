import { useEffect, useState } from 'react'

/** Kurzer Hinweis unten in der Mitte. Neuer `token` → erneut anzeigen. */
export function Toast({ message, token }: { message: string; token: number }) {
  const [dismissed, setDismissed] = useState(0)

  useEffect(() => {
    if (!token) return
    const t = setTimeout(() => setDismissed(token), 1800)
    return () => clearTimeout(t)
  }, [token])

  if (!token || dismissed === token) return null
  return (
    <div key={token} className="toast material" role="status">
      <span className="toast__dot" />
      {message}
    </div>
  )
}
