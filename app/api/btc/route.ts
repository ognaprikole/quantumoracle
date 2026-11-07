import { NextResponse } from 'next/server'

let lastKnownPrice = 0

export async function GET() {
  try {
    const response = await fetch(`https://tradeflow-six-puce.vercel.app/?quote=${Date.now()}`, {
      headers: { accept: 'text/html' },
      cache: 'no-store',
    })

    if (response.ok) {
      const html = await response.text()
      const priceMatch = html.match(/<strong>\$([\d,]+(?:\.\d{1,2})?)<\/strong>/)
      const price = Number(priceMatch?.[1]?.replaceAll(',', '') ?? 0)
      if (Number.isFinite(price) && price > 0) lastKnownPrice = price
    }
  } catch {
    // Keep serving the last successful quote during a transient upstream failure.
  }

  if (!lastKnownPrice) {
    return NextResponse.json({ error: 'Unable to fetch BTC price' }, { status: 502 })
  }

  return NextResponse.json({ price: lastKnownPrice, updatedAt: Date.now() })
}
