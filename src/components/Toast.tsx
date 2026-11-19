import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

/** Action proposée dans le message, par exemple « Annuler » après une suppression. */
export type ToastAction = { label: string; run: () => void | Promise<void> }
type Toast = { id: number; text: string; action?: ToastAction }

const Ctx = createContext<(text: string, action?: ToastAction) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const seq = useRef(0)
  const show = useCallback((text: string, action?: ToastAction) => {
    const id = ++seq.current
    setToast({ id, text, action })
    // Plus long quand on peut annuler : le temps de réagir.
    window.setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), action ? 7000 : 3200)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast${toast.action ? ' with-action' : ''}`} role="status" key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                const a = toast.action!
                setToast(null)
                void Promise.resolve(a.run()).catch((e: unknown) => show(e instanceof Error ? e.message : 'Action impossible'))
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
