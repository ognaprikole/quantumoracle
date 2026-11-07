import { NextResponse } from 'next/server'

const faucetUrl = 'https://api.testnet.hiro.so/extended/v1/faucets/stx'

export async function POST(request: Request) {
  const apiKey = process.env.HIRO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Faucet API is not configured.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const address = typeof body?.address === 'string' ? body.address.trim() : ''

  if (!address || !/^S[A-Z0-9]{38,41}$/.test(address)) {
    return NextResponse.json({ error: 'Enter a valid Stacks testnet address.' }, { status: 400 })
  }

  const response = await fetch(`${faucetUrl}?address=${encodeURIComponent(address)}&stacking=false`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, accept: 'application/json' },
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json({ error: data?.error ?? data?.message ?? 'The faucet request failed.' }, { status: response.status })
  }

  return NextResponse.json({ txId: data.txId ?? data.tx_id ?? null, address })
}
