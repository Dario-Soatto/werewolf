import { NextResponse } from 'next/server';
import { initializeGame } from '@/lib/game/step-runner';

export async function POST() {
  try {
    const session = initializeGame(3);
    
    return NextResponse.json({
      session,
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
