import { useRef } from 'react'

import { Separator } from '@/components/ui/separator'
import { useIconDownload } from '@/lib/use-icon-download'

import { CompareIconButton } from '../compare-icon'
import { DownloadButton } from '../download-button'
import { IconCard } from '../icon-card'
import { PreviewContainer } from '../ui/styled'

export const PreviewText = () => {
  const iconCardRef = useRef<HTMLDivElement>(null)
  const downloadIcon = useIconDownload()

  return (
    <PreviewContainer>
      <Separator />
      <IconCard ref={iconCardRef} inPreview previewType='text' />
      <div className='flex flex-wrap justify-center gap-2'>
        <DownloadButton
          onClick={() => {
            void downloadIcon({
              element: iconCardRef.current,
              fileName: 'text',
              previewType: 'text',
            })
          }}
        />
        <CompareIconButton previewType='text' />
      </div>
    </PreviewContainer>
  )
}
