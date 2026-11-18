import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> }
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number }
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number }; canvas?: HTMLCanvasElement }) => { promise: Promise<void>; cancel: () => void }
}

/** Chargé seulement à l'ouverture d'un PDF : la page reste légère. */
async function loadPdfJs() {
  const [lib, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  lib.GlobalWorkerOptions.workerSrc = worker.default
  return lib
}

/** Lecteur PDF : toutes les pages à la suite, zoom, numéro de page. Rendu identique partout (web, bureau, téléphone). */
export function PdfView({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const [page, setPage] = useState(1)

  useEffect(() => {
    let alive = true
    let task: { promise: Promise<unknown>; destroy: () => Promise<void> } | null = null
    setDoc(null)
    setError(false)
    loadPdfJs()
      .then((lib) => {
        if (!alive) return null
        task = lib.getDocument({ url }) as unknown as typeof task
        return task!.promise as Promise<PdfDoc>
      })
      .then((d) => alive && d && setDoc(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
      void (task as { destroy: () => Promise<void> } | null)?.destroy()
    }
  }, [url])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Page courante = celle qui occupe le milieu de l'écran.
  function onScroll() {
    const el = box.current
    if (!el) return
    const mid = el.scrollTop + el.clientHeight / 2
    const pages = [...el.querySelectorAll<HTMLElement>('.pdf-page')]
    const i = pages.findIndex((p) => p.offsetTop + p.offsetHeight > mid)
    setPage(i < 0 ? pages.length : i + 1)
  }

  if (error) return <div className="viewer-empty"><strong>Impossible d'ouvrir ce PDF</strong><a className="btn" href={url} target="_blank" rel="noreferrer">Ouvrir dans un onglet</a></div>

  const pageWidth = Math.max(240, Math.min(width - 24, 900) * zoom)
  return (
    <div className="pdf-wrap">
      <div className="pdf-scroll" ref={box} onScroll={onScroll}>
        {!doc ? (
          <div className="viewer-empty" style={{ height: '100%', justifyContent: 'center' }}><span className="spinner" /></div>
        ) : (
          width > 0 && Array.from({ length: doc.numPages }, (_, i) => <PdfPageCanvas key={i} doc={doc} n={i + 1} width={pageWidth} />)
        )}
      </div>
      {doc && (
        <div className="pdf-bar">
          <span>{page} / {doc.numPages}</span>
          <button aria-label="Dézoomer" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>−</button>
          <button className="pdf-zoom" onClick={() => setZoom(1)} title="Taille normale">{Math.round(zoom * 100)} %</button>
          <button aria-label="Zoomer" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>+</button>
          <a href={url} target="_blank" rel="noreferrer" aria-label="Ouvrir dans un onglet" title="Ouvrir dans un onglet"><Icon name="external" size={16} /></a>
        </div>
      )}
    </div>
  )
}

/** Une page : dessinée quand elle approche de l'écran. */
function PdfPageCanvas({ doc, n, width }: { doc: PdfDoc; n: number; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [ratio, setRatio] = useState(1.414)
  const [visible, setVisible] = useState(n <= 2)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let task: { promise: Promise<void>; cancel: () => void } | null = null
    let alive = true
    void doc.getPage(n).then((p) => {
      if (!alive || !ref.current) return
      const base = p.getViewport({ scale: 1 })
      setRatio(base.height / base.width)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const vp = p.getViewport({ scale: (width / base.width) * dpr })
      const canvas = ref.current
      canvas.width = Math.floor(vp.width)
      canvas.height = Math.floor(vp.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      task = p.render({ canvasContext: ctx, viewport: vp, canvas })
      task.promise.catch(() => {})
    })
    return () => {
      alive = false
      task?.cancel()
    }
  }, [doc, n, width, visible])

  return <canvas ref={ref} className="pdf-page" style={{ width, height: width * ratio }} aria-label={`Page ${n}`} />
}
