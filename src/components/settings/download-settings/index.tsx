import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsContainer } from '@/components/ui/styled'
import { useStore } from '@/store'
import { ImageFormat } from '@/store/constants'

export const DownloadSettings = () => {
  const [{ imageFormat, imageSize }, setComponentsState] = useStore(
    (store) => store.componentsState,
  )
  const [{ padding }, setStyles] = useStore((store) => store.styles)

  const { t } = useTranslation()

  const cls = 'col-span-2 grid grid-cols-subgrid items-center'

  return (
    <SettingsContainer>
      <div className={cls}>
        <Label htmlFor='imageFormat'>{t('settings.download.format')}</Label>
        <Select
          value={imageFormat}
          onValueChange={(value) =>
            setComponentsState((draft) => {
              draft.imageFormat = value as ImageFormat
            })
          }
        >
          <SelectTrigger className='max-w-[180px]' id='imageFormat'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ImageFormat.Png}>
              {t('settings.download.png')}
            </SelectItem>
            <SelectItem value={ImageFormat.Svg}>
              {t('settings.download.svg')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className={cls}>
        <Label htmlFor='imageSize'>{t('settings.download.size')}</Label>
        <Input
          className='max-w-[180px]'
          id='imageSize'
          type='number'
          value={imageSize}
          onChange={(e) =>
            setComponentsState((draft) => {
              draft.imageSize = +e.target.value
            })
          }
        />
      </div>
      <div className={cls}>
        <Label htmlFor='includePadding'>{t('settings.download.padding')}</Label>
        <Checkbox
          checked={padding}
          id='includePadding'
          onCheckedChange={(value) =>
            setStyles((draft) => {
              draft.padding = value as boolean
            })
          }
        />
      </div>
    </SettingsContainer>
  )
}
