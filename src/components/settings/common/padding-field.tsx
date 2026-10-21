import { Fragment } from 'react'

import { ChevronsDown, ChevronsDownUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { getIconPaddingValues } from '@/lib/utils'
import { useStore } from '@/store'

const paddingSides = [
  ['paddingRight', 1],
  ['paddingBottom', 2],
  ['paddingLeft', 3],
] as const

export const PaddingField = () => {
  const { t } = useTranslation()
  const [styles, setStyles] = useStore((store) => store.styles)
  const [{ isSeparatePadding }, setComponentsState] = useStore(
    (store) => store.componentsState,
  )

  const paddingValues = getIconPaddingValues(styles.padding, styles.paddingSize)
  const allValue = Math.round(
    paddingValues.reduce((total, value) => total + value, 0) /
      paddingValues.length,
  )

  const setAll = (value: number) => {
    setStyles((draft) => {
      draft.paddingSize = [value, value, value, value]
    })
  }

  const setSide = (index: number, value: number) => {
    setStyles((draft) => {
      const values = getIconPaddingValues(draft.padding, draft.paddingSize)
      values[index] = value
      draft.paddingSize = values
    })
  }

  return (
    <Collapsible
      className='col-span-2 grid grid-cols-[auto_1fr_auto] items-center gap-4'
      open={isSeparatePadding}
      onOpenChange={(value) =>
        setComponentsState((draft) => {
          draft.isSeparatePadding = value
        })
      }
    >
      <Label>
        {isSeparatePadding
          ? t('settings.download.paddingTop')
          : t('settings.download.paddingSize')}
      </Label>
      <Slider
        max={128}
        min={0}
        value={[isSeparatePadding ? paddingValues[0] : allValue]}
        onValueChange={([value]) => {
          if (isSeparatePadding) {
            setSide(0, value)
          } else {
            setAll(value)
          }
        }}
      />
      <CollapsibleTrigger asChild>
        <Button size='icon' variant='outline'>
          {isSeparatePadding ? <ChevronsDownUp /> : <ChevronsDown />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className='col-span-3 grid grid-cols-subgrid gap-y-4 overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down'>
        {paddingSides.map(([key, index]) => (
          <Fragment key={key}>
            <Label>{t(`settings.download.${key}`)}</Label>
            <Slider
              max={128}
              min={0}
              value={[paddingValues[index]]}
              onValueChange={([value]) => {
                setSide(index, value)
              }}
            />
            <span />
          </Fragment>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
