import { useRef, useState } from 'react'

import { IconCard } from '@/components/icon-card'
import { useIconDownload } from '@/lib/use-icon-download'

import { CompareIconButton } from '../compare-icon'
import { DownloadButton } from '../download-button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { PreviewContainer } from '../ui/styled'

export const PreviewUpload = () => {
  const iconCardRef = useRef<HTMLDivElement>(null)
  const downloadIcon = useIconDownload()
  const [uploadedContent, setUploadedContent] = useState<string>('')

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = (e) => {
      const content = e.target?.result as string
      setUploadedContent(content)
    }

    if (file.type === 'image/svg+xml') {
      reader.readAsText(file)
    } else {
      reader.readAsDataURL(file)
    }
  }

  return (
    <PreviewContainer>
      <Separator />
      <IconCard
        ref={iconCardRef}
        inPreview
        previewType='upload'
        uploadNode={
          uploadedContent && (
            <div className='flex size-full items-center justify-center'>
              {uploadedContent.startsWith('data:image') ? (
                <img
                  alt='Uploaded preview'
                  className='size-full object-contain'
                  src={uploadedContent}
                />
              ) : (
                <div
                  dangerouslySetInnerHTML={{ __html: uploadedContent }}
                  className='size-full'
                />
              )}
            </div>
          )
        }
      />
      <Input
        accept='.svg,image/*'
        className='w-[200px] shrink-0'
        type='file'
        onChange={handleFileUpload}
      />
      <div className='flex flex-wrap justify-center gap-2'>
        <DownloadButton
          onClick={() => {
            void downloadIcon({
              element: iconCardRef.current,
              fileName: 'upload',
              previewType: 'upload',
              uploadContent: uploadedContent,
            })
          }}
        />
        <CompareIconButton
          previewType='upload'
          uploadContent={uploadedContent}
        />
      </div>
    </PreviewContainer>
  )
}
