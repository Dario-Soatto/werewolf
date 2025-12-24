import { NextResponse } from 'next/server';
import { initializeGame } from '@/lib/game/step-runner';

export async function POST() {
  try {
    const { gameId, session } = initializeGame(3);
    
    // Return game ID and info about first step
    return NextResponse.json({
      gameId,
      totalSteps: session.steps.length,
      nextStepDescription: 'Show game setup',
    });
  } catch (error) {
    console.error('Failed to start game:', error);
    return NextResponse.json(
      { error: 'Failed to start game' },
      { status: 500 }
    );
  }
}

