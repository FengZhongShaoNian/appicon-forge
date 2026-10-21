import { buildIcon, loadIcon, replaceIDs } from '@iconify/react'

import { LIST_ICON_SIZE, PREVIEW_ICON_SIZE } from '@/constants/icon-size'
import { getIconPaddingValues, scaleShadow } from '@/lib/utils'
import { Gradient } from '@/store/constants'

import type { BorderRadius, Color, Shadow, Styles } from '@/store/interface'

const VIEW_BOX_SIZE = PREVIEW_ICON_SIZE
const CONIC_GRADIENT_SIZE = 1024
const DEFAULT_IMAGE_SIZE = 1024

export type IconPreviewType = 'icon' | 'text' | 'upload'

export interface CreateIconSvgOptions {
  iconName?: string
  imageSize: number
  previewType: IconPreviewType
  styles: Styles
  uploadContent?: string
}

interface FillResult {
  defs: string
  fill: string
  overlay: string
}

const escapeXml = (value: string) =>
  value.replace(
    /["&'<>]/g,
    (character) =>
      ({
        '"': '&quot;',
        '&': '&amp;',
        "'": '&apos;',
        '<': '&lt;',
        '>': '&gt;',
      })[character] ?? character,
  )

const formatNumber = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

const getColorValues = (colors: Color[]) => {
  const values = colors.map((color) => color.value)
  if (values.length === 0) return ['transparent', 'transparent']
  if (values.length === 1) return [values[0], values[0]]
  return values
}

const createGradientStops = (colors: string[]) =>
  colors
    .map((color, index) => {
      const offset = colors.length === 1 ? 0 : index / (colors.length - 1)
      return `<stop offset="${formatNumber(offset)}" stop-color="${escapeXml(color)}"/>`
    })
    .join('')

interface FillBox {
  height: number
  width: number
  x: number
  y: number
}

const createLinearGradient = (
  id: string,
  colors: string[],
  rotation: number,
  box?: FillBox,
) => {
  const radians = (rotation * Math.PI) / 180
  const x = Math.sin(radians)
  const y = -Math.cos(radians)

  let x1: number
  let y1: number
  let x2: number
  let y2: number

  if (box) {
    // For non-square boxes, the gradient line length has to take the box
    // dimensions into account, otherwise the exported angle would not match
    // the CSS gradient used by the preview.
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    const length = Math.abs(box.width * x) + Math.abs(box.height * y)
    x1 = centerX - (x * length) / 2
    y1 = centerY - (y * length) / 2
    x2 = centerX + (x * length) / 2
    y2 = centerY + (y * length) / 2
  } else {
    // The gradient line is sized so that it covers the whole square box, which
    // is how CSS calculates the endpoints of a linear-gradient.
    const length = Math.abs(x) + Math.abs(y)
    x1 = 0.5 - (x * length) / 2
    y1 = 0.5 - (y * length) / 2
    x2 = 0.5 + (x * length) / 2
    y2 = 0.5 + (y * length) / 2
  }

  return `<linearGradient id="${id}" x1="${formatNumber(x1)}" x2="${formatNumber(x2)}" y1="${formatNumber(y1)}" y2="${formatNumber(y2)}"${box ? ' gradientUnits="userSpaceOnUse"' : ''}>${createGradientStops(colors)}</linearGradient>`
}

const createRadialGradient = (id: string, colors: string[], box?: FillBox) => {
  if (!box) {
    return `<radialGradient cx="0.5" cy="0.5" id="${id}" r="0.7071">${createGradientStops(colors)}</radialGradient>`
  }

  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  return `<radialGradient cx="${formatNumber(centerX)}" cy="${formatNumber(centerY)}" gradientTransform="translate(${formatNumber(centerX)} ${formatNumber(centerY)}) scale(${formatNumber(box.width)} ${formatNumber(box.height)}) translate(${formatNumber(-centerX)} ${formatNumber(-centerY)})" gradientUnits="userSpaceOnUse" id="${id}" r="0.7071">${createGradientStops(colors)}</radialGradient>`
}

const createVectorGradient = (
  id: string,
  colors: string[],
  gradient: Gradient,
  rotation: number,
  box?: FillBox,
): { defs: string; fill: string } => ({
  fill: `url(#${id})`,
  defs:
    gradient === Gradient.Radial
      ? createRadialGradient(id, colors, box)
      : createLinearGradient(id, colors, rotation, box),
})

const createConicGradientImage = (
  colors: string[],
  rotation: number,
  centerX: number,
  centerY: number,
): null | string => {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = CONIC_GRADIENT_SIZE
  canvas.height = CONIC_GRADIENT_SIZE

  const context = canvas.getContext('2d')
  if (!context || typeof context.createConicGradient !== 'function') {
    return null
  }

  const scale = CONIC_GRADIENT_SIZE / VIEW_BOX_SIZE
  // CSS conic gradients start at 12 o'clock, while the canvas API starts at
  // 3 o'clock, so the angle needs a -90deg adjustment.
  const gradient = context.createConicGradient(
    ((rotation - 90) * Math.PI) / 180,
    centerX * scale,
    centerY * scale,
  )

  colors.forEach((color, index) => {
    const offset = colors.length === 1 ? 0 : index / (colors.length - 1)
    gradient.addColorStop(offset, color)
  })

  context.fillStyle = gradient
  context.fillRect(0, 0, CONIC_GRADIENT_SIZE, CONIC_GRADIENT_SIZE)

  // WebP keeps smooth gradients very small. Browsers that cannot encode WebP
  // silently fall back to PNG, which we detect here.
  const webp = canvas.toDataURL('image/webp', 0.95)
  return webp.startsWith('data:image/webp')
    ? webp
    : canvas.toDataURL('image/png')
}

const createFill = async (
  id: string,
  colors: Color[],
  gradient: Gradient,
  rotation: number,
  clipMarkup: string,
  box?: FillBox,
): Promise<FillResult> => {
  if (colors.length <= 1) {
    return {
      defs: '',
      fill: escapeXml(colors[0]?.value ?? 'transparent'),
      overlay: '',
    }
  }

  const values = getColorValues(colors)

  if (gradient !== Gradient.Conic) {
    return {
      ...createVectorGradient(id, values, gradient, rotation, box),
      overlay: '',
    }
  }

  const centerX = box ? box.x + box.width / 2 : VIEW_BOX_SIZE / 2
  const centerY = box ? box.y + box.height / 2 : VIEW_BOX_SIZE / 2
  const image = createConicGradientImage(values, rotation, centerX, centerY)

  // Conic gradients are not part of SVG. Rasterize the gradient and clip it to
  // the shape instead, while still keeping the rest of the icon as vectors.
  if (!image) {
    return {
      ...createVectorGradient(id, values, Gradient.Linear, rotation, box),
      overlay: '',
    }
  }

  const clipId = `${id}-clip`
  return {
    defs: `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${clipMarkup}</clipPath>`,
    fill: escapeXml(values[0]),
    overlay: `<image clip-path="url(#${clipId})" height="${VIEW_BOX_SIZE}" href="${image}" preserveAspectRatio="none" width="${VIEW_BOX_SIZE}" x="0" y="0"/>`,
  }
}

const normalizeRadii = (
  radii: BorderRadius,
  width: number,
  height: number,
): BorderRadius => {
  let [topLeft, topRight, bottomRight, bottomLeft] = radii.map((radius) =>
    Math.max(0, radius),
  ) as BorderRadius

  const factor = Math.min(
    width / (topLeft + topRight) || Number.POSITIVE_INFINITY,
    width / (bottomRight + bottomLeft) || Number.POSITIVE_INFINITY,
    height / (topLeft + bottomLeft) || Number.POSITIVE_INFINITY,
    height / (topRight + bottomRight) || Number.POSITIVE_INFINITY,
    1,
  )

  if (factor < 1) {
    topLeft *= factor
    topRight *= factor
    bottomRight *= factor
    bottomLeft *= factor
  }

  return [topLeft, topRight, bottomRight, bottomLeft]
}

const roundedRectPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radii: BorderRadius,
) => {
  if (width <= 0 || height <= 0) return ''

  const [topLeft, topRight, bottomRight, bottomLeft] = normalizeRadii(
    radii,
    width,
    height,
  )

  const arc = (radius: number, endX: number, endY: number) =>
    radius > 0
      ? `A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1 ${formatNumber(endX)} ${formatNumber(endY)}`
      : `L ${formatNumber(endX)} ${formatNumber(endY)}`

  return [
    `M ${formatNumber(x + topLeft)} ${formatNumber(y)}`,
    `L ${formatNumber(x + width - topRight)} ${formatNumber(y)}`,
    arc(topRight, x + width, y + topRight),
    `L ${formatNumber(x + width)} ${formatNumber(y + height - bottomRight)}`,
    arc(bottomRight, x + width - bottomRight, y + height),
    `L ${formatNumber(x + bottomLeft)} ${formatNumber(y + height)}`,
    arc(bottomLeft, x, y + height - bottomLeft),
    `L ${formatNumber(x)} ${formatNumber(y + topLeft)}`,
    arc(topLeft, x + topLeft, y),
    'Z',
  ].join(' ')
}

