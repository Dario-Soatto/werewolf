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
  } | undefined;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2 text-amber-500">
          🐺 One Night Ultimate Werewolf
        </h1>
        <p className="text-center text-gray-400 mb-8">LLMs playing against each other • Powered by GPT-5</p>

        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex gap-4">
            <button
              onClick={startGame}
              disabled={isLoading}
              className="px-8 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-colors"
            >
              {gameId ? '🔄 New Game' : '▶️ Start Game'}
            </button>

            {gameId && !completed && (
              <button
                onClick={executeNextStep}
                disabled={isLoading}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-wait rounded-lg font-semibold text-lg transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⏳</span> Running...
                  </>
                ) : (
                  <>Next Step →</>
                )}
              </button>
            )}
          </div>

          {gameId && (
            <div className="text-sm text-gray-400">
              Step {currentStep} of {totalSteps}
              {nextStepDescription && !completed && (
                <span className="ml-2 text-amber-400">• Next: {nextStepDescription}</span>
              )}
              {completed && <span className="ml-2 text-emerald-400">• Game Complete!</span>}
            </div>
          )}
        </div>

        {gameResult && completed && (
          <div className="mb-8 p-6 bg-gray-900 rounded-xl border border-amber-500/30">
            <h2 className="text-2xl font-bold text-center mb-4">
              {gameResult.winners.includes('village') && '🏆 Village Wins!'}
              {gameResult.winners.includes('werewolf') && '🐺 Werewolves Win!'}
              {gameResult.winners.includes('tanner') && '💀 Tanner Wins!'}
            </h2>
            <div className="grid grid-cols-5 gap-4">
              {gameResult.finalRoles.map((player) => (
                <div
                  key={player.name}
                  className={`p-3 rounded-lg text-center ${
                    player.currentRole === 'werewolf'
                      ? 'bg-red-900/50 border border-red-500/50'
                      : player.currentRole === 'tanner'
                      ? 'bg-yellow-900/50 border border-yellow-500/50'
                      : 'bg-green-900/50 border border-green-500/50'
                  }`}
                >
                  <p className="font-semibold">{player.name}</p>
                  <p className="text-sm text-gray-400">{player.originalRole}</p>
                  {player.originalRole !== player.currentRole && (
                    <p className="text-xs text-amber-400">→ {player.currentRole}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {events.map((event, i) => (
            <EventCard key={i} event={event} />
          ))}
        </div>
      </div>
    </main>
  );
}

function EventCard({ event }: { event: GameEvent }) {
  const [showPrompts, setShowPrompts] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true); // Show reasoning by default
  const data = event.data;

  const hasPrompts = Boolean(data.systemPrompt || data.userPrompt);
  const hasReasoning = Boolean(data.reasoning || data.modelReasoning);

  // Reasoning section - GPT-5's chain-of-thought summary
  const reasoningSection = hasReasoning && showReasoning && (
    <div className="mt-3 p-3 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded border border-cyan-700/50">
      <p className="text-cyan-400 font-semibold text-sm mb-2">🧠 Model Reasoning (GPT-5 Chain-of-Thought)</p>
      <p className="text-cyan-200 text-sm whitespace-pre-wrap">
        {String(data.reasoning || data.modelReasoning)}
      </p>
    </div>
  );

  const promptsSection = hasPrompts && showPrompts && (
    <div className="mt-3 space-y-2 text-xs">
      {Boolean(data.systemPrompt) && (
        <div className="bg-black/30 p-3 rounded border border-gray-700 max-h-64 overflow-auto">
          <p className="text-gray-500 font-semibold mb-1">System Prompt:</p>
          <pre className="text-gray-400 whitespace-pre-wrap font-mono">{String(data.systemPrompt)}</pre>
        </div>
      )}
      {Boolean(data.userPrompt) && (
        <div className="bg-black/30 p-3 rounded border border-gray-700 max-h-64 overflow-auto">
          <p className="text-gray-500 font-semibold mb-1">User Prompt:</p>
          <pre className="text-gray-400 whitespace-pre-wrap font-mono">{String(data.userPrompt)}</pre>
        </div>
      )}
      {Boolean(data.llmResponse) && (
        <div className="bg-black/30 p-3 rounded border border-emerald-900">
          <p className="text-emerald-600 font-semibold mb-1">LLM Response:</p>
          <pre className="text-emerald-400 whitespace-pre-wrap font-mono">{String(data.llmResponse)}</pre>
        </div>
      )}
    </div>
  );

  const controlButtons = (hasPrompts || hasReasoning) && (
    <div className="flex gap-2">
      {hasReasoning && (
        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className="text-xs px-2 py-1 bg-cyan-800/50 hover:bg-cyan-700/50 rounded text-cyan-300"
        >
          {showReasoning ? '🧠 Hide Reasoning' : '🧠 Show Reasoning'}
        </button>
      )}
      {hasPrompts && (
        <button
          onClick={() => setShowPrompts(!showPrompts)}
          className="text-xs px-2 py-1 bg-gray-700/50 hover:bg-gray-600/50 rounded text-gray-300"
        >
          {showPrompts ? 'Hide Prompts' : 'Show Prompts'}
        </button>
      )}
    </div>
  );

  switch (event.type) {
    case 'setup':
      return (
        <div className="p-4 bg-gray-800/50 rounded-lg border-l-4 border-gray-500">
          <span className="text-gray-300 font-semibold">🎴 Game Setup</span>
          <div className="mt-2 grid grid-cols-5 gap-2 text-sm">
            {(data.players as { name: string; originalRole: string }[]).map((p) => (
              <div key={p.name} className="bg-gray-900/50 p-2 rounded text-center">
                <p className="font-semibold">{p.name}</p>
                <p className="text-gray-500">{p.originalRole}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-sm mt-2">
            Center: {(data.centerCards as { left: string; middle: string; right: string }).left},{' '}
            {(data.centerCards as { left: string; middle: string; right: string }).middle},{' '}
            {(data.centerCards as { left: string; middle: string; right: string }).right}
          </p>
        </div>
      );

    case 'phase_change':
      return (
        <div className="p-3 bg-indigo-900/30 rounded-lg border-l-4 border-indigo-500">
          <span className="text-indigo-300 font-semibold">
            📍 Phase: {String(data.phase).toUpperCase()}
            {Boolean(data.round) && ` (Round ${data.round})`}
          </span>
        </div>
      );

    case 'night_action':
      return (
        <div className="p-4 bg-purple-900/30 rounded-lg border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-purple-300">🌙</span>{' '}
              <span className="font-semibold text-purple-200">{String(data.player)}</span>
              <span className="text-gray-400"> ({String(data.role)})</span>
            </div>
            {controlButtons}
          </div>
          <p className="text-gray-300 mt-2">{String(data.result)}</p>
          {reasoningSection}
          {promptsSection}
        </div>
      );

    case 'day_message':
      return (
        <div className="p-4 bg-amber-900/20 rounded-lg border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-amber-300">💬</span>{' '}
              <span className="font-semibold text-amber-200">{String(data.player)}</span>
              {Boolean(data.round) && (
                <span className="text-gray-500 text-sm"> (Round {String(data.round)})</span>
              )}
            </div>
            {controlButtons}
          </div>
          <p className="text-gray-200 mt-2 italic">&quot;{String(data.message)}&quot;</p>
          {reasoningSection}
          {promptsSection}
        </div>
      );

    case 'vote':
      return (
        <div className="p-4 bg-red-900/20 rounded-lg border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-red-300">🗳️</span>{' '}
              <span className="font-semibold text-red-200">{String(data.voter)}</span>
              <span className="text-gray-400"> votes for </span>
              <span className="font-semibold text-red-200">{String(data.target)}</span>
            </div>
            {controlButtons}
          </div>
          <p className="text-gray-500 mt-2 text-sm italic">Stated reason: {String(data.reasoning)}</p>
          {reasoningSection}
          {promptsSection}
        </div>
      );

    case 'resolution': {
      const eliminated = data.eliminated as string;
      const votes = data.votes as { voter: string; target: string }[];
      return (
        <div className="p-4 bg-orange-900/20 rounded-lg border-l-4 border-orange-500">
          <span className="text-orange-300 font-semibold">⚖️ Vote Resolution</span>
          <div className="mt-2 text-sm text-gray-400">
            {votes.map((v, i) => (
              <span key={i}>
                {v.voter} → {v.target}
                {i < votes.length - 1 && ', '}
              </span>
            ))}
          </div>
          <p className="mt-2 text-lg">
            {eliminated === 'No one' ? (
              <span className="text-gray-300">No one was eliminated (tie or no majority)</span>
            ) : (
              <>
                <span className="text-red-400 font-bold">{eliminated}</span>
                <span className="text-gray-300"> was eliminated!</span>
                {data.eliminatedRole && (
                  <span className="text-gray-400"> (was {String(data.eliminatedRole)})</span>
                )}
              </>
            )}
          </p>
        </div>
      );
    }

    case 'game_end':
      return (
        <div className="p-3 bg-emerald-900/30 rounded-lg border-l-4 border-emerald-500">
          <span className="text-emerald-300 font-semibold">🏁 Game Complete!</span>
        </div>
      );

    default:
      return null;
  }
}
