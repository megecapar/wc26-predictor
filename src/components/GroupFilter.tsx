'use client'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface GroupFilterProps {
  value: string
  onChange: (v: string) => void
  groups: string[]
}

export function GroupFilter({ value, onChange, groups }: GroupFilterProps) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="gap-1 flex-wrap h-auto py-1">
        <TabsTrigger value="all" className="text-xs font-mono px-3">
          Tümü
        </TabsTrigger>
        {groups.map(g => (
          <TabsTrigger key={g} value={g} className="text-xs font-mono px-3">
            {g}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
