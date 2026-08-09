import { db } from '@/lib/db'
import { getServerSession } from '@/lib/auth'
import { resolveWorkspaceAccountId } from '@/lib/tenant'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pageSlug: string }> }
) {
  const session = await getServerSession()
  const accountId = await resolveWorkspaceAccountId(session?.user?.id)

  if (!accountId) {
    return NextResponse.json({ error: 'No account found' }, { status: 404 })
  }

  const page = await db.contentPage.findUnique({
    where: {
      accountId_slug: {
        accountId,
        slug: (await params).pageSlug,
      },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      publishedAt: true,
      sections: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          slug: true,
          title: true,
          sortOrder: true,
          blocks: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              key: true,
              type: true,
              value: true,
              meta: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  })

  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  return NextResponse.json({ page })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ pageSlug: string }> }
) {
  const session = await getServerSession()
  const accountId = await resolveWorkspaceAccountId(session?.user?.id)

  if (!accountId) {
    return NextResponse.json({ error: 'No account found' }, { status: 404 })
  }

  const { pageSlug } = await params

  let body: { blocks: { id: string; value: string }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.blocks)) {
    return NextResponse.json(
      { error: 'blocks must be an array' },
      { status: 400 }
    )
  }

  // Verify the page belongs to this account AND collect valid block IDs
  const page = await db.contentPage.findUnique({
    where: {
      accountId_slug: {
        accountId,
        slug: pageSlug,
      },
    },
    select: {
      id: true,
      sections: {
        select: {
          blocks: { select: { id: true } },
        },
      },
    },
  })

  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  // Build a set of valid block IDs owned by this account's page
  const validBlockIds = new Set(
    page.sections.flatMap(s => s.blocks.map(b => b.id))
  )

  // Reject any block IDs that don't belong to this page (IDOR prevention)
  const invalidBlocks = body.blocks.filter(b => !validBlockIds.has(b.id))
  if (invalidBlocks.length > 0) {
    return NextResponse.json({ error: 'One or more block IDs are invalid' }, { status: 400 })
  }

  // Update all provided blocks in a transaction
  const updatePromises = body.blocks.map((block) =>
    db.contentBlock.update({
      where: { id: block.id },
      data: { value: block.value },
      select: {
        id: true,
        key: true,
        type: true,
        value: true,
        meta: true,
        sortOrder: true,
      },
    })
  )

  const updatedBlocks = await db.$transaction(updatePromises)

  return NextResponse.json({ blocks: updatedBlocks })
}