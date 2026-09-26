import { ChartNoAxesColumnIncreasing, House } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { CalendarGridIcon } from './AppIcons'

export type NavigationTab = 'ホーム' | 'カレンダー' | 'グラフ'

const navigationItems: Array<{ name: NavigationTab; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { name: 'ホーム', icon: House },
  { name: 'カレンダー', icon: CalendarGridIcon },
  { name: 'グラフ', icon: ChartNoAxesColumnIncreasing },
]

export function BottomNavigation({ activeTab, onNavigate }: {
  activeTab: NavigationTab
  onNavigate: (tab: NavigationTab) => void
}) {
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      {navigationItems.map(({ name, icon: Icon }) => (
        <button key={name} type="button" aria-current={name === activeTab ? 'page' : undefined} onClick={() => onNavigate(name)}>
          <span className="nav-icon"><Icon width={23} height={23} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>{name}</span>
        </button>
      ))}
    </nav>
  )
}
