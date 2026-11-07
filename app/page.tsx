'use client'
import { ref, set, onValue, onDisconnect } from "firebase/database";
import { db } from "@/lib/firebase";
import { useEffect, useMemo, useState, useRef } from 'react'
import { connect, openContractCall } from '@stacks/connect'
import { uintCV } from '@stacks/transactions'
import { calculateNashRate } from '@/lib/nash'
import { Activity, ArrowUpRight, CircleHelp, Crosshair, Gauge, Menu, Radio, ShieldCheck, Sparkles, Trophy, Wallet, Zap } from 'lucide-react'

type BetKind = 'mine-win' | 'mine-loss' | 'other'

type BlockBet = {
  id: string
  player: string
  amount: number
  kind: BetKind
  direction: 'UP' | 'DOWN'
}

type OracleBlock = {
  height: number
  hash: string
  time: string
  bets: BlockBet[]
}

interface PlayerData {
  angle: number;
  color: string;
}

const initialBlocks: OracleBlock[] = [
  { height: 1842, hash: '9f3a…c81d', time: '12 sec ago', bets: [{ id: '1', player: 'You', amount: 10, kind: 'mine-win', direction: 'UP' }, { id: '2', player: '0x7a…91', amount: 24, kind: 'other', direction: 'DOWN' }] },
  { height: 1841, hash: '4b72…a0e9', time: '1 min ago', bets: [{ id: '4', player: 'You', amount: 12, kind: 'mine-loss', direction: 'DOWN' }, { id: '5', player: '0x9d…e2', amount: 31, kind: 'other', direction: 'UP' }] },
]

const initialCandles = [
  { x: 18, open: 108, close: 92, high: 82, low: 120, up: true },
  { x: 48, open: 95, close: 114, high: 84, low: 126, up: false },
  { x: 78, open: 113, close: 76, high: 66, low: 124, up: true },
  { x: 108, open: 80, close: 91, high: 70, low: 105, up: false },
  { x: 138, open: 90, close: 57, high: 50, low: 102, up: true },
  { x: 168, open: 58, close: 77, high: 45, low: 88, up: false },
  { x: 198, open: 76, close: 42, high: 35, low: 88, up: true },
  { x: 228, open: 43, close: 61, high: 30, low: 74, up: false },
  { x: 258, open: 60, close: 29, high: 22, low: 70, up: true },
  { x: 288, open: 28, close: 48, high: 16, low: 56, up: false },
]

