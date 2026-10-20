import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { createIconSvg, type IconPreviewType } from '@/lib/export-svg'
import { downloadImage, downloadSvg } from '@/lib/utils'
import { useStore } from '@/store'
import { ImageFormat } from '@/store/constants'

export interface DownloadIconOptions {
  element?: HTMLElement | null
  fileName: string
  iconName?: string
  previewType: IconPreviewType
  uploadContent?: string
}

export const useIconDownload = () => {
  const { t } = useTranslation()
  const [styles] = useStore((store) => store.styles)
  const [{ imageFormat, imageSize }] = useStore(
    (store) => store.componentsState,
  )

  return async (options: DownloadIconOptions) => {
    const { element, fileName, iconName, previewType, uploadContent } = options

    try {
      if (imageFormat === ImageFormat.Svg) {
        const svg = await createIconSvg({
          iconName,
          imageSize,
          previewType,
          styles,
          uploadContent,
        })
        downloadSvg(svg, `${fileName}.svg`)
        return
      }

      await downloadImage(imageSize, `${fileName}.png`, element)
    } catch (error) {
      console.error(error)
      toast.error(t('download error'))
    }
  }
}
