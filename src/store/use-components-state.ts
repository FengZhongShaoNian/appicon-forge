import { useImmer } from 'use-immer'

import { ImageFormat, Settings, Tab } from './constants'

import type { ComponentsState } from './interface'

export const useComponentsState = () => {
  const [state, setState] = useImmer<ComponentsState>({
    imageFormat: ImageFormat.Png,
    imageSize: 1024,
    isSeparateBorderRadius: false,
    previewIcon: null,
    searchQuery: '',
    selectedCollection: null,
    selectedSettings: Settings.Icon,
    selectedTab: Tab.Icon,
  })
  return [state, setState] as const
}
