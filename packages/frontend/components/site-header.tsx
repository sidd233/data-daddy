"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useWallet } from "@/contexts/WalletContext"
import { Logo } from "@/components/logo"

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const ROLES = [
  { href: "/contribute", label: "Contributor" },
  { href: "/label", label: "Labeller" },
  { href: "/buyer", label: "Buyer" },
]

export function SiteHeader() {
  const { address } = useWallet()
  const pathname = usePathname()

  return (
    <header className="backdrop-blur-sm bg-background/80 sticky top-0 z-50 flex items-center justify-between py-4 border-b mb-6">
      <div className="flex items-center gap-5">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo size={26} />
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-[#00E5A0] to-emerald-400 bg-clip-text text-transparent">
              DataDaddy
            </span>
          </Link>
          {address && (
            <span className="text-xs text-muted-foreground">{shortAddr(address)}</span>
          )}
        </div>

        {/* Role toggle */}
        <nav className="flex items-center rounded-lg border bg-muted/30 p-0.5 gap-0.5">
          {ROLES.map((role) => {
            const isActive = pathname.startsWith(role.href)
            return (
              <Link
                key={role.href}
                href={role.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#00E5A0] text-black"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {role.label}
              </Link>
            )
          })}
        </nav>

        {/* Dashboard link */}
        <Link
          href="/dashboard"
          className={`text-sm transition-colors ${
            pathname === "/dashboard"
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Dashboard
        </Link>

        {/* Secondary */}
        <Link
          href="/verify"
          className={`text-sm transition-colors ${
            pathname === "/verify"
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Verify Identity
        </Link>
      </div>

      <ConnectButton accountStatus="avatar" showBalance={false} />
    </header>
  )
}
