"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useWallet } from "@/contexts/WalletContext"

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function SiteHeader() {
  const { address } = useWallet()
  const pathname = usePathname()

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={
        pathname === href
          ? "text-sm font-medium text-foreground"
          : "text-sm text-muted-foreground hover:text-foreground transition-colors"
      }
    >
      {label}
    </Link>
  )

  return (
    <header className="flex items-center justify-between py-4 border-b mb-6">
      <div className="flex items-center gap-6">
        <div>
          <span className="text-lg font-bold tracking-tight">Meridian</span>
          {address && (
            <span className="ml-2 text-xs text-muted-foreground">{shortAddr(address)}</span>
          )}
        </div>
        <nav className="flex gap-4">
          {navLink("/", "Dashboard")}
          {navLink("/leases", "My Leases")}
          {navLink("/verify", "Verify Identity")}
          {navLink("/buyer", "Buyer")}
        </nav>
      </div>
      <ConnectButton accountStatus="avatar" showBalance={false} />
    </header>
  )
}