const createDropShadowFilter = (id: string, shadows: Shadow[]) => {
  if (shadows.length === 0) return ''

  const primitives = shadows.map((shadow, index) => {
    const [x, y, blur, , color] = shadow
    return `<feDropShadow dx="${formatNumber(x)}" dy="${formatNumber(y)}" flood-color="${escapeXml(color.value)}" in="${index === 0 ? 'SourceGraphic' : `${id}-${index - 1}`}" result="${id}-${index}" stdDeviation="${formatNumber(blur / 2)}"/>`
  })

  return `<filter color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse" height="${VIEW_BOX_SIZE}" id="${id}" width="${VIEW_BOX_SIZE}" x="0" y="0">${primitives.join('')}</filter>`
}

const createTextShadowFilter = (id: string, shadows: Shadow[]) => {
  if (shadows.length === 0) return ''

  const primitives = shadows.map((shadow, index) => {
    const [x, y, blur, , color] = shadow
    return `<feDropShadow dx="${formatNumber(x)}" dy="${formatNumber(y)}" flood-color="${escapeXml(color.value)}" in="SourceGraphic" result="${id}-${index}" stdDeviation="${formatNumber(blur / 2)}"/>`
  })

  // CSS text-shadow stacks shadows independently, with the first one on top.
  const merge = shadows
    .map((_, index) => `<feMergeNode in="${id}-${index}"/>`)
    .reverse()
    .join('')

  return `<filter color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse" height="${VIEW_BOX_SIZE}" id="${id}" width="${VIEW_BOX_SIZE}" x="0" y="0">${primitives.join('')}<feMerge>${merge}<feMergeNode in="SourceGraphic"/></feMerge></filter>`
}

