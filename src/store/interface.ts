import type { APIv2Collection } from '@/services/iconify'

import type { Gradient, ImageFormat, Settings, Tab } from './constants'

export interface Color {
  id: string
  value: string
}
export type Point = [number, number]
export type Shadow = [
  x: number,
  y: number,
  blur: number,
  spread: number,
  color: Color,
]
export type BorderRadius = [number, number, number, number]
export type Perspective = [boolean, number, number]

export interface Styles {
  // Background
  backgroundColors: Color[]
  backgroundGradient: Gradient
  backgroundRotation: number
  // Border
  borderColors: Color[]
  borderGradient: Gradient
  borderRadius: BorderRadius
  borderRotation: number
  borderWidth: number
  // Icon
  iconColor: string
  iconOffset: Point
  iconPerspective: Perspective
  // Rotation Z
  iconRotation: number
  iconShadow: Shadow[]
  iconSize: number
  // Inset Shadow
  insetShadows: Shadow[]
  // Padding -> only works in preview
  padding: boolean
  // Shadow
  shadows: Shadow[]
  // Text
  textColorRotation: number
  textColors: Color[]
  textFont: string
  textGradient: Gradient
  textItalic: boolean
  textOffset: Point
  textPerspective: Perspective
  textRotation: number
  textShadow: Shadow[]
  textSize: number
  textStroke: boolean
  textStrokeColor: string
  textStrokeWidth: number
  textValue: string
  textWeight: string
}

export interface IconCollectionWithPrefix extends APIv2Collection {
  prefix: string
}

export interface PreviewIcon {
  collection: IconCollectionWithPrefix
  iconName: string
  name: string
}

export interface ComponentsState {
  imageFormat: ImageFormat
  // Image Size -> only works in preview
  imageSize: number
  isSeparateBorderRadius: boolean
  previewIcon: null | PreviewIcon
  searchQuery: string
  selectedCollection: IconCollectionWithPrefix | null
  selectedSettings: Settings
  selectedTab: Tab
}