export default function Page() {
  const [angle, setAngle] = useState<number>(1.0);
  const [arrowTip, setArrowTip] = useState({ x: initialCandles.at(-1)?.x ?? 288, y: initialCandles.at(-1)?.close ?? 48 })
  const [candles, setCandles] = useState(initialCandles)
  const [candleTick, setCandleTick] = useState(0)
  const [btcPrice, setBtcPrice] = useState<number | null>(null)
  const [priceDelta, setPriceDelta] = useState(0)
  const [stackHeight, setStackHeight] = useState<number | null>(null)
  const [settlementStatus, setSettlementStatus] = useState<'estimated' | 'pending'>('estimated')
  const [nashPreview, setNashPreview] = useState(0)
  const [batchEpoch, setBatchEpoch] = useState<number | null>(null)
  const [balance, setBalance] = useState(0)
  const [status, setStatus] = useState<'idle' | 'running' | 'win' | 'loss'>('idle')
  const [lastReward, setLastReward] = useState<number | null>(null)
  const [round, setRound] = useState(14)
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [faucetStatus, setFaucetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [faucetMessage, setFaucetMessage] = useState('')
  const [contractTxId, setContractTxId] = useState<string | null>(null)
  const [betAmount, setBetAmount] = useState(10)
  const [blocks, setBlocks] = useState(initialBlocks)
  const [assemblingBlock, setAssemblingBlock] = useState(false)
  const sliderRef = useRef<HTMLInputElement>(null);

  //  МУЛЬТИПЛЕЕР: ID И ИГРОКИ
  const [playerId, setPlayerId] = useState<string>('');
  const [playerColor, setPlayerColor] = useState<string>('#00ff00');
  const [players, setPlayers] = useState<Record<string, PlayerData>>({});

    // Генерация "паспорта" при загрузке + АВТО-УБОРКА
  useEffect(() => {
    let id = localStorage.getItem('quantum_player_id');
    if (!id) {
      id = 'player_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('quantum_player_id', id);
    }
    setPlayerId(id);

    let color = localStorage.getItem('quantum_player_color');
    if (!color) {
      const colors: string[] = ['#c8ff32', '#58d9ff', '#ff5964', '#a855f7', '#fbbf24'];
      color = colors[Math.floor(Math.random() * colors.length)];
      localStorage.setItem('quantum_player_color', color);
    }
    setPlayerColor(color);

  
    if (id && color) {
      
      const playerRef = ref(db, `rooms/lobby_main/players/${id}`);
      
      set(playerRef, { angle: 1.0, color: color });
      
      onDisconnect(playerRef).remove();
    }
  }, []);
  // Слушаем других игроков в Firebase
  useEffect(() => {
    if (!playerId) return;
    const playersRef = ref(db, 'rooms/lobby_main/players');
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      setPlayers(data || {});
    });
    return () => unsubscribe();
  }, [playerId]);

  // --- ВЫЧИСЛЯЕМЫЕ ЗНАЧЕНИЯ ---
  const myAngle = players[playerId]?.angle ?? 1.0; 
  const angleLabel = `${myAngle >= 0 ? '+' : ''}${myAngle.toFixed(2)} rad`;
  const angleDegrees = Math.round(myAngle * 90);
  const rewardPreview = useMemo(() => Math.max(0, Math.abs(myAngle) * 92 + 9), [myAngle]);
  const firstCandle = candles[0]
  const lastCandle = candles[candles.length - 1]
  const trendPercent = btcPrice && priceDelta ? (priceDelta / btcPrice) * 100 : 0
  const chartOrigin = { x: 0, y: 150 }

  useEffect(() => {
    setNashPreview(calculateNashRate({ deltaR: Math.round(Math.abs(myAngle) * 1_000_000), deltaRNS: Math.round(Math.abs(priceDelta) * 1_000_000), epsilon: 1 }))
  }, [myAngle, priceDelta])

  useEffect(() => {
    let previousPrice: number | null = null
    async function updateMarket() {
      try {
        const response = await fetch(`/api/btc?t=${Date.now()}`, { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        const nextPrice = Number(data.price)
        if (!Number.isFinite(nextPrice) || nextPrice <= 0) return
        const delta = previousPrice === null ? 0 : nextPrice - previousPrice
        previousPrice = nextPrice
        setBtcPrice(nextPrice)
        setPriceDelta(delta)
        setCandleTick((value) => value + 1)
        setCandles((current) => {
          const previous = current[current.length - 1]
          const move = Math.max(-18, Math.min(18, delta === 0 ? 0 : delta / Math.max(nextPrice, 1) * 120000))
          const close = Math.max(18, Math.min(132, previous.close - move))
          const open = previous.close
          const high = Math.max(open, close) - 10
          const low = Math.min(open, close) + 10
          const next = { x: 288, open, close, high, low, up: close < open }
          return [...current.slice(1), next].map((c, index) => ({ ...c, x: 18 + index * 30 }))
        })
      } catch {}
    }
    updateMarket()
    const interval = window.setInterval(updateMarket, 2000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!walletAddress) { setBalance(0); return }
    let cancelled = false
    async function updateBalance() {
      try {
        const response = await fetch(`/api/stacks/balance?address=${encodeURIComponent(walletAddress!)}`, { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled && Number.isFinite(Number(data.balance))) setBalance(Number(data.balance))
      } catch {}
    }
    updateBalance()
    const interval = window.setInterval(updateBalance, 10_000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [walletAddress])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setAssemblingBlock(true)
      window.setTimeout(() => {
        setBlocks((current) => [{
          height: current[0].height + 1,
          hash: `${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`,
          time: 'just now',
          bets: [
            { id: `new-${Date.now()}`, player: 'You', amount: betAmount, kind: Math.random() > 0.35 ? 'mine-win' : 'mine-loss', direction: myAngle >= 0 ? 'UP' : 'DOWN' },
            { id: `new-other-${Date.now()}`, player: '0x6e…b2', amount: 16, kind: 'other', direction: 'UP' },
          ],
        }, ...current].slice(0, 4))
        setAssemblingBlock(false)
      }, 650)
    }, 9000)
    return () => window.clearInterval(interval)
  }, [myAngle, betAmount])

  useEffect(() => {
    setArrowTip({ x: lastCandle.x, y: Math.max(12, Math.min(138, firstCandle.close - myAngle * 60)) });
  }, [myAngle, firstCandle.close, lastCandle.x]); 

  // ФУНКЦИИ 
  function updateArrowFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    const svg = event.currentTarget.querySelector('svg[aria-label="Candlestick market chart"]')
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const y = Math.max(12, Math.min(138, ((event.clientY - rect.top) / rect.height) * 150))
    const newAngle = Math.max(-1, Math.min(1, (firstCandle.close - y) / 60))
    
    setAngle(newAngle); // Локально
    if (playerId) {
      set(ref(db, `rooms/lobby_main/players/${playerId}`), { angle: newAngle, color: playerColor }); // В Firebase
    }
  }

  async function placeBid() {
    if (status === 'running' || !walletConnected) return
    setStatus('running')
    try {
      await openContractCall({
        contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? 'ST225ER9XSGMTAXV8XHWYDY50PCR3X6RSR8J7FJ8B',
        contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME ?? 'rebalancer',
        functionName: 'deposit',
        functionArgs: [uintCV(Math.round(betAmount * 1_000_000)), uintCV(Math.round(Math.abs(myAngle) * 1_000_000))],
        network: process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet',
        onFinish: ({ txId }: { txId: string }) => { setContractTxId(txId); setStatus('idle') },
        onCancel: () => setStatus('idle'),
      } as any)
    } catch { setStatus('idle') }
  }

  async function requestTestStx() {
    if (!walletAddress || faucetStatus === 'loading') return
    setFaucetStatus('loading')
    try {
      const response = await fetch('/api/faucet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: walletAddress }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Failed')
      setFaucetStatus('success')
      setFaucetMessage(data.txId ? `Tx: ${data.txId.slice(0, 10)}...` : 'Requested.')
    } catch (error) {
      setFaucetStatus('error')
      setFaucetMessage(error instanceof Error ? error.message : 'Failed')
    }
  }

  // РЕНДЕР
  return (
    <main className="min-h-screen bg-[#070909] px-4 py-4 text-[#f4f7f4] sm:px-6 relative">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0c1010] shadow-2xl shadow-black/50">
        
        {/* HEADER */}
        <header className="flex items-center justify-between px-5 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#c8ff32] text-[#10150b] shadow-[0_0_20px_rgba(200,255,50,.2)]"><Crosshair size={19} strokeWidth={2.5} /></div>
            <div><p className="font-mono text-[12px] font-bold uppercase tracking-[0.22em]">QUANTUM ORACLE</p><p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/35">risk arena / live</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={async () => { try { const response = await connect({ forceWalletSelect: true }) as any; setWalletAddress(response.addresses?.[0]?.address ?? null); setWalletConnected(true) } catch {} }} className="flex items-center gap-1.5 rounded-xl bg-[#c8ff32] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#10150b] shadow-[0_0_18px_rgba(200,255,50,.16)] transition hover:bg-[#d5ff68] active:scale-95">
              <Wallet size={13} strokeWidth={2.5} /> {walletConnected ? 'Connected' : 'Connect'}
            </button>
            <button aria-label="Open menu" className="rounded-full p-2 text-white/45 transition hover:bg-white/5 hover:text-white"><Menu size={19} /></button>
          </div>
        </header>

        <section className="px-4 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">genesis block</p><h1 className="mt-1 text-lg font-semibold tracking-tight">Price momentum <span className="text-white/25">/ 1m</span></h1></div>
            <div className={`flex items-center gap-1.5 font-mono text-xs ${trendPercent >= 0 ? 'text-[#c8ff32]' : 'text-[#ff5964]'}`}>
              <ArrowUpRight size={14} /> {btcPrice ? `${trendPercent >= 0 ? '+' : ''}${trendPercent.toFixed(2)}%` : 'syncing'}
            </div>
          </div>
          
          <div className="relative aspect-square w-full touch-none overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b1110] p-3" aria-label="BTC candlestick chart" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateArrowFromPointer(event) }} onPointerMove={(event) => { if (event.buttons === 1) updateArrowFromPointer(event) }}>
            <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '100% 44px, 37px 100%' }} />
            <div className="pointer-events-none absolute inset-y-9 left-0 z-10 flex flex-col justify-between py-0.5 font-mono text-[9px] text-white/35"><span>$40k</span><span>$30k</span><span>$20k</span><span>$10k</span><span>$0</span></div>
            
            <svg viewBox="0 0 340 150" className={`absolute inset-x-3 bottom-5 top-9 z-10 h-[calc(100%-56px)] w-[calc(100%-24px)] ${status === 'running' ? 'opacity-70' : ''}`} preserveAspectRatio="none" aria-label="Candlestick market chart">
              <g key={candleTick} className="candle-slide">
                {candles.map((c) => <g key={c.x} className="opacity-80"><line x1={c.x} x2={c.x} y1={c.high} y2={c.low} stroke={c.up ? '#c8ff32' : '#ff5964'} strokeWidth="1" /><rect x={c.x - 4} y={Math.min(c.open, c.close)} width="8" height={Math.max(5, Math.abs(c.open - c.close))} rx="1" fill={c.up ? '#c8ff32' : '#ff5964'} /></g>)}
              </g>
            </svg>

            {/* МУЛЬТИПЛЕЕРНЫЕ СТРЕЛКИ */}
            <svg viewBox="0 0 340 150" className="pointer-events-none absolute inset-x-3 bottom-5 top-9 z-20 h-[calc(100%-56px)] w-[calc(100%-24px)] overflow-visible" preserveAspectRatio="none">
              <defs>
                <marker id="arrow-me" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#c8ff32" /></marker>
                <marker id="arrow-other" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#58d9ff" /></marker>
              </defs>
              {Object.entries(players).map(([id, player]) => {
                const isMe = id === playerId;
                const color = isMe ? '#c8ff32' : (player.color || '#58d9ff');
                const tipY = Math.max(12, Math.min(138, firstCandle.close - player.angle * 60));
                return (
                  <g key={id} style={{ opacity: isMe ? 1 : 0.4, transition: 'opacity 0.3s' }}>
                    <line x1={chartOrigin.x} y1={chartOrigin.y} x2={lastCandle.x} y2={tipY} stroke={color} strokeWidth={isMe ? "3" : "2"} strokeLinecap="round" markerEnd={`url(#${isMe ? 'arrow-me' : 'arrow-other'})`} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
                    <circle cx={chartOrigin.x} cy={chartOrigin.y} r="4" fill={color} stroke="#0b1110" strokeWidth="2" />
                  </g>
                );
              })}
            </svg>

            <div className="absolute bottom-3 left-3 rounded bg-black/30 px-1.5 py-1 font-mono text-[9px] text-white/45">tap chart to set angle · {angleDegrees}°</div>
          </div>
        </section>

        <section className="px-4 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><Gauge size={15} className="text-[#58d9ff]" /><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">risk angle</p></div>
            <span className={`font-mono text-sm font-bold ${myAngle >= 0 ? 'text-[#c8ff32]' : 'text-[#ff5964]'}`}>{angleLabel}</span>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#111716] p-4">
            <input 
              ref={sliderRef} type="range" min="-1" max="1" step="0.01" value={myAngle} 
              onChange={(e) => { 
                const nextAngle = Number(e.target.value); 
                setAngle(nextAngle);
                if (playerId) set(ref(db, `rooms/lobby_main/players/${playerId}`), { angle: nextAngle, color: playerColor });
              }} 
              className="w-full accent-[#c8ff32]" 
            />
            <div className="mt-3 flex justify-between font-mono text-[10px] text-white/30"><span>−1.00 bearish</span><span>neutral</span><span>+1.00 bullish</span></div>
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <div className="flex items-center justify-between"><span className="text-[11px] text-white/35">estimated reward</span><span className="font-mono text-sm text-[#c8ff32]">+${rewardPreview.toFixed(2)}</span></div>
            </div>
          </div>
        </section>

        <section className="mt-auto px-4 pb-5 pt-5">
          {status !== 'idle' && <div className={`mb-3 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-xs ${status === 'running' ? 'border-[#58d9ff]/20 bg-[#58d9ff]/5 text-[#58d9ff]' : status === 'win' ? 'border-[#c8ff32]/20 bg-[#c8ff32]/5 text-[#c8ff32]' : 'border-[#ff5964]/20 bg-[#ff5964]/5 text-[#ff5964]'}`}><Sparkles size={14} className={status === 'running' ? 'animate-spin' : ''} /><span>{status === 'running' ? 'Resolving...' : status === 'win' ? `Win +$${lastReward?.toFixed(2)}` : `Loss -$${Math.abs(lastReward ?? 0).toFixed(2)}`}</span></div>}
          
          <div className="mb-3 rounded-2xl border border-white/[0.07] bg-[#111716] p-2">
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => setBetAmount((v) => Math.max(1, v - 1))} disabled={status === 'running'} className="flex size-11 items-center justify-center rounded-xl border border-white/[0.08] text-xl text-white/65 transition hover:bg-white/5 disabled:opacity-30">−</button>
              <label className="flex flex-1 items-center justify-center gap-1 font-mono text-2xl font-semibold text-white">
                <span className="text-[#c8ff32]">$</span>
                <input type="number" min="1" value={betAmount} onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value) || 1))} disabled={status === 'running'} className="w-24 bg-transparent text-center font-mono text-2xl font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              </label>
              <button onClick={() => setBetAmount((v) => v + 1)} disabled={status === 'running'} className="flex size-11 items-center justify-center rounded-xl border border-white/[0.08] text-xl text-white/65 transition hover:bg-white/5 disabled:opacity-30">+</button>
            </div>
          </div>
          
          <button onClick={placeBid} disabled={status === 'running' || !walletConnected} className="group flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#c8ff32] font-mono text-lg font-black tracking-[0.2em] text-[#10150b] shadow-[0_8px_30px_rgba(200,255,50,.16)] transition hover:scale-[1.01] active:scale-[.98] disabled:opacity-60">
            <Zap size={19} fill="currentColor" /> {status === 'running' ? 'PROCESSING' : walletConnected ? 'BID' : 'CONNECT WALLET'}
          </button>
          
          {contractTxId && <a href={`https://explorer.hiro.so/txid/${contractTxId}?chain=testnet`} target="_blank" rel="noreferrer" className="mt-2 block truncate text-center font-mono text-[9px] text-[#58d9ff]">tx: {contractTxId}</a>}
          
          <section className="mt-4 rounded-2xl border border-white/[0.07] bg-[#111716] px-4 py-4">
            <div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[0.18em] text-white/35">available balance</p><p className="mt-1 font-mono text-[27px] font-semibold tracking-tight">{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-sm text-white/45">STX</span></p></div></div>
            <button type="button" onClick={requestTestStx} disabled={!walletConnected || faucetStatus === 'loading'} className="mt-4 flex w-full items-center justify-center rounded-xl border border-[#58d9ff]/25 bg-[#58d9ff]/10 px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#58d9ff] transition hover:bg-[#58d9ff]/15 disabled:opacity-35">{faucetStatus === 'loading' ? 'Requesting...' : 'Get test STX'}</button>
            {faucetMessage && <p className="mt-2 truncate text-center font-mono text-[9px] text-white/35">{faucetMessage}</p>}
          </section>

          <section className="mt-5 border-t border-white/[0.06] pt-5">
            <div className="mb-3 flex items-center justify-between">
              <div><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">oracle chain</p><h2 className="mt-1 text-lg font-semibold tracking-tight">Previous blocks</h2></div>
              <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/35"><span className={`size-1.5 rounded-full ${assemblingBlock ? 'animate-ping bg-[#58d9ff]' : 'bg-[#c8ff32]'}`} /> {assemblingBlock ? 'building' : 'live'}</div>
            </div>
            <div className="flex flex-col gap-2">
              {blocks.map((block, index) => <article key={`${block.height}-${block.hash}`} className="rounded-2xl border border-white/[0.07] bg-[#111716] p-3">
                <div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-white/35"><span className="text-[#58d9ff]">#{block.height}</span><span>{block.time}</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {block.bets.map((bet) => <div key={bet.id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 font-mono text-[10px] ${bet.kind === 'mine-win' ? 'border-[#c8ff32]/35 bg-[#c8ff32]/10 text-[#c8ff32]' : bet.kind === 'mine-loss' ? 'border-[#ff5964]/35 bg-[#ff5964]/10 text-[#ff5964]' : 'border-[#a855f7]/35 bg-[#a855f7]/10 text-[#c084fc]'}`}><span className="font-bold">{bet.player}</span><span className="opacity-70">${bet.amount}</span></div>)}
                </div>
              </article>)}
            </div>
          </section>
        </section>
        
        <footer className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-[9px] uppercase tracking-[0.16em] text-white/20"><span>network: genesis testnet</span><span>v0.8</span></footer>
      </div>
    </main>
  )
}