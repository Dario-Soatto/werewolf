import { NextRequest, NextResponse } from 'next/server';
import { getGame } from '@/lib/game/store';
import { executeStep } from '@/lib/game/step-runner';

export const maxDuration = 60; // 60 seconds max for LLM call

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId } = body;
    
    if (!gameId) {
      return NextResponse.json(
        { error: 'gameId is required' },
        { status: 400 }
      );
    }
    
    const session = getGame(gameId);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    if (session.completed) {
      return NextResponse.json(
        { error: 'Game already completed' },
        { status: 400 }
      );
    }
    
    const result = await executeStep(gameId, session);
    
    return NextResponse.json({
      event: result.event,
      completed: result.completed,
      nextStepDescription: result.nextStepDescription,
      currentStep: session.stepIndex,
      totalSteps: session.steps.length,
    });
  } catch (error) {
    console.error('Failed to execute step:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