const createBoxShadowFilter = (id: string, shadows: Shadow[]) => {
  if (shadows.length === 0) return ''

  const primitives: string[] = []
  const results: string[] = []

  shadows.forEach((shadow, index) => {
    const [x, y, blur, spread, color] = shadow
    let input = 'SourceAlpha'

    if (spread !== 0) {
      const result = `${id}-${index}-spread`
      primitives.push(
        `<feMorphology in="${input}" operator="${spread > 0 ? 'dilate' : 'erode'}" radius="${formatNumber(Math.abs(spread))}" result="${result}"/>`,
      )
      input = result
    }

    if (blur > 0) {
      const result = `${id}-${index}-blur`
      primitives.push(
        `<feGaussianBlur in="${input}" result="${result}" stdDeviation="${formatNumber(blur / 2)}"/>`,
      )
      input = result
    }

    if (x !== 0 || y !== 0) {
      const result = `${id}-${index}-offset`
      primitives.push(
        `<feOffset dx="${formatNumber(x)}" dy="${formatNumber(y)}" in="${input}" result="${result}"/>`,
      )
      input = result
    }

    const colorResult = `${id}-${index}-color`
    primitives.push(
      `<feFlood flood-color="${escapeXml(color.value)}" result="${colorResult}"/>`,
    )

    const shadowResult = `${id}-${index}-shadow`
    primitives.push(
      `<feComposite in="${colorResult}" in2="${input}" operator="in" result="${shadowResult}"/>`,
    )
    results.push(shadowResult)
  })

  const merge = [...results]
    .reverse()
    .map((result) => `<feMergeNode in="${result}"/>`)
    .join('')

  return `<filter color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse" height="${VIEW_BOX_SIZE}" id="${id}" width="${VIEW_BOX_SIZE}" x="0" y="0"><feMerge>${merge}<feMergeNode in="SourceGraphic"/></feMerge></filter>`
}

const createBlurFilter = (id: string, blur: number) =>
  `<filter color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse" height="${VIEW_BOX_SIZE}" id="${id}" width="${VIEW_BOX_SIZE}" x="0" y="0"><feGaussianBlur stdDeviation="${formatNumber(blur / 2)}"/></filter>`

