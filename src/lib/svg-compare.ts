export const COMPARE_RENDER_SIZE = 512
const ALPHA_THRESHOLD = 16
const CORNER_FACTOR = 1 - Math.PI / 4
const CORNER_UNRELIABLE_RATIO = 0.35

export type CompareCorner = 'bl' | 'br' | 'tl' | 'tr'
export type CompareFit = 'meet' | 'stretch'

export interface SvgAnalysis {
  bbox: { height: number; width: number; x: number; y: number }
  coverage: number
  empty: boolean
  height: number
  padding: { bottom: number; left: number; right: number; top: number }
  radii: Record<CompareCorner, null | number>
  unreliable: CompareCorner[]
  width: number
}

export interface SvgCompareResult {
  current: SvgAnalysis
  diff: {
    intersection: number
    iou: number
    onlyCurrent: number
    onlyReference: number
  }
  images: {
    current: string
    diff: string
    reference: string
  }
  reference: SvgAnalysis
  size: number
}

interface PreparedSvg {
  height: number
  svgText: string
  width: number
}

interface AnalyzedCanvas extends SvgAnalysis {
  alpha: Uint8Array
}

const corners: CompareCorner[] = ['tl', 'tr', 'br', 'bl']

const injectNamespace = (text: string) => {
  const match = text.match(/<svg\b[^>]*>/i)
  if (!match) return text

  let tag = match[0]
  const patches: string[] = []
  if (!/\sxmlns\s*=/.test(tag)) {
    patches.push('xmlns="http://www.w3.org/2000/svg"')
  }
  if (!/\sxmlns:xlink\s*=/.test(tag) && /xlink:/.test(text)) {
    patches.push('xmlns:xlink="http://www.w3.org/1999/xlink"')
  }
  if (patches.length !== 0) {
    tag = tag.replace(/<svg\b/i, `<svg ${patches.join(' ')}`)
  }
  return text.replace(match[0], tag)
}

const prepareSvg = (raw: string): PreparedSvg => {
  const text = injectNamespace(raw.trim())
  const documentNode = new DOMParser().parseFromString(text, 'image/svg+xml')

  if (documentNode.querySelector('parsererror')) {
    throw new Error('SVG parse failed')
  }

  const root = documentNode.documentElement
  if (root.nodeName.toLowerCase() !== 'svg') {
    throw new TypeError('SVG root is invalid')
  }

  let viewBox: null | number[] = null
  const viewBoxAttribute = root.getAttribute('viewBox')
  if (viewBoxAttribute) {
    const parsed = viewBoxAttribute
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    if (parsed.length === 4 && parsed.every(Number.isFinite)) {
      viewBox = parsed
    }
  }

  const width = Number.parseFloat(root.getAttribute('width') ?? '')
  const height = Number.parseFloat(root.getAttribute('height') ?? '')

  if (!viewBox) {
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new TypeError('SVG needs a viewBox or width and height')
    }
    viewBox = [0, 0, width, height]
    root.setAttribute('viewBox', viewBox.join(' '))
  }

  const viewBoxWidth = viewBox[2] || (Number.isFinite(width) ? width : 1)
  const viewBoxHeight = viewBox[3] || (Number.isFinite(height) ? height : 1)

  root.setAttribute('width', String(viewBoxWidth))
  root.setAttribute('height', String(viewBoxHeight))

  return {
    height: viewBoxHeight,
    svgText: new XMLSerializer().serializeToString(root),
    width: viewBoxWidth,
  }
}

const loadImage = (svgText: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const blob = new Blob([svgText], {
      type: 'image/svg+xml;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('SVG render failed'))
    }
    image.src = url
  })

const renderSvg = async (
  prepared: PreparedSvg,
  size: number,
  fit: CompareFit,
) => {
  const image = await loadImage(prepared.svgText)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is not available')

  context.clearRect(0, 0, size, size)

  const imageWidth = image.naturalWidth || prepared.width
  const imageHeight = image.naturalHeight || prepared.height

  if (fit === 'stretch') {
    context.drawImage(image, 0, 0, size, size)
  } else {
    const scale = Math.min(size / imageWidth, size / imageHeight)
    const width = imageWidth * scale
    const height = imageHeight * scale
    context.drawImage(
      image,
      (size - width) / 2,
      (size - height) / 2,
      width,
      height,
    )
  }

  return canvas
}

const getCornerRadius = (
  alpha: Uint8Array,
  width: number,
  height: number,
  bbox: SvgAnalysis['bbox'],
  corner: CompareCorner,
) => {
  const isLeft = corner[1] === 'l'
  const isTop = corner[0] === 't'
  const sampleSize = Math.max(
    4,
    Math.round(Math.min(bbox.width, bbox.height) / 2),
  )

  let blank = 0
  let total = 0

  for (let dy = 0; dy < sampleSize; dy++) {
    const y = isTop ? bbox.y + dy : bbox.y + bbox.height - 1 - dy
    if (y < 0 || y >= height) continue

    for (let dx = 0; dx < sampleSize; dx++) {
      const x = isLeft ? bbox.x + dx : bbox.x + bbox.width - 1 - dx
      if (x < 0 || x >= width) continue
      total++
      if (alpha[y * width + x] <= ALPHA_THRESHOLD) blank++
    }
  }

  const blankRatio = total ? blank / total : 0
  const radius = Math.sqrt(blank / CORNER_FACTOR)
  const reliable = blankRatio <= CORNER_UNRELIABLE_RATIO

  return {
    blankRatio,
    radius: reliable ? radius : null,
  }
}

