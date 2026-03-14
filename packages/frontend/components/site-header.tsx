"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useWallet } from "@/contexts/WalletContext"

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
    <header className="flex items-center justify-between py-4 border-b mb-6">
      <div className="flex items-center gap-5">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link href="/" className="text-lg font-bold tracking-tight hover:opacity-80 transition-opacity">
            DataDaddy
          </Link>
          {address && (
            <span className="text-xs text-muted-foreground">{shortAddr(address)}</span>
          )}
        </div>

        {/* Role toggle */}
        <nav className="flex items-center rounded-lg border p-0.5 gap-0.5">
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
