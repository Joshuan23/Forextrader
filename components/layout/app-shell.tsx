import { Nav, MobileNav } from './nav'
import { SessionHeader } from './session-header'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <div className="flex min-h-screen flex-1 flex-col md:pl-56">
        <SessionHeader />
        <main className="flex-1 px-3 pb-24 pt-4 sm:px-5 md:pb-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  )
}
