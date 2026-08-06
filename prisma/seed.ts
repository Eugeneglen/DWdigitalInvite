import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database (replicating production data)...');

  // ============================================================
  // 1. PLATFORM USERS
  // ============================================================
  const adminPassword = await bcrypt.hash('Admin@2024', 12);
  const admin = await db.user.upsert({
    where: { email: 'admin@dreamweavers.sg' },
    update: { role: 'SUPER_ADMIN_1', passwordHash: adminPassword },
    create: {
      email: 'admin@dreamweavers.sg',
      passwordHash: adminPassword,
      name: 'Dreamweavers Admin',
      role: 'SUPER_ADMIN_1',
      isActive: true,
    },
  });
  console.log(`✅ Admin user: ${admin.email} (${admin.role})`);

  const couplePassword = await bcrypt.hash('Couple@2024', 12);
  const couple = await db.user.upsert({
    where: { email: 'eleanor@wedding.com' },
    update: { role: 'COUPLE', passwordHash: couplePassword },
    create: {
      email: 'eleanor@wedding.com',
      passwordHash: couplePassword,
      name: 'Eleanor',
      role: 'COUPLE',
      isActive: true,
    },
  });
  console.log(`✅ Couple user: ${couple.email} (${couple.role})`);

  // 1b. Staff users — consultant (ADMIN_1) & coordinator (ADMIN_2)
  //     Needed so the Admin CMS consultant/coordinator dropdowns have options.
  const staffPassword = await bcrypt.hash('Staff@2024', 12);
  const consultant = await db.user.upsert({
    where: { email: 'consultant@dreamweavers.sg' },
    update: { role: 'CONSULTANT_1', passwordHash: staffPassword },
    create: {
      email: 'consultant@dreamweavers.sg',
      passwordHash: staffPassword,
      name: 'Sarah Chen',
      role: 'CONSULTANT_1',
      isActive: true,
    },
  });
  const coordinator = await db.user.upsert({
    where: { email: 'coordinator@dreamweavers.sg' },
    update: { role: 'COORDINATOR_1', passwordHash: staffPassword },
    create: {
      email: 'coordinator@dreamweavers.sg',
      passwordHash: staffPassword,
      name: 'Marcus Tan',
      role: 'COORDINATOR_1',
      isActive: true,
    },
  });
  console.log(`✅ Staff: ${consultant.name} (CONSULTANT_1), ${coordinator.name} (COORDINATOR_1)`);

  // ============================================================
  // 2. WEDDING #1 — Eleanor & James (ACTIVE / FREE, owned by couple)
  //    The primary demo wedding with full 9/9 content sections.
  // ============================================================
  const wedding1 = await db.weddingAccount.upsert({
    where: { slug: 'eleanor-james-2027' },
    update: { ownerId: couple.id, coupleEmail: 'eleanor@wedding.com', accountStatus: 'ACTIVE' },
    create: {
      slug: 'eleanor-james-2027',
      coupleName: 'Eleanor & James',
      brideName: 'Eleanor',
      groomName: 'James',
      weddingDate: new Date('2027-12-25T16:00:00'),
      weddingTime: '16:00',
      venue: 'The Fullerton Hotel',
      venueAddress: '38 Cuscaden Road, Singapore 249731',
      googleMapsUrl: 'https://maps.google.com/?q=1.3066+103.8290',
      status: 'ACTIVE',
      plan: 'FREE',
      accountStatus: 'ACTIVE',
      coupleEmail: 'eleanor@wedding.com',
      heroImageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBeAe38AA5-0h4B5MmgQCqv54oQXyPMGznDKaw2sJI_FnTbB_yXXWOpirFlFycj_2VI02IVLouUTt86Y1J7Ls-bRsMOHPAcfSqruVoh87sfhw3vi2Z6t1C7ogCLtkvF6QbJkwuV0av8pXTrUeAAi6ymnZpvyOr8qVjTNNorAOmqRrW_fohX_xlkscmBh39K4Wtvs6TH0Nvb_X3LQQRD9W_sySN_iWbWw9O0au8u1jO-hSekE9pSGNo5zsTz3o9PWy5xbzc6lq3knkIy',
      bannerUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-OyKfcsxXAmZDArHbDXl1cVCgGUG5liFPzyHdVvMG6_4jN9pNTrN9GCrkdnegli9UPJUSPs39KJRsRP7AiLem4xYS-q1ZYq1T3DAIqyvn3wAvbdkoMVkufft0SpQw4gDTPSnIml6k62lRYobUrNu70UGIILiMZQ0fAydTXXwVZ1oswQZ-mjPT8H9mDDqfhxsMSI5zla8GKz_ILXbmdRjtRUk682dPEDBD6I81DzEx7dITgjb6vxQoee5599jkYf_vCYP7npydvxqx',
      ownerId: couple.id,
    },
  });
  console.log(`✅ Wedding #1: ${wedding1.coupleName} (${wedding1.slug}) — ${wedding1.status}/${wedding1.plan}`);

  // ============================================================
  // 3. WEDDING #2 — Eleanor @ James (DRAFT / FREE, unowned)
  //    Created via admin Wedding Creation Wizard on production.
  // ============================================================
  const wedding2 = await db.weddingAccount.upsert({
    where: { slug: 'eleanor-james-2027-12-25' },
    update: {},
    create: {
      slug: 'eleanor-james-2027-12-25',
      coupleName: 'Eleanor @ James',
      brideName: 'Eleanor',
      groomName: 'James',
      weddingDate: new Date('2027-12-25T00:00:00'),
      venueAddress: '38 Cuscaden Road, Singapore 249731',
      status: 'DRAFT',
      plan: 'FREE',
      accountStatus: 'ONBOARDING',
    },
  });
  console.log(`✅ Wedding #2: ${wedding2.coupleName} (${wedding2.slug}) — ${wedding2.status}/${wedding2.plan}`);

  // ============================================================
  // 4. WEDDING #3 — Eugene & Veron (DRAFT / PREMIUM, unowned)
  //    Created via admin Wedding Creation Wizard on production.
  // ============================================================
  const wedding3 = await db.weddingAccount.upsert({
    where: { slug: 'eugene-veron-2028-12-12' },
    update: {},
    create: {
      slug: 'eugene-veron-2028-12-12',
      coupleName: 'Eugene & Veron',
      brideName: 'Veron',
      groomName: 'Eugene',
      weddingDate: new Date('2028-12-12T00:00:00'),
      venueAddress: 'Sentosa',
      status: 'DRAFT',
      plan: 'PREMIUM',
      accountStatus: 'ONBOARDING',
    },
  });
  console.log(`✅ Wedding #3: ${wedding3.coupleName} (${wedding3.slug}) — ${wedding3.status}/${wedding3.plan}`);

  // ============================================================
  // 4b. USER_WEDDING_ROLE — Per-wedding role assignments (Tier 2 + Tier 3)
  //     Mirrors the ownerId FK into the new UserWeddingRole junction table
  //     so the new permission layer (Phase 3) has data to read.
  //     Existing ownerId/consultantId/coordinatorId FKs are kept for
  //     backward compatibility until Phase 3c cleanup.
  // ============================================================
  const weddingRoleAssignments = [
    { userId: couple.id, weddingId: wedding1.id, role: 'COUPLE' as const },
    // Weddings #2 and #3 are unowned (no ownerId) — no role rows needed
  ];

  for (const a of weddingRoleAssignments) {
    await db.userWeddingRole.upsert({
      where: { userId_weddingId_role: { userId: a.userId, weddingId: a.weddingId, role: a.role } },
      update: {},
      create: { userId: a.userId, weddingId: a.weddingId, role: a.role },
    });
  }
  console.log(`✅ UserWeddingRole: ${weddingRoleAssignments.length} role assignments seeded`);

  // ============================================================
  // 5. FEATURES — Wedding #1 gets all 11 features enabled.
  //    Weddings #2 and #3 get the 10 default wizard features.
  // ============================================================
  const w1Features = ['countdown', 'schedule', 'rsvp', 'story', 'gallery', 'wishes', 'getting-there', 'qa', 'moments', 'music', 'video', 'templates'];
  const wizardFeatures = ['countdown', 'schedule', 'rsvp', 'getting-there', 'music', 'gallery', 'story', 'wishes', 'qa', 'moments'];

  for (const key of w1Features) {
    await db.weddingFeature.upsert({
      where: { weddingId_featureKey: { weddingId: wedding1.id, featureKey: key } },
      update: { isEnabled: true },
      create: { weddingId: wedding1.id, featureKey: key, isEnabled: true },
    });
  }
  for (const w of [wedding2, wedding3]) {
    for (const key of wizardFeatures) {
      await db.weddingFeature.upsert({
        where: { weddingId_featureKey: { weddingId: w.id, featureKey: key } },
        update: { isEnabled: true },
        create: { weddingId: w.id, featureKey: key, isEnabled: true },
      });
    }
  }
  console.log(`✅ Features: ${w1Features.length} for wedding #1, ${wizardFeatures.length} each for #2 & #3`);

  // ============================================================
  // 6. CONTENT — Wedding #1: full 10/10 content sections (matches production)
  //    Sections: global, hero, schedule, getting-there, story, qa, wishes,
  //              moments, tea-ceremony
  // ============================================================
  await db.weddingContent.deleteMany({ where: { weddingId: wedding1.id } });

  const contentItems: Array<{ section: string; fieldKey: string; fieldValue: string; fieldType: string }> = [
    // ── global ──
    { section: 'global', fieldKey: 'backgroundColor', fieldValue: '#FCF9F2', fieldType: 'TEXT' },

    // ── hero ──
    { section: 'hero', fieldKey: 'title', fieldValue: 'Eleanor & James', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'subtitle', fieldValue: 'Together with their families, request the pleasure of your company', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'description', fieldValue: 'We invite you to share in our joy as we begin our forever together.', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'dateDisplay', fieldValue: 'Saturday, 25th December 2027', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'fontFamily', fieldValue: 'Playfair Display', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'narrativeLabel', fieldValue: 'The Prelude', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'narrativeTitle', fieldValue: 'Our Story Begins Here', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'narrativeBody', fieldValue: 'Every great romance is a narrative woven over time. Ours began with a serendipitous meeting and has evolved into a tapestry of shared adventures, quiet moments, and a profound commitment to one another.', fieldType: 'RICHTEXT' },
    { section: 'hero', fieldKey: 'teaCeremonyLabel', fieldValue: 'The Tradition', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'teaCeremonyTitle', fieldValue: 'The Tea Ceremony', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'teaCeremonyBody', fieldValue: 'A sacred tradition where we honour our elders with tea, receiving their blessings for a lifetime of happiness together.', fieldType: 'RICHTEXT' },
    { section: 'hero', fieldKey: 'teaCeremonyImage', fieldValue: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA6SiJt49KQCmMAhF-X_tmX1Y1NKhTieT6ApO53PD9gYuvLO0e78WTxzg8BV7Wnhe6oJ6', fieldType: 'TEXT' },

    // ── schedule ──
    { section: 'schedule', fieldKey: 'title', fieldValue: 'The Day', fieldType: 'TEXT' },
    { section: 'schedule', fieldKey: 'subtitle', fieldValue: 'The Celebration', fieldType: 'TEXT' },

    // ── getting-there (the section that was missing locally → completes 9/9) ──
    { section: 'getting-there', fieldKey: 'title', fieldValue: 'Getting There', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'subtitle', fieldValue: 'Find your way to our celebration', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'venueDescription', fieldValue: 'The Fullerton Hotel is a historic landmark in the heart of Singapore, blending colonial architecture with modern luxury.', fieldType: 'RICHTEXT' },
    { section: 'getting-there', fieldKey: 'transitTitle', fieldValue: 'Public Transit', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'transitContent', fieldValue: 'MRT\nOrchard Boulevard MRT Station (TE13)\n\nApproximately 4–5 minutes\' walk to the venue.\n\nOrchard MRT Station (NS22/TE14)\n\nApproximately 8–10 minutes\' walk to the venue.\n\nBUS\nGuests may alight at Bef Tomlinson Rd (09121) or Opp Four Seasons Hotel (09111), both of which are about a 2-minute walk from the venue.\n\nAvailable bus services: 7, 36, 36A, 36B, 77, 105, 106, 111, 123, 132, 174, and 174e.', fieldType: 'RICHTEXT' },
    { section: 'getting-there', fieldKey: 'carTitle', fieldValue: 'By Car', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'carContent', fieldValue: '\nFROM THE AIRPORT\nVia CTE / Orchard Road, the journey from Singapore Changi Airport is approximately 25–30 minutes, subject to traffic conditions.', fieldType: 'RICHTEXT' },
    { section: 'getting-there', fieldKey: 'parkingNote', fieldValue: 'PARKING\nValet parking is available at the hotel entrance. Alternatively, guests may utilise the hotel\'s basement car park, subject to availability.\n\nKindly inform the concierge that you are attending the Dreamweavers event.\n', fieldType: 'TEXT' },

    // ── story ──
    { section: 'story', fieldKey: 'title', fieldValue: 'Our Story', fieldType: 'TEXT' },
    { section: 'story', fieldKey: 'subtitle', fieldValue: 'The Prelude', fieldType: 'TEXT' },
    { section: 'story', fieldKey: 'intro', fieldValue: 'Every great romance is a narrative woven over time. Ours began with a serendipitous meeting and has evolved into a tapestry of shared adventures, quiet moments, and a profound commitment to one another.', fieldType: 'RICHTEXT' },

    // ── qa ──
    { section: 'qa', fieldKey: 'title', fieldValue: 'Questions & Answers', fieldType: 'TEXT' },

    // ── wishes ──
    { section: 'wishes', fieldKey: 'title', fieldValue: 'Wishes', fieldType: 'TEXT' },
    { section: 'wishes', fieldKey: 'subtitle', fieldValue: 'Weave Your Blessing Into Our Archive', fieldType: 'TEXT' },

    // ── moments ──
    { section: 'moments', fieldKey: 'title', fieldValue: 'Moments', fieldType: 'TEXT' },
    { section: 'moments', fieldKey: 'subtitle', fieldValue: 'The Journey Before the I Do—from childhood dreams to our first steps together.', fieldType: 'TEXT' },

    // ── tea-ceremony ──
    { section: 'tea-ceremony', fieldKey: 'title', fieldValue: 'The Tea Ceremony', fieldType: 'TEXT' },
    { section: 'tea-ceremony', fieldKey: 'label', fieldValue: 'The Tradition', fieldType: 'TEXT' },

    // ── rsvp (guest-facing form text) ──
    { section: 'rsvp', fieldKey: 'deadline', fieldValue: '', fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'thankYouMessage', fieldValue: "Your RSVP has been received. We can't wait to celebrate with you, {name}!", fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'declinedMessage', fieldValue: "We're sorry you can't make it, {name}. Your kind response means a lot to us.", fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'ceremonyName', fieldValue: 'Wedding Solemnisation', fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'optYes', fieldValue: 'Yes!', fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'optPartial', fieldValue: "Yes, but I won't be staying for the reception", fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'optNo', fieldValue: "I'm sorry, I won't be able to make it", fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'dietaryOptions', fieldValue: 'Halal,Vegetarian,No Seafood', fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'step0Title', fieldValue: 'Enter your name to RSVP', fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'step0Subtext', fieldValue: 'You can respond for more guests in the following steps.', fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'step1Title', fieldValue: 'How many people are in your party?', fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'step2Title', fieldValue: 'Confirm each guest and their dietary needs.', fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'step2Subtext', fieldValue: 'Dietary selections are optional.', fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'resultThankYou', fieldValue: 'Thank you', fieldType: 'TEXT' },
    { section: 'rsvp', fieldKey: 'resultWeMissYou', fieldValue: "We'll Miss You", fieldType: 'TEXT' },
  ];

  for (const item of contentItems) {
    await db.weddingContent.create({
      data: { weddingId: wedding1.id, ...item },
    });
  }
  console.log(`✅ ${contentItems.length} content items across 10 sections seeded`);

  // ============================================================
  // 7. SCHEDULE — Wedding #1 (4 events, matches production)
  // ============================================================
  await db.eventSchedule.deleteMany({ where: { weddingId: wedding1.id } });
  const scheduleItems = [
    { eventType: 'TEA_CEREMONY', title: 'Tea Ceremony', description: 'Traditional tea ceremony with both families', startTime: '10:00', endTime: '12:00', location: 'Bride\'s Residence', sortOrder: 1 },
    { eventType: 'CEREMONY', title: 'Wedding Ceremony', description: 'Exchange of vows and rings', startTime: '16:00', endTime: '17:00', location: 'The Fullerton Hotel — Grand Ballroom', sortOrder: 2 },
    { eventType: 'RECEPTION', title: 'Cocktail Reception', description: 'Drinks and canapés by the poolside', startTime: '17:00', endTime: '18:00', location: 'The Fullerton Hotel — Poolside Terrace', sortOrder: 3 },
    { eventType: 'DINNER', title: 'Wedding Dinner', description: 'Eight-course Chinese banquet dinner', startTime: '18:00', endTime: '22:00', location: 'The Fullerton Hotel — Grand Ballroom', sortOrder: 4 },
  ];
  for (const item of scheduleItems) {
    await db.eventSchedule.create({ data: { weddingId: wedding1.id, ...item } });
  }
  console.log(`✅ ${scheduleItems.length} schedule items seeded`);

  // ============================================================
  // 8. FAQs — Wedding #1 (6 FAQs, matches production)
  // ============================================================
  await db.fAQ.deleteMany({ where: { weddingId: wedding1.id } });
  const faqs = [
    { question: 'What is the dress code?', answer: 'The dress code is formal / black tie. We kindly request guests to avoid wearing white.', sortOrder: 1 },
    { question: 'Can I bring a plus one?', answer: 'Your invitation will indicate whether a plus one is included. If you\'re unsure, please reach out to us.', sortOrder: 2 },
    { question: 'Is parking available?', answer: 'Yes, complimentary valet parking is available at The Fullerton Hotel. Self-parking is also available at $6/hour.', sortOrder: 3 },
    { question: 'Are children welcome?', answer: 'We love your little ones! However, due to venue restrictions, this will be an adults-only celebration.', sortOrder: 4 },
    { question: 'Can I take photos during the ceremony?', answer: 'We kindly request an unplugged ceremony. A professional photographer will capture every moment, and we\'ll share the photos with you afterwards.', sortOrder: 5 },
    { question: 'Where can I stay nearby?', answer: 'We\'ve arranged special rates at The Fullerton Hotel and several nearby hotels. Please contact us for the booking links.', sortOrder: 6 },
  ];
  for (const faq of faqs) {
    await db.fAQ.create({ data: { weddingId: wedding1.id, ...faq } });
  }
  console.log(`✅ ${faqs.length} FAQs seeded`);

  // ============================================================
  // 9. STORIES — Wedding #1 (4 chapters with images, matches production)
  // ============================================================
  await db.storyItem.deleteMany({ where: { weddingId: wedding1.id } });
  const stories = [
    { title: 'How We Met', content: 'It was a rainy Tuesday at a cozy bookstore in Chinatown. Both reaching for the same worn copy of "Love in the Time of Cholera," our hands touched, and the rest of the world faded away. We spent three hours talking over coffee that day, and neither of us wanted to leave.', date: 'March 2023', sortOrder: 1, imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAQPSczTWgJLZS_vzNbN6wuPsTVw72YpOY0ldIaXb2nEM0DjbAoH__IyOfEvlXkIvif3k6TiVwdgbsAPvCUuustCXJ5ogM8o9Mf8qfnHNM052duEcCK8KPbJVfqn8sOuo9cpUPx6XWqHpBxvEfinvKzqiiI7zy3XkVYQ7w0ElfPw1kVlE-oTiwbdti2a6Q3pUBuogYx0KyKtviULD2olRj3ZTd29I37Yi80hUtQtS9LWTuKEtFJvAKUdLp2wmjdEM8om4Ku67LEDI4t' },
    { title: 'The First Date', content: 'James planned an elaborate dinner at a hidden omakase bar. Eleanor showed up 20 minutes late (she\'ll deny it), but the sushi was worth the wait. By dessert, we both knew this was something special.', date: 'April 2023', sortOrder: 2, imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAm-8WDgkq_3PeNjdM4_SPcbdyPc4j1BN1NYWpstlUalLgRDkOi-VrJG2ZcdDt04YwBhlSegxOEQ4dbw-6zr2xKHQeTO5gJe67RlcYJ2IkUn3Dp8ZbTzfL8aD2Tq8rbse4QsZBGuz1fOPmW42rjorV-F8aY14aRHg_wk_TAMAaeqaBllL8Qpx_POk9EP9b5wjS_YXtMBnKH7-nGAPwIbuNCwetnkUm6A1gonIw4KTEsPRqq2sW_1A3jAX6wnSIeZTPdzM3VYkva56VG' },
    { title: 'Adventures Together', content: 'From hiking the trails of Bukit Timah at dawn to getting lost in the streets of Kyoto during cherry blossom season, every adventure with you has been my favorite chapter. Here\'s to a thousand more.', date: '2023–2024', sortOrder: 3, imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAaySYsDYGyX6N9CoV24yS9bjuLYqQWIJwG8qS2qCMj2do69ncL22s286MrboC8HGtgl1tP6_JTj85seIO4TolelvHDIqTInWBTwFyuk_MJZN0a5w6P0QX4AQUVLx2oCOPDelyGCdOmRviKG1bD4nqPr3zkgUKWgXNmnGP5a0b4U2k-nDG2Hl_lDM2moRehiYXKnwB872KgPkaI7Br6uq1DHIKKb34AY9ybXoB9pT-x3W5PKHguLL3DaI6VsnfHWT18OAeoVAgwQsvH' },
    { title: 'The Proposal', content: 'Under a canopy of fairy lights at Gardens by the Bay, James got down on one knee. Eleanor said yes before he could finish the question. It was perfect — just like us.', date: 'December 2024', sortOrder: 4, imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBzzvAxvGICtmDJ5Ase_8SKR0gvAAqXe_96pLSdSUEjYyVgenag3qekxDbjpLG_SXknWJEoOXPP_XcdU4WMSloZvzj9Pn-dxdG0BBlp0lglCSzzoxLL3-2CaKrawuVRqBglPiiimHDNTlMHai2pnrr404Xg8EgQq8tdW5qRhs-bx2k6N52M80DDUW27KtR0Nc4-WkNjwCsNX8XuiyHBZTqdhpBqml323YRMNj-0offH-_Sn3jp1yxw-EAZs939pzoyGzEfpRwsteoXv' },
  ];
  for (const story of stories) {
    await db.storyItem.create({ data: { weddingId: wedding1.id, ...story } });
  }
  console.log(`✅ ${stories.length} story items seeded`);

  // ============================================================
  // 10. MEDIA — Wedding #1 moments gallery (5 images, matches production)
  // ============================================================
  await db.weddingMedia.deleteMany({ where: { weddingId: wedding1.id } });
  const mediaItems = [
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAm-8WDgkq_3PeNjdM4_SPcbdyPc4j1BN1NYWpstlUalLgRDkOi-VrJG2ZcdDt04YwBhlSegxOEQ4dbw-6zr2xKHQeTO5gJe67RlcYJ2IkUn3Dp8ZbTzfL8aD2Tq8rbse4QsZBGuz1fOPmW42rjorV-F8aY14aRHg_wk_TAMAaeqaBllL8Qpx_POk9EP9b5wjS_YXtMBnKH7-nGAPwIbuNCwetnkUm6A1gonIw4KTEsPRqq2sW_1A3jAX6wnSIeZTPdzM3VYkva56VG', fileName: 'Moments1.jpg', fileType: 'IMAGE', category: 'moments', sortOrder: 1 },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAaySYsDYGyX6N9CoV24yS9bjuLYqQWIJwG8qS2qCMj2do69ncL22s286MrboC8HGtgl1tP6_JTj85seIO4TolelvHDIqTInWBTwFyuk_MJZN0a5w6P0QX4AQUVLx2oCOPDelyGCdOmRviKG1bD4nqPr3zkgUKWgXNmnGP5a0b4U2k-nDG2Hl_lDM2moRehiYXKnwB872KgPkaI7Br6uq1DHIKKb34AY9ybXoB9pT-x3W5PKHguLL3DaI6VsnfHWT18OAeoVAgwQsvH', fileName: 'Moments2.jpg', fileType: 'IMAGE', category: 'moments', sortOrder: 2 },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCSIFjFy2YecMgyEcWPUwcxc0x0aeave6t83lRr', fileName: 'Moments3.jpg', fileType: 'IMAGE', category: 'moments', sortOrder: 3 },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC8RAoFnH7L9tFmSjN3sfNRhKNcQZhi5ysusn41', fileName: 'Moments4.jpg', fileType: 'IMAGE', category: 'moments', sortOrder: 4 },
    { url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZxkwieg-SjxgRYOZxJlQ1v05okmlTqzvosp-A', fileName: 'Moments5.jpg', fileType: 'IMAGE', category: 'moments', sortOrder: 5 },
  ];
  for (const m of mediaItems) {
    await db.weddingMedia.create({ data: { weddingId: wedding1.id, ...m } });
  }
  console.log(`✅ ${mediaItems.length} media items (moments) seeded`);

  // ============================================================
  // 11. RSVPs — 3 submissions (matches production exactly)
  //     #1 Jerine Lim (party 2, both attending) → wedding #1
  //     #2 Eugene Lim (party 2, mixed) → no wedding (orphaned, as on prod)
  //     #3 Eugene Lim (party 1, attending) → no wedding (orphaned, as on prod)
  // ============================================================
  await db.guestResponse.deleteMany({});
  await db.rSVPSubmission.deleteMany({});

  const rsvp1 = await db.rSVPSubmission.create({
    data: {
      firstName: 'Jerine',
      lastName: 'Lim',
      partySize: 2,
      weddingId: wedding1.id,
      createdAt: new Date('2026-07-15T03:18:21.038Z'),
      guests: {
        create: [
          { name: 'Jerine Lim', attendance: 'yes' },
          { name: 'Boon thien', attendance: 'yes' },
        ],
      },
    },
  });

  const rsvp2 = await db.rSVPSubmission.create({
    data: {
      firstName: 'Lim',
      lastName: 'Eugene',
      partySize: 2,
      weddingId: null,
      createdAt: new Date('2026-07-12T12:00:56.864Z'),
      guests: {
        create: [
          { name: 'Lim Eugene', attendance: 'yes' },
          { name: 'Guest 2', attendance: 'yes' },
        ],
      },
    },
  });

  const rsvp3 = await db.rSVPSubmission.create({
    data: {
      firstName: 'Eugene',
      lastName: 'Lim',
      partySize: 2,
      weddingId: wedding1.id,
      createdAt: new Date('2026-07-08T09:33:11.019Z'),
      guests: {
        create: [
          { name: 'Eugene Lim', attendance: 'no' },
          { name: 'Guest 2', attendance: 'yes' },
        ],
      },
    },
  });
  console.log(`✅ 3 RSVPs seeded (Jerine Lim, Lim Eugene, Eugene Lim)`);
  void rsvp1; void rsvp2; void rsvp3;

  // ============================================================
  // 12. WISHES — 1 wish (matches production exactly)
  //     "Lim" (Friend): "Cngrats" — orphaned (no weddingId), as on prod
  // ============================================================
  await db.wish.deleteMany({});
  await db.wish.create({
    data: {
      name: 'Lim',
      relationship: 'Friend',
      message: 'Cngrats',
      weddingId: null,
      createdAt: new Date('2026-07-12T12:01:44.933Z'),
    },
  });
  console.log(`✅ 1 wish seeded (Lim — "Cngrats")`);

  // ============================================================
  // 13. PLATFORM SETTINGS — package templates + config (matches production)
  // ============================================================
  const platformSettings = [
    { key: 'default_couple_password', value: 'Couple@123' },
    { key: 'couple_access_expiry_days', value: '30' },
    { key: 'expiry_notification_days', value: '7' },
    { key: 'default_plan', value: 'GOLD' },
    { key: 'default_wedding_status', value: 'DRAFT' },
    // Mark Classic Elegance as the global default template (used by the
    // Couple CMS Design page and the Admin CMS Content Templates page).
    { key: 'default_template', value: 'classic-elegance' },
    {
      key: 'package_templates',
      value: JSON.stringify([
        { name: 'GOLD', label: 'Gold', features: ['countdown', 'schedule', 'rsvp', 'getting-there'], maxGuests: 100, maxMedia: 20, sortOrder: 1 },
        { name: 'PLATINUM', label: 'Platinum', features: ['countdown', 'schedule', 'rsvp', 'getting-there', 'story', 'qa'], maxGuests: 200, maxMedia: 50, sortOrder: 2 },
        { name: 'DIAMOND', label: 'Diamond', features: ['countdown', 'schedule', 'rsvp', 'getting-there', 'story', 'wishes', 'qa', 'moments'], maxGuests: 500, maxMedia: 100, sortOrder: 3 },
      ]),
    },
  ];
  for (const setting of platformSettings) {
    await db.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`✅ ${platformSettings.length} platform settings seeded (package templates, couple password, expiry config)`);

  console.log('\n🎉 Seed complete! (replicates production data)');
  console.log('---');
  console.log('Admin login: admin@dreamweavers.sg / Admin@2024');
  console.log('Couple login: eleanor@wedding.com / Couple@2024');
  console.log('---');
  console.log('Weddings: 3 (1 ACTIVE + 2 DRAFT)');
  console.log('RSVPs: 3 (Jerine Lim, Lim Eugene, Eugene Lim)');
  console.log('Wishes: 1 (Lim — "Cngrats")');
  console.log('Content sections: 10/10 (including rsvp)');

  await db.$disconnect();
}

// Exit 0 on success, exit 1 on failure — so the Dockerfile CMD `&&` chain
// stops (and the server does NOT start) when seeding genuinely fails, instead
// of silently continuing with an empty database.
seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
