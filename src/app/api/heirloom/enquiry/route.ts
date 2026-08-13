import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const enquirySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().default(''),
  message: z.string().min(1, 'Message is required'),
})

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const { success, resetAt } = rateLimit(`heirloom-enquiry:${ip}`, 3, 60_000)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many messages. Please try again shortly.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = enquirySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, email, phone, message } = parsed.data

    await db.contactSubmission.create({
      data: {
        name,
        email,
        contact: phone || null,
        reason: `[Heirloom Enquiry] ${message}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
