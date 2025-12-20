import { NextResponse } from 'next/server';

export async function GET() {
  console.log('Frontend healthcheck hit');
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
