'use client';

import { useState, Suspense, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;

// Steps: 0=Name, 1=Party Size, 2=Guest Details, 3=Attendance

interface Guest {
  name: string;
  dietary: string[];
  attendance?: string;
  responded: boolean;
}

const DIETARY_OPTIONS_DEFAULT = ['Halal', 'Vegetarian', 'No Seafood'];

const ATTENDANCE_OPTIONS_DEFAULT = [
  { val: 'yes', label: 'Yes!' },
  { val: 'partial', label: "Yes, but I won't be staying for the reception" },
  { val: 'no', label: "I'm sorry, I won't be able to make it" },
];

type RSVPResult = 'all-attending' | 'all-declined' | 'mixed';

export default function RSVPPage() {
  return (
    <Suspense>
      <RSVPPageInner />
    </Suspense>
  );
}

function RSVPPageInner() {
  const searchParams = useSearchParams();
  const { data, getField } = usePublicWedding(useWeddingSlug());

  // CMS content with fallbacks
  const coupleName = data?.wedding.coupleName || 'Eleanor & James';
  const venue = data?.wedding.venue || 'The Singapore EDITION';
  const venueAddress = data?.wedding.venueAddress || '38 Cuscaden Road';
  const weddingId = data?.wedding.id;
  const rsvpDeadline = getField('rsvp', 'deadline', '');
  const rsvpThankYou = getField('rsvp', 'thankYouMessage', '');
  const rsvpDeclined = getField('rsvp', 'declinedMessage', '');
  const ceremonyName = getField('rsvp', 'ceremonyName', 'Wedding Solemnisation');
  const optYes = getField('rsvp', 'optYes', 'Yes!');
  const optPartial = getField('rsvp', 'optPartial', "Yes, but I won't be staying for the reception");
  const optNo = getField('rsvp', 'optNo', "I'm sorry, I won't be able to make it");
  const dietaryOptions = getField('rsvp', 'dietaryOptions', 'Halal,Vegetarian,No Seafood').split(',').map(s => s.trim()).filter(Boolean);
  const step0Title = getField('rsvp', 'step0Title', 'Enter your name to RSVP');
  const step0Subtext = getField('rsvp', 'step0Subtext', 'You can respond for more guests in the following steps.');
  const step1Title = getField('rsvp', 'step1Title', 'How many people are in your party?');
  const step2Title = getField('rsvp', 'step2Title', 'Confirm each guest and their dietary needs.');
  const step2Subtext = getField('rsvp', 'step2Subtext', 'Dietary selections are optional.');
  const resultThankYou = getField('rsvp', 'resultThankYou', 'Thank you');
  const resultDeclined = getField('rsvp', 'resultWeMissYou', "We'll Miss You");

  const DIETARY_OPTIONS = dietaryOptions.length > 0 ? dietaryOptions : DIETARY_OPTIONS_DEFAULT;
  const ATTENDANCE_OPTIONS = [
    { val: 'yes', label: optYes },
    { val: 'partial', label: optPartial },
    { val: 'no', label: optNo },
  ];

  // Parse URL params for auto-fill
  const autoFill = useMemo(() => {
    const paramFirst = searchParams.get('first');
    const paramLast = searchParams.get('last');
    const paramName = searchParams.get('name');
    const paramParty = searchParams.get('party');

    let first = '';
    let last = '';
    let party = 1;

    if (paramFirst && paramLast) {
      first = paramFirst;
      last = paramLast;
    } else if (paramName) {
      const parts = paramName.trim().split(/\s+/);
      first = parts[0] || '';
      last = parts.slice(1).join(' ') || '';
    }

    if (paramParty) {
      const n = parseInt(paramParty, 10);
      if (!isNaN(n) && n >= 1 && n <= 10) party = n;
    }

    return { first, last, party };
  }, [searchParams]);

  const [step, setStep] = useState(0);
  const [partySize, setPartySize] = useState(autoFill.party);
  const [guests, setGuests] = useState<Guest[]>([{ name: '', dietary: [], responded: false }]);
  const [currentGuestIndex, setCurrentGuestIndex] = useState(0);
  const [attendance, setAttendance] = useState('');
  const [result, setResult] = useState<RSVPResult | null>(null);
  const [firstName, setFirstName] = useState(autoFill.first);
  const [lastName, setLastName] = useState(autoFill.last);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const submitStep1 = () => {
    if (!firstName.trim() || !lastName.trim()) return;
    const fullName = firstName.trim() + ' ' + lastName.trim();
    const updated = [...guests];
    if (updated.length === 0) {
      updated.push({ name: fullName, dietary: [], responded: false });
    } else {
      updated[0] = { ...updated[0], name: fullName };
    }
    setGuests(updated);
    setStep(1);
  };

  const submitStep2 = () => {
    let updated = [...guests];
    while (updated.length < partySize) {
      updated.push({ name: 'Guest ' + (updated.length + 1), dietary: [], responded: false });
    }
    updated = updated.slice(0, partySize);
    setGuests(updated);
    setStep(2);
  };

  const changeParty = (delta: number) => {
    setPartySize((p) => Math.max(1, Math.min(10, p + delta)));
  };

  const updateGuestName = (i: number, val: string) => {
    setGuests((g) => {
      const updated = [...g];
      updated[i] = { ...updated[i], name: val };
      return updated;
    });
  };

  const toggleDietary = (guestIdx: number, option: string) => {
    setGuests((g) => {
      const updated = [...g];
      const current = updated[guestIdx].dietary;
      updated[guestIdx] = {
        ...updated[guestIdx],
        dietary: current.includes(option)
          ? current.filter((d) => d !== option)
          : [...current, option],
      };
      return updated;
    });
  };

  const addGuest = () => {
    if (partySize >= 10) return;
    setGuests((g) => [...g, { name: '', dietary: [], responded: false }]);
    setPartySize((p) => Math.min(10, p + 1));
  };

  // Step 2 → Step 3: start per-guest attendance flow
  const goToStep3 = () => {
    const firstUnresponded = guests.findIndex((g) => !g.responded);
    if (firstUnresponded !== -1) {
      setCurrentGuestIndex(firstUnresponded);
      setAttendance(guests[firstUnresponded].attendance || '');
      setStep(3);
    }
  };

  const submitGuestResponse = useCallback(async () => {
    if (!attendance) return;

    // Build the updated guests array immediately for computation
    const updatedGuests = guests.map((g, idx) =>
      idx === currentGuestIndex
        ? { ...g, attendance, responded: true }
        : g
    );
    setGuests(updatedGuests);

    // Find next unresponded guest
    const next = updatedGuests.findIndex((g2, idx) => idx !== currentGuestIndex && !g2.responded);
    if (next !== -1) {
      setTimeout(() => {
        setCurrentGuestIndex(next);
        setAttendance(updatedGuests[next].attendance || '');
      }, 50);
    } else {
      // All responded — compute result and submit
      const validGuests = updatedGuests.filter((g) => g.name.trim());
      const attending = validGuests.filter((g) => g.attendance === 'yes' || g.attendance === 'partial');
      const declined = validGuests.filter((g) => g.attendance === 'no');

      let rsvpResult: RSVPResult = 'all-attending';
      if (attending.length === 0 && declined.length > 0) {
        rsvpResult = 'all-declined';
      } else if (declined.length > 0 && attending.length > 0) {
        rsvpResult = 'mixed';
      }

      setSubmitting(true);
      setSubmitError('');

      try {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            partySize: updatedGuests.length,
            guests: validGuests.map((g) => ({
              name: g.name.trim(),
              attendance: g.attendance || 'no',
              dietary: g.dietary.length > 0 ? g.dietary.join(', ') : undefined,
            })),
            weddingId: weddingId,
          }),
        });

        if (!res.ok) {
          throw new Error('Submission failed');
        }
      } catch {
        setSubmitError('Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      setResult(rsvpResult);
    }
  }, [attendance, guests, currentGuestIndex, firstName, lastName, weddingId]);

  if (result) {
    const validGuests = guests.filter((g) => g.name.trim());
    const attending = validGuests.filter((g) => g.attendance === 'yes' || g.attendance === 'partial');
    const declined = validGuests.filter((g) => g.attendance === 'no');
    const attendingCount = attending.length;
    const totalCount = validGuests.length;

    // Determine which name to personalize the message with
    const primaryGuest = validGuests[0]?.name?.trim().split(' ')[0] || 'there';
    const declinedNames = declined.map((g) => g.name.trim().split(' ')[0]).filter(Boolean);
    const attendingNames = attending.map((g) => g.name.trim().split(' ')[0]).filter(Boolean);

    // Build personalized message based on result
    let title = resultThankYou;
    let icon = 'favorite';
    let message = '';

    if (result === 'all-declined') {
      title = resultDeclined;
      icon = 'mail';
      if (totalCount === 1) {
        message = rsvpDeclined
          ? rsvpDeclined.replace('{name}', primaryGuest)
          : `We\'re sorry you can\'t make it, ${primaryGuest}. Your kind response means a lot to us \u2014 we\'ll keep you in our thoughts and share the joy of the day with you in spirit.`;
      } else {
        const nameList = declinedNames.join(' & ');
        message = rsvpDeclined
          ? rsvpDeclined.replace('{name}', nameList)
          : `We\'re sorry ${nameList} can\'t make it. Your kind responses mean a lot to us \u2014 we\'ll keep you in our thoughts and share the joy of the day with you in spirit.`;
      }
    } else if (result === 'mixed') {
      title = 'Thank you';
      icon = 'favorite';
      const dList = declinedNames.join(' & ');
      const aList = attendingNames.join(' & ');
      message = rsvpThankYou
        ? rsvpThankYou.replace('{name}', aList)
        : `We\'re sorry ${dList} can\'t make it, but we\'re so glad ${aList} will be joining us! We\'ll keep everyone in our thoughts on our special day.`;
    } else {
      // all-attending
      message = rsvpThankYou
        ? rsvpThankYou.replace('{name}', primaryGuest)
        : `Your RSVP has been received. We can\'t wait to celebrate with you.`;
    }

    return (
      <main className="flex-1 w-full max-w-xl mx-auto px-6 pt-32 pb-20 flex flex-col">
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-cinematic-gold text-[64px]">{icon}</span>
          <h2 className="italic text-[36px] mt-4" style={{ fontFamily: "'Playfair Display', serif" }}>{title}</h2>
          <p className="text-[14px] text-charcoal-ink/70 mt-5 leading-relaxed max-w-xs mx-auto">
            {message}
          </p>
          <p className="text-[12px] text-charcoal-ink/40 mt-6 tracking-wide">
            {attendingCount} of {totalCount} guest{totalCount !== 1 ? 's' : ''} attending
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-6 pt-32 pb-20 flex flex-col">
      {/* Event header */}
      <div className="text-center mb-10">
        <h1 className="italic text-[40px] md:text-[52px] leading-tight text-charcoal-ink" style={{ fontFamily: "'Playfair Display', serif" }}>{coupleName}</h1>
        <p className="mt-4 text-[15px] text-charcoal-ink/80">{venue}, {venueAddress}</p>
        {rsvpDeadline && (
          <p className="mt-3 text-[13px] text-cinematic-gold/80 italic">
            Kindly respond by {rsvpDeadline}
          </p>
        )}
      </div>

      {/* Progress dots — 4 steps (0–3) */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className={`step-dot ${n <= step ? 'active' : ''}`} />
        ))}
      </div>

      {/* STEP 0 — Enter Name */}
      {step === 0 && (
        <section className="staggered-fade-in" style={{ animationDelay: '0s', opacity: 1 }}>
          <div className="text-center mb-8">
            <p className="font-semibold text-[15px] tracking-wide">{step0Title}</p>
            <p className="text-[13px] text-charcoal-ink/60 italic mt-2">
              {step0Subtext}
            </p>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="text-[11px] tracking-[0.18em] uppercase text-charcoal-ink/60 font-semibold">
                  First Name
                </label>
                <input
                  className="input-line"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  type="text"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="text-[11px] tracking-[0.18em] uppercase text-charcoal-ink/60 font-semibold">
                  Last Name
                </label>
                <input
                  className="input-line"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  type="text"
                  autoComplete="family-name"
                />
              </div>
            </div>
            <button
              className="w-full bg-charcoal-ink text-paper-cream rounded px-8 py-3 text-[13px] font-medium uppercase tracking-[0.08em] hover:opacity-90 transition-opacity duration-300"
              onClick={submitStep1}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* STEP 1 — Party Size */}
      {step === 1 && (
        <section className="staggered-fade-in" style={{ animationDelay: '0s', opacity: 1 }}>
          <div className="text-center mb-8">
            <p className="font-semibold text-[15px] tracking-wide">{step1Title}</p>
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <button
              className="w-12 h-12 border border-charcoal-ink/15 rounded flex items-center justify-center hover:border-charcoal-ink/40 transition-colors text-2xl bg-transparent"
              onClick={() => changeParty(-1)}
            >
              −
            </button>
            <div className="w-24 h-12 border border-charcoal-ink/30 flex items-center justify-center text-xl font-semibold">
              {partySize}
            </div>
            <button
              className="w-12 h-12 border border-charcoal-ink/15 rounded flex items-center justify-center hover:border-charcoal-ink/40 transition-colors text-2xl bg-transparent"
              onClick={() => changeParty(1)}
            >
              +
            </button>
          </div>
          <p className="text-center text-[13px] text-charcoal-ink/60 italic mb-8">
            Include yourself and anyone attending with you.
          </p>
          <div className="flex gap-3">
            <button
              className="flex-1 border border-charcoal-ink/15 bg-white rounded py-3 text-[13px] font-medium uppercase tracking-[0.08em] text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold transition-colors duration-300"
              onClick={() => setStep(0)}
            >
              Back
            </button>
            <button
              className="flex-[2] bg-charcoal-ink text-paper-cream rounded px-8 py-3 text-[13px] font-medium uppercase tracking-[0.08em] hover:opacity-90 transition-opacity duration-300"
              onClick={submitStep2}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* STEP 2 — Confirm guests & dietary preferences */}
      {step === 2 && (
        <section className="staggered-fade-in" style={{ animationDelay: '0s', opacity: 1 }}>
          <div className="text-center mb-8">
            <p className="font-semibold text-[15px] tracking-wide">{step2Title}</p>
            <p className="text-[13px] text-charcoal-ink/50 mt-1">
              {step2Subtext}
            </p>
          </div>

          <div className="space-y-6 mb-6">
            {guests.map((g, i) => (
              <div key={i} className="py-4 border-b border-charcoal-ink/10">
                {/* Guest number + name */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[13px] font-semibold text-cinematic-gold w-5 text-center shrink-0">
                    {i + 1}
                  </span>
                  <input
                    className="flex-1 bg-transparent outline-none text-[15px] border-b border-charcoal-ink/20 focus:border-cinematic-gold pb-1 transition-colors placeholder:text-charcoal-ink/40"
                    placeholder="Guest name"
                    value={g.name}
                    onChange={(e) => updateGuestName(i, e.target.value)}
                  />
                </div>

                {/* Dietary preference pills */}
                <div className="flex items-center gap-2 pl-8">
                  {DIETARY_OPTIONS.map((opt) => {
                    const selected = g.dietary.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`px-4 py-1.5 rounded-full text-[12px] font-medium border transition-all duration-200 ${
                          selected
                            ? 'border-cinematic-gold bg-cinematic-gold/10 text-cinematic-gold'
                            : 'border-charcoal-ink/15 bg-transparent text-charcoal-ink/60 hover:border-charcoal-ink/40'
                        }`}
                        onClick={() => toggleDietary(i, opt)}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Add Another Guest — dashed border */}
          <button
            type="button"
            className="w-full py-4 border border-dashed border-charcoal-ink/20 rounded text-[13px] text-charcoal-ink/50 hover:text-cinematic-gold hover:border-cinematic-gold/40 transition-colors mb-8"
            onClick={addGuest}
          >
            + Add Another Guest
          </button>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              className="flex-1 border border-charcoal-ink/15 bg-white rounded py-3 text-[13px] font-medium uppercase tracking-[0.08em] text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold transition-colors duration-300"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              className="flex-[2] bg-charcoal-ink text-paper-cream rounded px-8 py-3 text-[13px] font-medium uppercase tracking-[0.08em] hover:opacity-90 transition-opacity duration-300"
              onClick={goToStep3}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {/* STEP 3 — Per-guest attendance response */}
      {step === 3 && (
        <section className="staggered-fade-in" style={{ animationDelay: '0s', opacity: 1 }}>
          {/* Guest header */}
          <div className="text-center mb-6 pb-4 border-b border-charcoal-ink/20">
            <p className="font-semibold text-[16px]">
              Responding for {guests[currentGuestIndex]?.name}.
            </p>
            <p className="text-[12px] text-charcoal-ink/50 mt-1">
              Guest {currentGuestIndex + 1} of {guests.length}
            </p>
          </div>

          {/* Attendance question */}
          <div>
            <p className="text-[14px] mb-4">
              {`Will you be able to join us for our ${ceremonyName}?`}<span className="text-cinematic-gold">*</span>
            </p>
            <div className="space-y-3">
              {ATTENDANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className={`opt-btn rounded-full w-full text-left ${attendance === opt.val ? 'selected' : ''}`}
                  onClick={() => setAttendance(opt.val)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submission error message */}
          {submitError && (
            <p className="text-red-500/70 text-[13px] mt-4 text-center">{submitError}</p>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-10">
            <button
              className="flex-1 border border-charcoal-ink/15 bg-white rounded py-3 text-[13px] font-medium uppercase tracking-[0.08em] text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold transition-colors duration-300"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              className={`flex-[2] bg-charcoal-ink text-paper-cream rounded px-8 py-3 text-[13px] font-medium uppercase tracking-[0.08em] hover:opacity-90 transition-opacity duration-300 flex items-center justify-center gap-2 ${
                !attendance || submitting ? 'opacity-40' : ''
              }`}
              disabled={!attendance || submitting}
              onClick={submitGuestResponse}
            >
              {submitting && (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              )}
              {submitting ? 'Saving…' : 'Save & Continue'}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}