const getContentTransform = (
  perspective: [boolean, number, number],
  rotation: number,
  offset: [number, number],
  centerX: number,
  centerY: number,
) => {
  const [enabled, rotateX, rotateY] = perspective

  if (!enabled) {
    return `transform="rotate(${formatNumber(rotation)} ${formatNumber(centerX)} ${formatNumber(centerY)}) translate(${formatNumber(offset[0])} ${formatNumber(offset[1])})"`
  }

  // SVG has no native 3D transform, but CSS transforms are supported on SVG
  // elements by browsers. Keep the same values as the live preview.
  return `style="perspective: 500px; transform: rotateX(${formatNumber(rotateX)}deg) rotateY(${formatNumber(rotateY)}deg) rotate(${formatNumber(rotation)}deg) translate(${formatNumber(offset[0])}px, ${formatNumber(offset[1])}px); transform-box: view-box; transform-origin: ${formatNumber(centerX)}px ${formatNumber(centerY)}px; transform-style: preserve-3d;"`
}

const TEXT_LINE_HEIGHT = 1.5

interface TextMeasurement {
  baselineOffset: number
  gradientBox?: { height: number; width: number }
}

const getTextMeasurement = (
  styles: Styles,
  fontSize: number,
): TextMeasurement => {
  const fallback = { baselineOffset: fontSize * 0.35 }
  if (typeof document === 'undefined') return fallback

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return fallback

  context.font = `${styles.textItalic ? 'italic ' : ''}${styles.textWeight} ${formatNumber(fontSize)}px ${styles.textFont}`

  const metrics = context.measureText(styles.textValue)
  const ascent = metrics.fontBoundingBoxAscent
  const descent = metrics.fontBoundingBoxDescent
  const width = metrics.width

  const gradientBox =
    Number.isFinite(width) && width > 0
      ? { height: fontSize * TEXT_LINE_HEIGHT, width }
      : undefined

  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) {
    return { ...fallback, gradientBox }
  }

  return { baselineOffset: (ascent - descent) / 2, gradientBox }
}

const sanitizeSvgElement = (element: Element) => {
  const blockedTags = new Set([
    'embed',
    'foreignobject',
    'iframe',
    'object',
    'script',
  ])

  for (const child of Array.from(element.children)) {
    if (blockedTags.has(child.tagName.toLowerCase())) {
      child.remove()
      continue
    }
    sanitizeSvgElement(child)
  }

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase()
    if (name.startsWith('on') || /^\s*javascript:/i.test(attribute.value)) {
      element.removeAttribute(attribute.name)
    }
  }
}

const createUploadedSvgMarkup = (
  content: string,
  size: number,
  centerX: number,
  centerY: number,
) => {
  if (typeof DOMParser === 'undefined') return ''

  const documentNode = new DOMParser().parseFromString(content, 'image/svg+xml')

  if (documentNode.querySelector('parsererror')) return ''

  const svg = documentNode.documentElement
  if (svg.tagName.toLowerCase() !== 'svg') return ''

  sanitizeSvgElement(svg)

  if (!svg.getAttribute('viewBox')) {
    const width = Number.parseFloat(svg.getAttribute('width') ?? '')
    const height = Number.parseFloat(svg.getAttribute('height') ?? '')
    svg.setAttribute(
      'viewBox',
      `0 0 ${formatNumber(
        Number.isFinite(width) && width > 0 ? width : 100,
      )} ${formatNumber(Number.isFinite(height) && height > 0 ? height : 100)}`,
    )
  }

  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.setAttribute('height', formatNumber(size))
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svg.setAttribute('width', formatNumber(size))
  svg.setAttribute('x', formatNumber(centerX - size / 2))
  svg.setAttribute('y', formatNumber(centerY - size / 2))

  return new XMLSerializer().serializeToString(svg)
}

const createUploadMarkup = (
  content: string | undefined,
  size: number,
  centerX: number,
  centerY: number,
) => {
  const trimmedContent = content?.trim()
  if (!trimmedContent) return ''

  if (trimmedContent.startsWith('<')) {
    return createUploadedSvgMarkup(trimmedContent, size, centerX, centerY)
  }

  return `<image height="${formatNumber(size)}" href="${escapeXml(trimmedContent)}" preserveAspectRatio="xMidYMid meet" width="${formatNumber(size)}" x="${formatNumber(centerX - size / 2)}" y="${formatNumber(centerY - size / 2)}"/>`
}

