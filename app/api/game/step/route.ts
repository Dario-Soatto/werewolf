import { NextRequest, NextResponse } from 'next/server';
import { executeStep } from '@/lib/game/step-runner';
import { GameSession } from '@/lib/game/store';

export const maxDuration = 60; // 60 seconds max for LLM call

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session } = body as { session: GameSession };
    
    if (!session) {
      return NextResponse.json(
        { error: 'session is required' },
        { status: 400 }
      );
    }
    
    if (session.completed) {
      return NextResponse.json(
        { error: 'Game already completed' },
        { status: 400 }
      );
    }
    
    const result = await executeStep(session);
    
    return NextResponse.json({
      session: result.session,
      event: result.event,
      completed: result.completed,
      nextStepDescription: result.nextStepDescription,
      currentStep: result.session.stepIndex,
      totalSteps: result.session.steps.length,
    });
  } catch (error) {
    console.error('Failed to execute step:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
