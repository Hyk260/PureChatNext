import { NextResponse } from 'next/server'

export const devError = (error: string, status = 400) => {
  return NextResponse.json({ error, success: false }, { status })
}

export const devActionSuccess = (action: string, result: unknown) => {
  return NextResponse.json({ action, result, success: true }, { status: 200 })
}

export const getErrorMessage = (error: unknown, fallback = 'Internal server error') => {
  return error instanceof Error ? error.message : fallback
}
