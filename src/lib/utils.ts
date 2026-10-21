import { clsx, type ClassValue } from 'clsx'
import { toPng } from 'html-to-image'
import { nanoid } from 'nanoid'
import { twMerge } from 'tailwind-merge'

import { PREVIEW_ICON_PADDING, PREVIEW_ICON_SIZE } from '@/constants/icon-size'
import { Gradient } from '@/store/constants'

import type { APIv2CollectionResponse } from '@/services/iconify'
import type {
  BorderRadius,
  Color,
  Perspective,
  Shadow,
} from '@/store/interface'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const changeValueFromArray = <T>(
  value: T[],
  newValue: T,
  index: number,
): T[] => {
  const newValues = [...value]
  newValues[index] = newValue
  return newValues
}

export const removeValueFromArray = <T>(value: T[], index: number): T[] => {
  const newValues = [...value]
  newValues.splice(index, 1)
  return newValues
}

export const getVisibleIconsAsync = async (
  iconifyData: APIv2CollectionResponse,
): Promise<string[]> => {
  const {
    aliases = {},
    categories = {},
    hidden = [],
    uncategorized = [],
  } = iconifyData

  const iconSet = new Set<string>()

  const batchSize = 1000

  const processArrayBatch = async (array: string[]) => {
    for (let i = 0; i < array.length; i += batchSize) {
      const end = Math.min(i + batchSize, array.length)
      for (let j = i; j < end; j++) {
        iconSet.add(array[j])
      }
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  const processCategories = async (categories: Record<string, string[]>) => {
    const categoryValues = Object.values(categories)
    for (let i = 0; i < categoryValues.length; i++) {
      const categoryIcons = categoryValues[i]
      await processArrayBatch(categoryIcons)
    }
  }

  await processArrayBatch(uncategorized)

  await processCategories(categories)

  await processArrayBatch(
    hidden.map((icon) => {
      iconSet.delete(icon)
      return icon
    }),
  )

  await processArrayBatch(
    Object.keys(aliases).map((alias) => {
      iconSet.delete(alias)
      return alias
    }),
  )

  return Array.from(iconSet)
}

export const colorToGradient = (
  value: string[],
  direction: number,
  type: Gradient,
) => {
  const normalizedValue = value.length === 1 ? [value[0], value[0]] : value
  const valueString = normalizedValue.join(', ')
  if (type === Gradient.Linear) {
    return `linear-gradient(${direction}deg, ${valueString})`
  }
  if (type === Gradient.Radial) {
    return `radial-gradient(${valueString})`
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (type === Gradient.Conic) {
    return `conic-gradient(from ${direction}deg, ${valueString})`
  }
  return ''
}

export const getShadowCSS = (insetShadow: Shadow[], inset?: boolean) => {
  return insetShadow
    .map(
      ([x, y, blur, spread, color]) =>
        `${x}px ${y}px ${blur}px ${spread}px ${color.value} ${inset ? 'inset' : ''}`,
    )
    .join(', ')
}

export const getDropShadowCSS = (shadow: Shadow[]) => {
  const omitSizeShadow = shadow.map(
    ([x, y, blur, , color]) => [x, y, blur, color] as const,
  )
  return omitSizeShadow
    .map(
      ([x, y, blur, color]) =>
        `drop-shadow(${x}px ${y}px ${blur}px ${color.value})`,
    )
    .join(' ')
}

export const getTextShadowCSS = (shadow: Shadow[]) => {
  const omitSizeShadow = shadow.map(
    ([x, y, blur, , color]) => [x, y, blur, color] as const,
  )
  return omitSizeShadow
    .map(([x, y, blur, color]) => `${x}px ${y}px ${blur}px ${color.value}`)
    .join(', ')
}

export const getBorderRadiusCSS = (
  radius: [number, number, number, number],
) => {
  return `${radius[0]}px ${radius[1]}px ${radius[2]}px ${radius[3]}px`
}

export const appendPerspectiveStyle = (
  style: React.CSSProperties,
  perspective: Perspective,
  perspectiveValue = 500,
): void => {
  const [enabled, x, y] = perspective
  if (enabled) {
    style.perspective = perspectiveValue
    style.transformStyle = 'preserve-3d'
    style.transform = `${style.transform} rotateX(${x}deg) rotateY(${y}deg)`
  }
}

export const scaleValue = (value: number, scale: number) => value * scale

export const getIconPaddingValues = (
  padding: boolean,
  paddingSize?: BorderRadius | null | number,
): BorderRadius => {
  if (!padding) return [0, 0, 0, 0]

  const values: number[] = Array.isArray(paddingSize)
    ? paddingSize
    : typeof paddingSize === 'number' && Number.isFinite(paddingSize)
      ? [paddingSize, paddingSize, paddingSize, paddingSize]
      : [
          PREVIEW_ICON_PADDING,
          PREVIEW_ICON_PADDING,
          PREVIEW_ICON_PADDING,
          PREVIEW_ICON_PADDING,
        ]

  // Leave at least two pixels for the icon body.
  const max = PREVIEW_ICON_SIZE / 2 - 1

  return [0, 1, 2, 3].map((index) => {
    const value = values[index]
    return Math.min(
      Math.max(
        0,
        typeof value === 'number' && Number.isFinite(value)
          ? value
          : PREVIEW_ICON_PADDING,
      ),
      max,
    )
  }) as BorderRadius
}

export const scaleShadow = (shadow: Shadow, scale: number) => {
  const [x, y, blur, spread, color] = shadow
  return [
    scaleValue(x, scale),
    scaleValue(y, scale),
    scaleValue(blur, scale),
    scaleValue(spread, scale),
    color,
  ] satisfies Shadow
}

export const downloadImage = async (
  imageSize: number,
  fileName: string,
  element?: HTMLElement | null,
) => {
  if (!element) return

  const dataUrl = await toPng(element, {
    canvasHeight: imageSize,
    canvasWidth: imageSize,
    pixelRatio: 1,
  })

  const a = document.createElement('a')
  a.href = dataUrl
  a.download = fileName
  a.click()
}

export const downloadSvg = (svg: string, fileName: string) => {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()

  // Keep the URL alive long enough for the browser to start the download.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

export const detectFontAvailability = (font: string) => {
  const span = document.createElement('span')
  span.style.position = 'absolute'
  span.style.left = '-9999px'
  span.style.fontSize = '72px'
  span.innerHTML = 'abcdefghijklmnopqrstuvwxyz0123456789'

  const baseFonts = ['sans-serif', 'serif']

  const getDimensions = (fontFamily: string) => {
    span.style.fontFamily = fontFamily
    document.body.appendChild(span)
    const dimensions = { height: span.offsetHeight, width: span.offsetWidth }
    document.body.removeChild(span)
    return dimensions
  }

  const baseDimensions = baseFonts.map(getDimensions)

  for (const base of baseFonts) {
    span.style.fontFamily = `${font}, ${base}`
    const newDimensions = getDimensions(`${font}, ${base}`)
    if (
      newDimensions.width !== baseDimensions[baseFonts.indexOf(base)].width ||
      newDimensions.height !== baseDimensions[baseFonts.indexOf(base)].height
    ) {
      return true
    }
  }
  return false
}

export const createColor = (color: string): Color => {
  return {
    id: nanoid(),
    value: color,
  }
}

export const createShadow = (color: string): Shadow => {
  return [0, 0, 0, 0, createColor(color)]
}
