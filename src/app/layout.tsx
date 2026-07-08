import type { Metadata } from "next"
import { Inter, Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta" })

export const metadata: Metadata = {
  title: "Seth's Cooking Assistant",
  description: "Drop in what's in your kitchen — get a great recipe tailored to what you have.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jakarta.variable} ${inter.className}`}>{children}</body>
    </html>
  )
}
