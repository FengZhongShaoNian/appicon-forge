import { useCallback, useEffect, useRef, useState } from 'react'

import {
  GitCompareArrowsIcon,
  ImageUpIcon,
  Loader2Icon,
  SparklesIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createIconSvg, type IconPreviewType } from '@/lib/export-svg'
import {
  COMPARE_RENDER_SIZE,
  compareSvgIcons,
  type CompareCorner,
  type CompareFit,
  type SvgCompareResult,
} from '@/lib/svg-compare'
import { useStore } from '@/store'

import type { BorderRadius } from '@/store/interface'

export interface CompareIconButtonProps {
  iconName?: string
  previewType: IconPreviewType
  uploadContent?: string
}

interface CompareDialogProps extends CompareIconButtonProps {
  onOpenChange: (open: boolean) => void
  open: boolean
}

interface Metric {
  current: null | number
  difference: null | number
  isBad: boolean
  key: string
  label: string
  reference: null | number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const cornerKeys: CompareCorner[] = ['tl', 'tr', 'br', 'bl']

const formatPercent = (value: null | number) =>
  value === null ? '—' : `${(value * 100).toFixed(2)}%`

const CompareDialog = (props: CompareDialogProps) => {
  const { iconName, onOpenChange, open, previewType, uploadContent } = props
  const { t } = useTranslation()
  const [styles, setStyles] = useStore((store) => store.styles)
  const [referenceSvg, setReferenceSvg] = useState('')
  const [fit, setFit] = useState<CompareFit>('meet')
  const [threshold, setThreshold] = useState('1')
  const [result, setResult] = useState<null | SvgCompareResult>(null)
  const [status, setStatus] = useState<'error' | 'idle' | 'loading' | 'ready'>(
    'idle',
  )
  const [error, setError] = useState('')
  const requestId = useRef(0)

  const runComparison = useCallback(async () => {
    const rawReference = referenceSvg.trim()
    if (!rawReference) {
      setResult(null)
      setError('')
      setStatus('idle')
      return
    }

    const currentRequestId = ++requestId.current
    setStatus('loading')
    setError('')

    try {
      const currentSvg = await createIconSvg({
        iconName,
        imageSize: COMPARE_RENDER_SIZE,
        previewType,
        styles,
        uploadContent,
      })
      const nextResult = await compareSvgIcons(rawReference, currentSvg, {
        fit,
        size: COMPARE_RENDER_SIZE,
      })

      if (requestId.current !== currentRequestId) return

      setResult(nextResult)
      setStatus('ready')
    } catch (comparisonError) {
      if (requestId.current !== currentRequestId) return
      console.error(comparisonError)
      setResult(null)
      setError(
        comparisonError instanceof Error
          ? comparisonError.message
          : String(comparisonError),
      )
      setStatus('error')
    }
  }, [fit, iconName, previewType, referenceSvg, styles, uploadContent])

  useEffect(() => {
    if (!open) return

    if (!referenceSvg.trim()) {
      setResult(null)
      setStatus('idle')
      return
    }

    const timer = setTimeout(() => {
      void runComparison()
    }, 450)

    return () => {
      clearTimeout(timer)
    }
  }, [open, referenceSvg, runComparison])

  const readFile = (file?: File) => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setReferenceSvg(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => {
      setError(t('compare.loadError'))
      setStatus('error')
    }
    reader.readAsText(file)
  }

  const thresholdValue = Math.max(0, Number.parseFloat(threshold) || 0) / 100

  const reference = result?.reference
  const current = result?.current
  const empty = !!reference?.empty || !!current?.empty

  const metrics: Metric[] = result
    ? [
        ...(
          [
            [
              'paddingTop',
              result.reference.padding.top,
              result.current.padding.top,
            ],
            [
              'paddingRight',
              result.reference.padding.right,
              result.current.padding.right,
            ],
            [
              'paddingBottom',
              result.reference.padding.bottom,
              result.current.padding.bottom,
            ],
            [
              'paddingLeft',
              result.reference.padding.left,
              result.current.padding.left,
            ],
          ] as const
        ).map(([key, referenceValue, currentValue]) => ({
          key,
          current: currentValue,
          difference: Math.abs(referenceValue - currentValue),
          isBad: false,
          label: t(`compare.${key}`),
          reference: referenceValue,
        })),
        ...(
          [
            ['radiusTopLeft', 'tl'],
            ['radiusTopRight', 'tr'],
            ['radiusBottomRight', 'br'],
            ['radiusBottomLeft', 'bl'],
          ] as const
        ).map(([key, corner]) => {
          const referenceValue =
            result.reference.radii[corner] === null
              ? null
              : result.reference.radii[corner] / result.size
          const currentValue =
            result.current.radii[corner] === null
              ? null
              : result.current.radii[corner] / result.size
          const difference =
            referenceValue === null || currentValue === null
              ? null
              : Math.abs(referenceValue - currentValue)

          return {
            key,
            current: currentValue,
            difference,
            isBad: false,
            label: t(`compare.${key}`),
            reference: referenceValue,
          }
        }),
      ].map((metric) => ({
        ...metric,
        isBad: metric.difference !== null && metric.difference > thresholdValue,
      }))
    : []

  const badMetrics = metrics.filter((metric) => metric.isBad)

  const applyReference = () => {
    if (!result || result.reference.empty) return

    const padding = [
      result.reference.padding.top,
      result.reference.padding.right,
      result.reference.padding.bottom,
      result.reference.padding.left,
    ].map((value) =>
      clamp(Math.round(value * COMPARE_RENDER_SIZE), 0, 128),
    ) as BorderRadius

    const averagePadding =
      padding.reduce((total, value) => total + value, 0) / padding.length
    const valueScale = (COMPARE_RENDER_SIZE - averagePadding) / 256

    const radii = cornerKeys.map((corner, index) => {
      const referenceRadius = result.reference.radii[corner]
      if (referenceRadius === null) return styles.borderRadius[index]
      return clamp(Math.round(referenceRadius / valueScale), 0, 128)
    }) as BorderRadius

    setStyles((draft) => {
      draft.borderRadius = radii
      draft.padding = true
      draft.paddingSize = padding
    })
    toast.success(t('compare.applied'))
  }

  const loadExample = () => {
    setReferenceSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" fill="#5aa9ff"/></svg>',
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='max-h-[92vh] w-[min(1100px,92vw)] max-w-[1100px] overflow-y-auto'
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('compare.title')}</DialogTitle>
          <DialogDescription>{t('compare.description')}</DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 lg:grid-cols-2'>
          <div className='grid gap-2'>
            <div className='flex flex-wrap items-baseline justify-between gap-2'>
              <Label htmlFor='compare-reference'>
                {t('compare.reference')}
              </Label>
              <span className='text-xs text-muted-foreground'>
                {t('compare.referenceHint')}
              </span>
            </div>
            <Textarea
              className='min-h-[220px] font-mono text-xs'
              id='compare-reference'
              placeholder={t('compare.placeholder')}
              spellCheck={false}
              value={referenceSvg}
              onChange={(event) => {
                setReferenceSvg(event.target.value)
              }}
              onDragOver={(event) => {
                event.preventDefault()
              }}
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files.item(0)
                if (
                  file &&
                  (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name))
                ) {
                  readFile(file)
                }
              }}
            />
            <div className='flex flex-wrap items-center gap-2'>
              <Input
                accept='.svg,image/svg+xml'
                className='max-w-[260px]'
                type='file'
                onChange={(event) => {
                  readFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <Button
                size='sm'
                type='button'
                variant='ghost'
                onClick={loadExample}
              >
                <SparklesIcon />
                {t('compare.example')}
              </Button>
            </div>
          </div>

          <div className='grid content-start gap-4'>
            <div className='grid grid-cols-2 gap-3'>
              <div className='grid gap-2'>
                <Label>{t('compare.fit')}</Label>
                <Select
                  value={fit}
                  onValueChange={(value) => {
                    setFit(value as CompareFit)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='meet'>{t('compare.fitMeet')}</SelectItem>
                    <SelectItem value='stretch'>
                      {t('compare.fitStretch')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='compare-threshold'>
                  {t('compare.threshold')}
                </Label>
                <Input
                  id='compare-threshold'
                  min={0}
                  step={0.1}
                  type='number'
                  value={threshold}
                  onChange={(event) => {
                    setThreshold(event.target.value)
                  }}
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <Button
                disabled={!referenceSvg.trim() || status === 'loading'}
                type='button'
                onClick={() => {
                  void runComparison()
                }}
              >
                {status === 'loading' ? (
                  <Loader2Icon className='animate-spin' />
                ) : (
                  <GitCompareArrowsIcon />
                )}
                {t('compare.run')}
              </Button>
              <span className='text-xs text-muted-foreground'>
                {status === 'loading'
                  ? t('compare.loading')
                  : status === 'ready'
                    ? t('compare.ready')
                    : t('compare.waiting')}
              </span>
            </div>

            {status === 'error' && (
              <p className='text-sm text-destructive'>
                {t('compare.failed', { message: error })}
              </p>
            )}
            {!referenceSvg.trim() && (
              <div className='flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
                <ImageUpIcon className='size-8' />
                {t('compare.waiting')}
              </div>
            )}
          </div>
        </div>

        {result && (
          <>
            <div
              className={
                empty
                  ? 'rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'
                  : badMetrics.length === 0
                    ? 'rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400'
                    : 'rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400'
              }
            >
              {empty ? (
                <p>{t('compare.empty')}</p>
              ) : (
                <p>
                  {badMetrics.length === 0
                    ? t('compare.match')
                    : t('compare.mismatch', { count: badMetrics.length })}
                </p>
              )}
              {!empty && (
                <p className='mt-1 opacity-80'>
                  {t('compare.iou')}: {(result.diff.iou * 100).toFixed(1)}% ·{' '}
                  {t('compare.onlyReference')}: {result.diff.onlyReference} ·{' '}
                  {t('compare.onlyCurrent')}: {result.diff.onlyCurrent}
                </p>
              )}
              {(reference?.unreliable.length ?? 0) > 0 && (
                <p className='mt-1 opacity-80'>{t('compare.unreliableNote')}</p>
              )}
            </div>

            <div className='grid gap-4 lg:grid-cols-[1fr_1.1fr]'>
              <div className='rounded-lg border p-4'>
                <h3 className='mb-3 text-sm font-semibold'>
                  {t('compare.metrics')}
                </h3>
                <div className='overflow-x-auto'>
                  <table className='w-full border-collapse text-sm'>
                    <thead>
                      <tr className='border-b text-xs text-muted-foreground'>
                        <th className='p-2 text-left font-medium'>
                          {t('compare.metric')}
                        </th>
                        <th className='p-2 text-right font-medium'>
                          {t('compare.referenceShort')}
                        </th>
                        <th className='p-2 text-right font-medium'>
                          {t('compare.currentShort')}
                        </th>
                        <th className='p-2 text-right font-medium'>
                          {t('compare.diff')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((metric) => (
                        <tr
                          key={metric.key}
                          className='border-b last:border-b-0'
                        >
                          <td className='p-2 text-left'>{metric.label}</td>
                          <td className='p-2 text-right'>
                            {formatPercent(metric.reference)}
                          </td>
                          <td className='p-2 text-right'>
                            {formatPercent(metric.current)}
                          </td>
                          <td
                            className={
                              metric.isBad
                                ? 'p-2 text-right font-semibold text-destructive'
                                : 'p-2 text-right text-muted-foreground'
                            }
                          >
                            {formatPercent(metric.difference)}
                            {metric.isBad ? ' ▲' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className='rounded-lg border p-4'>
                <h3 className='mb-3 text-sm font-semibold'>
                  {t('compare.visual')}
                </h3>
                <div className='grid grid-cols-3 gap-2'>
                  {[
                    ['reference', result.images.reference],
                    ['current', result.images.current],
                    ['diff', result.images.diff],
                  ].map(([key, image]) => (
                    <figure key={key} className='m-0 grid gap-2'>
                      <img
                        alt={key}
                        className='checkerboard aspect-square w-full rounded-md border object-contain'
                        src={image}
                      />
                      <figcaption className='text-center text-xs text-muted-foreground'>
                        {key === 'reference'
                          ? t('compare.referenceShort')
                          : key === 'current'
                            ? t('compare.currentShort')
                            : t('compare.diff')}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <p className='mt-3 text-xs text-muted-foreground'>
                  {t('compare.diffLegend')}
                </p>
              </div>
            </div>

            <div className='flex justify-end'>
              <Button disabled={empty} type='button' onClick={applyReference}>
                <SparklesIcon />
                {t('compare.apply')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export const CompareIconButton = (props: CompareIconButtonProps) => {
  const { iconName, previewType, uploadContent } = props
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        className='shrink-0'
        size='lg'
        type='button'
        variant='outline'
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <GitCompareArrowsIcon />
        {t('compare.button')}
      </Button>
      <CompareDialog
        iconName={iconName}
        open={open}
        previewType={previewType}
        uploadContent={uploadContent}
        onOpenChange={setOpen}
      />
    </>
  )
}
