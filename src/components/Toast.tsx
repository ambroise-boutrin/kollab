import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const Ctx = createContext<(text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null)
  const show = useCallback((t: string) => {
    setText(t)
    window.setTimeout(() => setText((cur) => (cur === t ? null : cur)), 3200)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {text && <div className="toast" role="status" key={text}>{text}</div>}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
