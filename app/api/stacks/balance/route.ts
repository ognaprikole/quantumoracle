import { NextResponse } from 'next/server'

const stacksApiUrl = 'https://api.testnet.hiro.so/extended/v1/address'

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get('address')?.trim() ?? ''

  if (!/^S[A-Z0-9]{38,41}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid Stacks testnet address.' }, { status: 400 })
  }

  const response = await fetch(`${stacksApiUrl}/${encodeURIComponent(address)}/balances`, {
    headers: {
      accept: 'application/json',
      ...(process.env.HIRO_API_KEY ? { 'x-api-key': process.env.HIRO_API_KEY } : {}),
    },
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json({ error: data?.error ?? data?.message ?? 'Unable to load wallet balance.' }, { status: response.status })
  }

  const microStx = Number(data?.stx?.balance ?? 0)
  return NextResponse.json({ balance: Number.isFinite(microStx) ? microStx / 1_000_000 : 0 })
}
