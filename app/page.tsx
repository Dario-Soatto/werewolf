'use client';

import { useState, useCallback } from 'react';

interface GameEvent {
  type: string;
  data: Record<string, unknown>;
}

interface PlayerInfo {
  name: string;
  originalRole: string;
  currentRole: string;
}

const ROLE_SYMBOLS: Record<string, string> = {
  werewolf: '🐺',
  seer: '👁',
  robber: '🗡',
  troublemaker: '🔀',
  tanner: '💀',
  villager: '🏠',
  insomniac: '🦉',
};

export default function Home() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextStepDescription, setNextStepDescription] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

  const startGame = useCallback(async () => {
    setEvents([]);
    setGameId(null);
    setCompleted(false);
    setNextStepDescription(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/game/start', { method: 'POST' });
      const data = await response.json();
      if (data.error) {
        console.error('Failed to start game:', data.error);
        return;
      }
      setGameId(data.gameId);
      setTotalSteps(data.totalSteps);
      setNextStepDescription(data.nextStepDescription);
      setCurrentStep(0);
    } catch (error) {
      console.error('Failed to start game:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const executeNextStep = useCallback(async () => {
    if (!gameId || isLoading) return;
    setIsLoading(true);

    try {
      const response = await fetch('/api/game/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      });
      const data = await response.json();
      if (data.error) {
        console.error('Step error:', data.error);
        return;
      }
      setEvents((prev) => [...prev, data.event]);
      setCompleted(data.completed);
      setNextStepDescription(data.nextStepDescription);
      setCurrentStep(data.currentStep);
      setTotalSteps(data.totalSteps);
    } catch (error) {
      console.error('Step error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [gameId, isLoading]);

  const gameResult = events.find((e) => e.type === 'game_end')?.data as {
    winners: string[];
    finalRoles: PlayerInfo[];
    centerCards: { left: string; middle: string; right: string };
  } | undefined;

  const setupEvent = events.find((e) => e.type === 'setup')?.data as {
    players: { name: string; originalRole: string }[];
    centerCards: { left: string; middle: string; right: string };
  } | undefined;

  return (
    <>
      <div className="noise-bg" />
      <div className="moon-glow" />
      
      <main className="relative z-10 min-h-screen px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12">
            <div className="inline-block mb-4">
              <div className="text-6xl mb-2 opacity-80">🌙</div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-wide mb-2">
              One Night
            </h1>
            <p className="text-2xl md:text-3xl text-[var(--color-parchment)] opacity-70 tracking-widest uppercase">
              Ultimate Werewolf
            </p>
            <p className="mt-4 text-sm opacity-40 tracking-wider">
              Five strangers. One night. Who will survive?
            </p>
          </header>

          {/* Controls */}
          <div className="flex flex-col items-center gap-6 mb-12">
            <div className="flex gap-4">
              <button
                onClick={startGame}
                disabled={isLoading}
                className="btn-primary px-8 py-3 rounded text-lg"
              >
                {gameId ? 'New Game' : 'Begin'}
              </button>

              {gameId && !completed && (
                <button
                  onClick={executeNextStep}
                  disabled={isLoading}
                  className="btn-secondary px-8 py-3 rounded text-lg flex items-center gap-3"
                >
                  {isLoading ? (
                    <span className="pulse-slow">Thinking...</span>
                  ) : (
                    <>Continue<span className="opacity-50">→</span></>
                  )}
                </button>
              )}
            </div>

            {gameId && (
              <div className="text-sm opacity-50 font-mono">
                {currentStep}/{totalSteps}
                {nextStepDescription && !completed && (
                  <span className="ml-3 opacity-70">· {nextStepDescription}</span>
                )}
                {completed && (
                  <span className="ml-3 text-[var(--color-parchment)]">· The night is over</span>
                )}
              </div>
            )}
          </div>

          {/* Players Row */}
          {setupEvent && (
            <div className="mb-12 animate-in">
              <div className="grid grid-cols-5 gap-3">
                {setupEvent.players.map((p, i) => (
                  <div
                    key={p.name}
                    className={`player-card role-${p.originalRole} p-4 rounded text-center`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="text-2xl mb-2">{ROLE_SYMBOLS[p.originalRole]}</div>
                    <p className="font-semibold text-lg">{p.name}</p>
                    <p className="text-xs opacity-50 uppercase tracking-wider mt-1">
                      {p.originalRole}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-center mt-4 text-sm opacity-40">
                Center: {setupEvent.centerCards.left} · {setupEvent.centerCards.middle} · {setupEvent.centerCards.right}
              </p>
            </div>
          )}

          {/* Winner Banner */}
          {gameResult && completed && (
            <div className="mb-12 animate-in">
              <div className={`game-card p-8 rounded-lg text-center ${
                gameResult.winners.includes('werewolf') ? 'role-werewolf' :
                gameResult.winners.includes('tanner') ? 'role-tanner' : 'role-villager'
              }`}>
                <p className="text-sm uppercase tracking-widest opacity-50 mb-2">The sun rises...</p>
                <h2 className="text-3xl font-bold mb-4">
                  {gameResult.winners.includes('village') && 'The Village Survives'}
                  {gameResult.winners.includes('werewolf') && 'The Wolves Feast Tonight'}
                  {gameResult.winners.includes('tanner') && 'The Tanner Finds Peace'}
                </h2>
                <div className="grid grid-cols-5 gap-3 mt-6">
                  {gameResult.finalRoles.map((player) => (
                    <div key={player.name} className="text-center">
                      <div className="text-xl mb-1">{ROLE_SYMBOLS[player.currentRole]}</div>
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-xs opacity-50">{player.currentRole}</p>
                      {player.originalRole !== player.currentRole && (
                        <p className="text-xs text-[var(--color-blood-bright)]">
                          was {player.originalRole}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Event Log */}
          <div className="space-y-4">
            {events.filter(e => e.type !== 'setup' && e.type !== 'game_end').map((event, i) => (
              <EventCard key={i} event={event} index={i} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function EventCard({ event, index }: { event: GameEvent; index: number }) {
  const [showDetails, setShowDetails] = useState(false);
  const data = event.data;

  const hasDetails = Boolean(data.systemPrompt || data.userPrompt || data.reasoning);

  switch (event.type) {
    case 'phase_change': {
      const phase = String(data.phase);
      const round = data.round as number | undefined;
      return (
        <div className="phase-divider animate-in" style={{ animationDelay: `${index * 50}ms` }}>
          <span className="text-sm uppercase tracking-widest opacity-50">
            {phase === 'night' && '🌙 Night Falls'}
            {phase === 'day' && round && `☀ Day · Discussion ${round}`}
            {phase === 'day' && !round && '☀ Dawn Breaks'}
            {phase === 'voting' && '⚖ Time to Vote'}
          </span>
        </div>
      );
    }

    case 'night_action':
      return (
        <div 
          className="game-card p-5 rounded-lg animate-in" 
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{ROLE_SYMBOLS[String(data.role)] || '?'}</span>
                <span className="font-semibold text-lg">{String(data.player)}</span>
                <span className="text-sm opacity-40">awakens</span>
              </div>
              <p className="opacity-80 leading-relaxed">{String(data.result)}</p>
            </div>
            {hasDetails && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs opacity-40 hover:opacity-70 transition-opacity"
              >
                {showDetails ? 'hide' : 'details'}
              </button>
            )}
          </div>
          {showDetails && <DetailsPanel data={data} />}
        </div>
      );

    case 'day_message':
      return (
        <div 
          className="game-card p-5 rounded-lg animate-in" 
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="font-semibold mb-2">{String(data.player)}</p>
              <blockquote className="text-lg leading-relaxed opacity-90 border-l-2 border-[var(--color-parchment)]/20 pl-4">
                &ldquo;{String(data.message)}&rdquo;
              </blockquote>
            </div>
            {hasDetails && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs opacity-40 hover:opacity-70 transition-opacity"
              >
                {showDetails ? 'hide' : 'details'}
              </button>
            )}
          </div>
          {showDetails && <DetailsPanel data={data} />}
        </div>
      );

    case 'vote':
      return (
        <div 
          className="game-card p-5 rounded-lg animate-in border-l-2 border-[var(--color-blood)]" 
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="opacity-80">
                <span className="font-semibold">{String(data.voter)}</span>
                <span className="opacity-50 mx-2">votes to eliminate</span>
                <span className="font-semibold text-[var(--color-blood-bright)]">{String(data.target)}</span>
              </p>
            </div>
            {hasDetails && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs opacity-40 hover:opacity-70 transition-opacity"
              >
                {showDetails ? 'hide' : 'details'}
              </button>
            )}
          </div>
          {showDetails && <DetailsPanel data={data} />}
        </div>
      );

    case 'resolution': {
      const eliminated = data.eliminated as string;
      const votes = data.votes as { voter: string; target: string }[];
      return (
        <div 
          className="game-card p-6 rounded-lg animate-in" 
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <p className="text-sm uppercase tracking-widest opacity-50 mb-4">The village decides...</p>
          
          <div className="flex flex-wrap gap-2 mb-4 text-sm opacity-60">
            {votes.map((v, i) => (
              <span key={i} className="font-mono">
                {v.voter}→{v.target}
                {i < votes.length - 1 && <span className="mx-2 opacity-30">·</span>}
              </span>
            ))}
          </div>

          {eliminated === 'No one' ? (
            <p className="text-xl">The village cannot agree. No one is eliminated.</p>
          ) : (
            <p className="text-xl">
              <span className="font-bold text-[var(--color-blood-bright)]">{eliminated}</span>
              <span className="opacity-70"> is dragged to the gallows</span>
              {Boolean(data.eliminatedRole) && (
                <span className="opacity-50"> — revealed as {String(data.eliminatedRole)}</span>
              )}
            </p>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

function DetailsPanel({ data }: { data: Record<string, unknown> }) {
  const [showPrompts, setShowPrompts] = useState(false);
  
  const reasoning = data.reasoning as string | undefined;
  const systemPrompt = data.systemPrompt as string | undefined;
  const userPrompt = data.userPrompt as string | undefined;
  const llmResponse = data.llmResponse as string | undefined;

  return (
    <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
      {reasoning && (
        <div className="thought-bubble p-4 rounded text-sm opacity-70">
          <p className="text-xs uppercase tracking-wider opacity-50 mb-2">Internal reasoning</p>
          <p className="leading-relaxed whitespace-pre-wrap">{reasoning}</p>
        </div>
      )}

      {(systemPrompt || userPrompt) && (
        <div>
          <button
            onClick={() => setShowPrompts(!showPrompts)}
            className="text-xs font-mono opacity-40 hover:opacity-70 transition-opacity"
          >
            {showPrompts ? '− hide prompts' : '+ show prompts'}
          </button>
          
          {showPrompts && (
            <div className="mt-3 space-y-3 text-xs font-mono">
              {Boolean(data.systemPrompt) && (
                <div className="bg-black/20 p-3 rounded max-h-48 overflow-auto">
                  <p className="opacity-40 mb-1">system:</p>
                  <pre className="opacity-60 whitespace-pre-wrap">{String(data.systemPrompt)}</pre>
                </div>
              )}
              {Boolean(data.userPrompt) && (
                <div className="bg-black/20 p-3 rounded max-h-48 overflow-auto">
                  <p className="opacity-40 mb-1">user:</p>
                  <pre className="opacity-60 whitespace-pre-wrap">{String(data.userPrompt)}</pre>
                </div>
              )}
              {Boolean(data.llmResponse) && (
                <div className="bg-black/20 p-3 rounded max-h-48 overflow-auto border-l border-green-900/50">
                  <p className="opacity-40 mb-1">response:</p>
                  <pre className="opacity-80 whitespace-pre-wrap text-green-200/70">{String(data.llmResponse)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}