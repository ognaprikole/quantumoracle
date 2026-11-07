import { NextResponse } from 'next/server'
import { getEpoch } from '@/lib/nash'

export async function GET() {
  try {
    const response = await fetch('https://api.testnet.hiro.so/extended/v2/info', {
      headers: { accept: 'application/json', ...(process.env.HIRO_API_KEY ? { 'x-api-key': process.env.HIRO_API_KEY } : {}) },
      cache: 'no-store',
    })
    if (!response.ok) return NextResponse.json({ error: 'Unable to read Stacks height' }, { status: 502 })
    const data = await response.json()
    const height = Number(data.stacks_tip_height ?? data.burn_block_height ?? 0)
    return NextResponse.json({ height, epoch: getEpoch(height), nextSettlementHeight: (Math.floor(height / 144) + 1) * 144 })
  } catch {
    return NextResponse.json({ error: 'Unable to read Stacks height' }, { status: 502 })
  }
}
