import config from 'virtual:open-slide/config';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';

export function SidebarFooter() {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 pr-2 pl-4 text-[11px] text-muted-foreground/70 tabular-nums">
      <span className="inline-flex cursor-default items-center gap-1.5">v{config.version}</span>
      <div className="flex shrink-0 items-center">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </div>
  );
}