export const createIconSvg = async (
  options: CreateIconSvgOptions,
): Promise<string> => {
  const { iconName, imageSize, previewType, styles, uploadContent } = options

  const uid = `appicon-${Math.random().toString(36).slice(2, 10)}`
  const outputSize =
    Number.isFinite(imageSize) && imageSize > 0
      ? Math.round(imageSize)
      : DEFAULT_IMAGE_SIZE

  const [paddingTop, paddingRight, paddingBottom, paddingLeft] =
    getIconPaddingValues(styles.padding, styles.paddingSize)

  const averagePadding =
    (paddingTop + paddingRight + paddingBottom + paddingLeft) / 4
  const bodyX = paddingLeft
  const bodyY = paddingTop
  const bodyWidth = Math.max(0, VIEW_BOX_SIZE - paddingLeft - paddingRight)
  const bodyHeight = Math.max(0, VIEW_BOX_SIZE - paddingTop - paddingBottom)
  const valueScale = (VIEW_BOX_SIZE - averagePadding) / LIST_ICON_SIZE
  const centerX = bodyX + bodyWidth / 2
  const centerY = bodyY + bodyHeight / 2

  const borderWidth = styles.borderWidth * valueScale
  const innerX = bodyX + borderWidth
  const innerY = bodyY + borderWidth
  const innerWidth = Math.max(0, bodyWidth - borderWidth * 2)
  const innerHeight = Math.max(0, bodyHeight - borderWidth * 2)

  const outerRadii = styles.borderRadius.map(
    (radius) => radius * valueScale,
  ) as BorderRadius
  const innerRadii = styles.borderRadius.map((radius) =>
    Math.max(0, (radius - styles.borderWidth) * valueScale),
  ) as BorderRadius

  const outerPath = roundedRectPath(
    bodyX,
    bodyY,
    bodyWidth,
    bodyHeight,
    outerRadii,
  )
  const innerPath = roundedRectPath(
    innerX,
    innerY,
    innerWidth,
    innerHeight,
    innerRadii,
  )

  const defs: string[] = []
  const body: string[] = []

  const borderFill = await createFill(
    `${uid}-border`,
    styles.borderColors,
    styles.borderGradient,
    styles.borderRotation,
    `<path d="${outerPath}"/>`,
    { height: bodyHeight, width: bodyWidth, x: bodyX, y: bodyY },
  )
  const backgroundFill = await createFill(
    `${uid}-background`,
    styles.backgroundColors,
    styles.backgroundGradient,
    styles.backgroundRotation,
    `<path d="${innerPath}"/>`,
    { height: innerHeight, width: innerWidth, x: innerX, y: innerY },
  )

  defs.push(borderFill.defs, backgroundFill.defs)

  const outerShadowFilter = createBoxShadowFilter(
    `${uid}-outer-shadow`,
    styles.shadows.map((shadow) => scaleShadow(shadow, valueScale)),
  )
  if (outerShadowFilter) defs.push(outerShadowFilter)

  body.push(
    `<path d="${outerPath}" fill="${borderFill.fill}"${outerShadowFilter ? ` filter="url(#${uid}-outer-shadow)"` : ''}/>`,
    borderFill.overlay,
    `<path d="${innerPath}" fill="${backgroundFill.fill}"/>`,
    backgroundFill.overlay,
  )

  const backgroundClipId = `${uid}-background-clip`
  defs.push(
    `<clipPath id="${backgroundClipId}" clipPathUnits="userSpaceOnUse"><path d="${innerPath}"/></clipPath>`,
  )

  // Later shadows are painted first so that the first configured shadow ends
  // up on top, matching the CSS box-shadow stacking order.
  const insetShadows = [...styles.insetShadows].reverse()

  insetShadows.forEach((shadow, index) => {
    const [x, y, blur, spread, color] = scaleShadow(shadow, valueScale)
    const holeX = innerX + x + spread
    const holeY = innerY + y + spread
    const holeWidth = Math.max(0, innerWidth - spread * 2)
    const holeHeight = Math.max(0, innerHeight - spread * 2)
    const holeRadii = innerRadii.map((radius) =>
      Math.max(0, radius - spread),
    ) as BorderRadius
    const holePath = roundedRectPath(
      holeX,
      holeY,
      holeWidth,
      holeHeight,
      holeRadii,
    )
    const shadowPath = `M ${-VIEW_BOX_SIZE} ${-VIEW_BOX_SIZE} H ${VIEW_BOX_SIZE * 2} V ${VIEW_BOX_SIZE * 2} H ${-VIEW_BOX_SIZE} Z ${holePath}`
    const filterId = `${uid}-inset-shadow-${index}`

    if (blur > 0) defs.push(createBlurFilter(filterId, blur))

    body.push(
      `<g clip-path="url(#${backgroundClipId})"><path d="${shadowPath}" fill="${escapeXml(color.value)}" fill-rule="evenodd"${blur > 0 ? ` filter="url(#${filterId})"` : ''}/></g>`,
    )
  })

  const iconSize = styles.iconSize * valueScale

  if (previewType === 'icon') {
    if (!iconName) throw new Error('Missing icon name')

    const icon = await loadIcon(iconName)
    const builtIcon = buildIcon(icon)
    const iconBody = replaceIDs(builtIcon.body, `${uid}-icon-`)
    const iconFilter = createDropShadowFilter(
      `${uid}-icon-shadow`,
      styles.iconShadow.map((shadow) => scaleShadow(shadow, valueScale)),
    )

    if (iconFilter) defs.push(iconFilter)

    const iconMarkup = `<svg height="${formatNumber(iconSize)}" preserveAspectRatio="xMidYMid meet" style="color: ${escapeXml(styles.iconColor)}" viewBox="${escapeXml(builtIcon.attributes.viewBox)}" width="${formatNumber(iconSize)}" x="${formatNumber(centerX - iconSize / 2)}" y="${formatNumber(centerY - iconSize / 2)}">${iconBody}</svg>`

    body.push(
      `<g ${getContentTransform(styles.iconPerspective, styles.iconRotation, styles.iconOffset.map((value) => value * valueScale) as [number, number], centerX, centerY)}><g${iconFilter ? ` filter="url(#${uid}-icon-shadow)"` : ''}>${iconMarkup}</g></g>`,
    )
  } else if (previewType === 'upload') {
    const uploadMarkup = createUploadMarkup(
      uploadContent,
      iconSize,
      centerX,
      centerY,
    )
    const uploadFilter = createDropShadowFilter(
      `${uid}-icon-shadow`,
      styles.iconShadow.map((shadow) => scaleShadow(shadow, valueScale)),
    )

    if (uploadFilter) defs.push(uploadFilter)

    if (uploadMarkup) {
      body.push(
        `<g ${getContentTransform(styles.iconPerspective, styles.iconRotation, styles.iconOffset.map((value) => value * valueScale) as [number, number], centerX, centerY)}><g${uploadFilter ? ` filter="url(#${uid}-icon-shadow)"` : ''}>${uploadMarkup}</g></g>`,
      )
    }
  } else {
    const text = styles.textValue
    if (text) {
      const fontSize = styles.textSize * valueScale
      const { baselineOffset, gradientBox } = getTextMeasurement(
        styles,
        fontSize,
      )
      const textAttributes = `font-family="${escapeXml(styles.textFont)}" font-size="${formatNumber(fontSize)}" font-style="${styles.textItalic ? 'italic' : 'normal'}" font-weight="${escapeXml(styles.textWeight)}" text-anchor="middle" x="${formatNumber(centerX)}" y="${formatNumber(centerY + baselineOffset)}"`
      const strokeAttributes = styles.textStroke
        ? ` paint-order="stroke fill" stroke="${escapeXml(styles.textStrokeColor)}" stroke-width="${formatNumber(styles.textStrokeWidth)}"`
        : ''
      const textFill = await createFill(
        `${uid}-text`,
        styles.textColors,
        styles.textGradient,
        styles.textColorRotation,
        `<text ${textAttributes} fill="#000">${escapeXml(text)}</text>`,
        gradientBox && {
          ...gradientBox,
          x: centerX - gradientBox.width / 2,
          y: centerY - gradientBox.height / 2,
        },
      )

      defs.push(textFill.defs)

      const textShadowFilter = createTextShadowFilter(
        `${uid}-text-shadow`,
        styles.textShadow.map((shadow) => scaleShadow(shadow, valueScale)),
      )
      if (textShadowFilter) defs.push(textShadowFilter)

      const textMarkup = `<text ${textAttributes} fill="${textFill.fill}"${strokeAttributes}>${escapeXml(text)}</text>`

      body.push(
        `<g ${getContentTransform(styles.textPerspective, styles.textRotation, styles.textOffset.map((value) => value * valueScale) as [number, number], centerX, centerY)}><g${textShadowFilter ? ` filter="url(#${uid}-text-shadow)"` : ''}>${textMarkup}</g>${textFill.overlay}</g>`,
      )
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outputSize}" height="${outputSize}" viewBox="0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}">`,
    defs.length !== 0 ? `<defs>${defs.join('')}</defs>` : '',
    body.join(''),
    '</svg>',
  ].join('')
}
