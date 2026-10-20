import { DownloadIcon, FileCode2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useStore } from '@/store'
import { ImageFormat } from '@/store/constants'

import { Button } from '../ui/button'

interface DownloadButtonProps {
  onClick: () => void
}

export const DownloadButton = (props: DownloadButtonProps) => {
  const { onClick } = props
  const { t } = useTranslation()
  const [{ imageFormat }] = useStore((store) => store.componentsState)
  const isSvg = imageFormat === ImageFormat.Svg

  return (
    <Button
      className='shrink-0'
      size='lg'
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {isSvg ? <FileCode2Icon /> : <DownloadIcon />}
      {isSvg ? t('download svg') : t('download png')}
    </Button>
  )
}