const analyzeCanvas = (canvas: HTMLCanvasElement): AnalyzedCanvas => {
  const width = canvas.width
  const height = canvas.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is not available')

  const data = context.getImageData(0, 0, width, height).data
  const alpha = new Uint8Array(width * height)

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let count = 0

  for (let y = 0, index = 0; y < height; y++) {
    for (let x = 0; x < width; x++, index++) {
      const value = data[index * 4 + 3]
      alpha[index] = value
      if (value > ALPHA_THRESHOLD) {
        count++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) {
    return {
      alpha,
      bbox: { height: 0, width: 0, x: 0, y: 0 },
      coverage: 0,
      empty: true,
      height,
      padding: { bottom: 0, left: 0, right: 0, top: 0 },
      radii: { bl: null, br: null, tl: null, tr: null },
      unreliable: [],
      width,
    }
  }

  const bbox = {
    height: maxY - minY + 1,
    width: maxX - minX + 1,
    x: minX,
    y: minY,
  }
  const radii = {} as Record<CompareCorner, null | number>
  const unreliable: CompareCorner[] = []

  corners.forEach((corner) => {
    const result = getCornerRadius(alpha, width, height, bbox, corner)
    radii[corner] = result.radius
    if (result.radius === null) unreliable.push(corner)
  })

  return {
    alpha,
    bbox,
    coverage: count / (width * height),
    empty: false,
    height,
    radii,
    unreliable,
    width,
    padding: {
      bottom: (height - 1 - maxY) / height,
      left: minX / width,
      right: (width - 1 - maxX) / width,
      top: minY / height,
    },
  }
}

const createDiffCanvas = (
  reference: AnalyzedCanvas,
  current: AnalyzedCanvas,
) => {
  const { height, width } = reference
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')

  const imageData = context.createImageData(width, height)
  const output = imageData.data

  let intersection = 0
  let onlyReference = 0
  let onlyCurrent = 0

  for (let index = 0; index < width * height; index++) {
    const inReference = reference.alpha[index] > ALPHA_THRESHOLD
    const inCurrent = current.alpha[index] > ALPHA_THRESHOLD
    const target = index * 4

    if (inReference && inCurrent) {
      intersection++
      output[target] = 120
      output[target + 1] = 128
      output[target + 2] = 145
      output[target + 3] = 80
    } else if (inReference) {
      onlyReference++
      output[target] = 255
      output[target + 1] = 77
      output[target + 2] = 77
      output[target + 3] = 210
    } else if (inCurrent) {
      onlyCurrent++
      output[target] = 64
      output[target + 1] = 208
      output[target + 2] = 224
      output[target + 3] = 210
    }
  }

  context.putImageData(imageData, 0, 0)

  const union = intersection + onlyReference + onlyCurrent

  return {
    canvas,
    intersection,
    iou: union ? intersection / union : 1,
    onlyCurrent,
    onlyReference,
  }
}

const withoutAlpha = (analysis: AnalyzedCanvas): SvgAnalysis => ({
  bbox: analysis.bbox,
  coverage: analysis.coverage,
  empty: analysis.empty,
  height: analysis.height,
  padding: analysis.padding,
  radii: analysis.radii,
  unreliable: analysis.unreliable,
  width: analysis.width,
})

export const compareSvgIcons = async (
  referenceSvg: string,
  currentSvg: string,
  options?: { fit?: CompareFit; size?: number },
): Promise<SvgCompareResult> => {
  const size = options?.size ?? COMPARE_RENDER_SIZE
  const fit = options?.fit ?? 'meet'

  const [referencePrepared, currentPrepared] = [
    prepareSvg(referenceSvg),
    prepareSvg(currentSvg),
  ]
  const [referenceCanvas, currentCanvas] = await Promise.all([
    renderSvg(referencePrepared, size, fit),
    renderSvg(currentPrepared, size, fit),
  ])

  const referenceAnalysis = analyzeCanvas(referenceCanvas)
  const currentAnalysis = analyzeCanvas(currentCanvas)
  const diff = createDiffCanvas(referenceAnalysis, currentAnalysis)

  return {
    current: withoutAlpha(currentAnalysis),
    reference: withoutAlpha(referenceAnalysis),
    size,
    diff: {
      intersection: diff.intersection,
      iou: diff.iou,
      onlyCurrent: diff.onlyCurrent,
      onlyReference: diff.onlyReference,
    },
    images: {
      current: currentCanvas.toDataURL('image/png'),
      diff: diff.canvas.toDataURL('image/png'),
      reference: referenceCanvas.toDataURL('image/png'),
    },
  }
}
