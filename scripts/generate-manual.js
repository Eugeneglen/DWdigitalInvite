/**
 * DreamWeavers Digital Invite Platform — User Manual Generator
 * ============================================================
 * Generates a complete .docx user manual with two parts:
 *   Part 1 — Admin CMS User Guide (14 sections)
 *   Part 2 — Couple CMS User Guide (21 sections)
 *
 * Design system: White Porcelain palette (product manual scene)
 * Cover recipe: R1 (Pure Paragraph, Left-Aligned)
 * Sections: 3 (Cover / TOC-roman / Body-arabic)
 * Fonts: Calibri (body), Calibri Bold (headings)
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, LevelFormat, SectionType,
  TableLayoutType, VerticalAlign,
} = require("docx");
const fs = require("fs");
const path = require("path");

// =============================================================================
// 1. PALETTE — White Porcelain (product manuals / minimalist)
// =============================================================================

const P = {
  primary:   "303030",  // dark charcoal — headings
  body:      "484848",  // dark grey — body text
  secondary: "808080",  // mid grey — captions, footers
  accent:    "B89870",  // muted gold — accent color
  surface:   "FAFAF8",  // near-white — table alt rows
  // Cover-specific (R1 uses light bg with dark text)
  coverBg:        "FAFAF8",
  coverTitle:     "303030",
  coverSubtitle:  "606060",
  coverMeta:      "707070",
  coverFooter:    "9A9A9A",
  // Callout backgrounds
  tipBg:    "FFF8E1",   // light yellow
  tipBorder:"E6B800",
  noteBg:   "FCE8E8",   // light red
  noteBorder:"D04A4A",
  bestBg:   "E8F5E8",   // light green
  bestBorder:"4A8A4A",
  // Table colors
  tableHeaderBg:  "303030",
  tableHeaderText:"FFFFFF",
  tableBorder:    "B0A89A",
  tableInnerLine: "E0DCD0",
  tableAltRow:    "FAFAF8",
};

// =============================================================================
// 2. FONT + SIZE CONSTANTS
// =============================================================================

const FONT = { ascii: "Calibri", eastAsia: "Calibri" };
const FONT_BOLD = { ascii: "Calibri", eastAsia: "Calibri" };

const SIZE = {
  coverTitle:    72,   // 36pt
  coverSubtitle: 28,   // 14pt
  coverLabel:    20,   // 10pt
  coverMeta:     24,   // 12pt
  coverFooter:   18,   // 9pt
  h1:            36,   // 18pt
  h2:            30,   // 15pt
  h3:            26,   // 13pt
  body:          22,   // 11pt
  caption:       20,   // 10pt
  footer:        18,   // 9pt
  tableHeader:   22,   // 11pt
  tableCell:     20,   // 10pt
  callout:       22,   // 11pt
};

// =============================================================================
// 3. HELPER BUILDERS — paragraphs, callouts, tables, screenshots
// =============================================================================

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = {
  top: NB, bottom: NB, left: NB, right: NB,
  insideHorizontal: NB, insideVertical: NB,
};

// ── Body text paragraph ──────────────────────────────────────────────────────
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { line: 312, before: opts.before ?? 0, after: opts.after ?? 120 },
    alignment: opts.align ?? AlignmentType.LEFT,
    indent: opts.indent ? { firstLine: opts.indent } : undefined,
    children: [new TextRun({
      text, size: SIZE.body, color: P.body, font: FONT,
      bold: opts.bold ?? false, italics: opts.italics ?? false,
    })],
  });
}

// ── Heading 1 / 2 / 3 ───────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200, line: 312 },
    pageBreakBefore: true,
    children: [new TextRun({
      text, bold: true, size: SIZE.h1, color: P.primary, font: FONT_BOLD,
    })],
  });
}

function h1NoBreak(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200, line: 312 },
    children: [new TextRun({
      text, bold: true, size: SIZE.h1, color: P.primary, font: FONT_BOLD,
    })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 140, line: 312 },
    children: [new TextRun({
      text, bold: true, size: SIZE.h2, color: P.primary, font: FONT_BOLD,
    })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 100, line: 312 },
    children: [new TextRun({
      text, bold: true, size: SIZE.h3, color: P.primary, font: FONT_BOLD,
    })],
  });
}

// ── Numbered list paragraph (each list needs a unique reference) ────────────
let _listCounter = 0;
function newListRef() {
  _listCounter++;
  return `manual-list-${_listCounter}`;
}

function numItem(ref, text, opts = {}) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({
      text, size: SIZE.body, color: P.body, font: FONT,
      bold: opts.bold ?? false,
    })],
  });
}

// ── FAQ question (bold body paragraph — not a heading, to avoid H1→H3 skip) ──
function faqQuestion(text) {
  return new Paragraph({
    spacing: { before: 240, after: 80, line: 312 },
    children: [new TextRun({
      text, bold: true, size: SIZE.body, color: P.primary, font: FONT_BOLD,
    })],
  });
}

// ── Bullet item (uses Word's built-in bullet) ──────────────────────────────
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { line: 312, after: 60 },
    children: [new TextRun({
      text, size: SIZE.body, color: P.body, font: FONT,
    })],
  });
}

// ── Callout box (single-cell table with background color) ───────────────────
function callout(kind, title, bodyText) {
  let bg, border, icon;
  if (kind === "tip")      { bg = P.tipBg;  border = P.tipBorder;  icon = "TIP"; }
  else if (kind === "note"){ bg = P.noteBg; border = P.noteBorder; icon = "IMPORTANT"; }
  else if (kind === "best"){ bg = P.bestBg; border = P.bestBorder; icon = "BEST PRACTICE"; }
  else                     { bg = P.surface;border = P.accent;      icon = "NOTE"; }

  const leftBar = { style: BorderStyle.SINGLE, size: 24, color: border };
  const thinBorder = { style: BorderStyle.SINGLE, size: 2, color: border };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: thinBorder, bottom: thinBorder,
      left: leftBar, right: thinBorder,
      insideHorizontal: NB, insideVertical: NB,
    },
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: bg },
        margins: { top: 140, bottom: 140, left: 200, right: 200 },
        width: { size: 100, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            spacing: { after: 60, line: 280 },
            children: [new TextRun({
              text: icon + "  " + title,
              bold: true, size: SIZE.body, color: P.primary, font: FONT_BOLD,
            })],
          }),
          new Paragraph({
            spacing: { line: 300 },
            children: [new TextRun({
              text: bodyText, size: SIZE.body, color: P.body, font: FONT,
            })],
          }),
        ],
      })],
    })],
  });
}

// ── Screenshot placeholder ──────────────────────────────────────────────────
let _figCounter = 0;
function screenshot(pageName, caption) {
  _figCounter++;
  const figNum = _figCounter;
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.DASHED, size: 4, color: P.secondary },
        bottom: { style: BorderStyle.DASHED, size: 4, color: P.secondary },
        left: { style: BorderStyle.DASHED, size: 4, color: P.secondary },
        right: { style: BorderStyle.DASHED, size: 4, color: P.secondary },
        insideHorizontal: NB, insideVertical: NB,
      },
      rows: [new TableRow({
        cantSplit: true,
        children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: P.surface },
          margins: { top: 400, bottom: 400, left: 200, right: 200 },
          width: { size: 100, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { line: 320 },
              children: [new TextRun({
                text: `[Screenshot: ${pageName}]`,
                italics: true, size: SIZE.body, color: P.secondary, font: FONT,
              })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, line: 280 },
              children: [new TextRun({
                text: `Caption: Figure ${figNum} — ${caption}`,
                size: SIZE.caption, color: P.secondary, font: FONT,
              })],
            }),
          ],
        })],
      })],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "" })] }),
  ];
}

// ── Table with header + data rows ───────────────────────────────────────────
function dataTable(headers, rows, colWidths) {
  const totalCols = headers.length;
  const widths = colWidths || Array(totalCols).fill(Math.floor(100 / totalCols));

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((text, i) => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: P.tableHeaderBg },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { line: 280 },
        children: [new TextRun({
          text, bold: true, size: SIZE.tableHeader,
          color: P.tableHeaderText, font: FONT_BOLD,
        })],
      })],
    })),
  });

  const dataRows = rows.map((row, rIdx) => new TableRow({
    cantSplit: true,
    children: row.map((cellText, cIdx) => new TableCell({
      shading: rIdx % 2 === 1
        ? { type: ShadingType.CLEAR, fill: P.tableAltRow }
        : undefined,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      width: { size: widths[cIdx], type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.TOP,
      children: [new Paragraph({
        spacing: { line: 280 },
        children: [new TextRun({
          text: String(cellText ?? ""), size: SIZE.tableCell,
          color: P.body, font: FONT,
        })],
      })],
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.primary },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.primary },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.tableInnerLine },
      insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  });
}

// ── Spacer paragraph (empty) ────────────────────────────────────────────────
function spacer(after = 120) {
  return new Paragraph({
    spacing: { after, line: 240 },
    children: [new TextRun({ text: "" })],
  });
}

// =============================================================================
// 4. COVER (Recipe R1 — Pure Paragraph, Left-Aligned)
// =============================================================================

function buildCover() {
  const padL = 1200, padR = 800;
  const accentBar = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };

  const titleLines = [
    "DreamWeavers",
    "Digital Invite Platform",
  ];

  const children = [];

  // 1. Top whitespace
  children.push(new Paragraph({ spacing: { before: 2800 }, children: [] }));

  // 2. English label with accent bottom border
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    spacing: { after: 500, line: 320 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
    children: [new TextRun({
      text: "U S E R   M A N U A L",
      size: SIZE.coverLabel, color: P.accent, font: FONT_BOLD,
      characterSpacing: 40,
    })],
  }));

  // 3. Title lines
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: {
        after: i < titleLines.length - 1 ? 100 : 360,
        line: 820, lineRule: "atLeast",
      },
      children: [new TextRun({
        text: titleLines[i],
        size: SIZE.coverTitle, bold: true,
        color: P.coverTitle, font: FONT_BOLD,
      })],
    }));
  }

  // 4. Subtitle
  children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: 900, line: 340 },
    children: [new TextRun({
      text: "Complete Guide for Admins & Couples",
      size: SIZE.coverSubtitle, color: P.coverSubtitle, font: FONT,
    })],
  }));

  // 5. Meta info lines with left accent border
  const metaLines = [
    "Version 1.0",
    "Date: August 2025",
    "Prepared by: DreamWeavers Team",
  ];
  for (const line of metaLines) {
    children.push(new Paragraph({
      indent: { left: padL + 200 },
      spacing: { after: 100, line: 320 },
      border: { left: accentBar },
      children: [new TextRun({
        text: line,
        size: SIZE.coverMeta, color: P.coverMeta, font: FONT,
      })],
    }));
  }

  // 6. Bottom whitespace
  children.push(new Paragraph({ spacing: { before: 4200 }, children: [] }));

  // 7. Footer with top accent separator
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200, line: 280 },
    children: [
      new TextRun({
        text: "DreamWeavers Digital Heirlooms",
        size: SIZE.coverFooter, color: P.coverFooter, font: FONT,
      }),
      new TextRun({ text: "                                        " }),
      new TextRun({
        text: "Confidential — Internal Use",
        size: SIZE.coverFooter, color: P.coverFooter, font: FONT,
      }),
    ],
  }));

  // Wrap in single 16838 wrapper table
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.coverBg },
        borders: allNoBorders,
        children,
      })],
    })],
  })];
}

// =============================================================================
// 5. TOC SECTION
// =============================================================================

function buildTOCSection() {
  return [
    // TOC title — NOT a HeadingLevel (prevents self-indexing)
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360, line: 360 },
      children: [new TextRun({
        text: "Table of Contents",
        bold: true, size: SIZE.h1, color: P.primary, font: FONT_BOLD,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360, line: 280 },
      children: [new TextRun({
        text: "DreamWeavers Digital Invite Platform — User Manual v1.0",
        italics: true, size: SIZE.body, color: P.secondary, font: FONT,
      })],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({
      spacing: { before: 240, line: 280 },
      children: [
        new TextRun({
          text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"",
          italics: true, size: SIZE.caption, color: P.secondary, font: FONT,
        }),
      ],
    }),
    // Section break (NEXT_PAGE) handles the page transition — no PageBreak needed.
  ];
}

// =============================================================================
// 6. PART 1 — ADMIN CMS USER GUIDE (14 sections)
// =============================================================================

function buildPart1() {
  const out = [];

  // ── Part divider ──────────────────────────────────────────────────────────
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 200, line: 360 },
    children: [new TextRun({
      text: "PART 1",
      bold: true, size: 56, color: P.accent, font: FONT_BOLD,
      characterSpacing: 60,
    })],
  }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 600, line: 360 },
    children: [new TextRun({
      text: "Admin CMS User Guide",
      bold: true, size: SIZE.h1, color: P.primary, font: FONT_BOLD,
    })],
  }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 480, line: 320 },
    children: [
      new TextRun({
        text: "For platform administrators, consultants, coordinators, and support staff who manage weddings, couples, content templates, and platform-wide settings.",
        italics: true, size: SIZE.body, color: P.secondary, font: FONT,
      }),
      new PageBreak(),
    ],
  }));

  // ── 1. Introduction ───────────────────────────────────────────────────────
  out.push(h1NoBreak("1. Introduction"));
  out.push(h2("1.1 About DreamWeavers Digital Invite Platform"));
  out.push(p("DreamWeavers is a digital wedding invitation platform that helps couples build a beautiful, personalised wedding website complete with RSVP forms, schedule, photo galleries, well-wishes, and more. The Admin CMS (Content Management System) is the back-office tool your team uses to set up weddings, manage couples, control which features each couple can use, and keep the platform running smoothly."));
  out.push(p("This guide walks you through every Admin CMS page, explains what each feature is for, and gives you step-by-step instructions for the tasks you will perform most often. Read it from start to finish the first time, then use the Table of Contents as a quick reference afterwards."));

  out.push(h2("1.2 Who Should Read This Guide"));
  out.push(p("This guide is written for staff who log into the Admin CMS (typically at a URL like /cms). Depending on your role, you may see more or fewer pages than described here. Common admin roles include:"));
  out.push(bullet("Super Admin — full access to every page, including Platform Settings and Team Management."));
  out.push(bullet("Consultant (Senior / Junior) — manages weddings, couples, and templates."));
  out.push(bullet("Coordinator — manages weddings and content, but cannot change platform settings."));
  out.push(bullet("Support — read-only access to all weddings for assisting couples over the phone or chat."));
  out.push(p("If a page or button is greyed out or hidden, it is because your role does not have permission for that action. Ask your Super Admin if you believe you need additional access."));

  out.push(h2("1.3 How the Platform Is Organised"));
  out.push(p("The platform has two sides:"));
  out.push(bullet("Admin CMS — what you are using right now. Used by staff to manage weddings, content templates, and platform settings."));
  out.push(bullet("Couple CMS — what couples log into. Couples use it to edit their wedding website, manage their guest list, view RSVPs, and so on."));
  out.push(p("Every couple website is created from inside the Admin CMS. Once you create a wedding, the couple receives login credentials and can start editing their site through the Couple CMS."));

  out.push(h2("1.4 Conventions Used in This Guide"));
  out.push(p("Throughout this manual you will see the following callout boxes:"));
  out.push(callout("tip", "Tips", "Light yellow boxes highlight shortcuts and time-saving suggestions that make your work easier."));
  out.push(spacer(120));
  out.push(callout("note", "Important Notes", "Light red boxes warn you about actions that cannot be undone, or that affect multiple couples at once."));
  out.push(spacer(120));
  out.push(callout("best", "Best Practices", "Light green boxes suggest habits that keep your platform tidy, secure, and easy to maintain."));
  out.push(spacer(120));
  out.push(p("Numbered steps show you how to perform a task in order. Bullet points list options or facts. When you see a button name in bold — such as Save or Publish — it refers to an actual button in the interface."));

  out.push(...screenshot("Admin CMS Dashboard", "The main dashboard you see after logging in, showing summary stats, alerts, and recent activity."));

  // ── 2. Logging In ────────────────────────────────────────────────────────
  out.push(h1("2. Logging In"));
  out.push(h2("2.1 Purpose"));
  out.push(p("The login screen is the front door to the Admin CMS. Only staff with an active account can sign in. Couples log in through a separate Couple CMS URL."));

  out.push(h2("2.2 How to Log In"));
  const loginSteps = newListRef();
  out.push(numItem(loginSteps, "Open your web browser and go to the Admin CMS web address provided by your supervisor (for example, https://your-platform.com/cms)."));
  out.push(numItem(loginSteps, "Enter your email address in the Email field."));
  out.push(numItem(loginSteps, "Enter your password in the Password field."));
  out.push(numItem(loginSteps, "Click the Sign In button."));
  out.push(numItem(loginSteps, "If your credentials are correct, you will be redirected to the Admin Dashboard."));

  out.push(h2("2.3 Expected Result"));
  out.push(p("After a successful login, you land on the Dashboard page. Your name and role appear in the top-right corner of the screen. The sidebar on the left shows every page you have permission to access."));

  out.push(h2("2.4 If You Forgot Your Password"));
  out.push(p("Click the \"Forgot password?\" link on the login page. Enter your email address and click Send Reset Link. You will receive an email with a link to set a new password. The link expires after a short time, so use it promptly."));

  out.push(callout("note", "Account Lockout", "After several failed login attempts, your account may be temporarily locked. Wait a few minutes and try again, or ask a Super Admin to reset your password."));

  out.push(h2("2.5 Changing Your Password"));
  out.push(p("Once logged in, you can change your password at any time:"));
  const pwSteps = newListRef();
  out.push(numItem(pwSteps, "Click your name in the top-right corner."));
  out.push(numItem(pwSteps, "Select Change Password from the menu."));
  out.push(numItem(pwSteps, "Enter your current password, then your new password twice."));
  out.push(numItem(pwSteps, "Click Update Password."));

  out.push(callout("best", "Strong Passwords", "Use a password of at least 12 characters with a mix of upper and lower case letters, numbers, and symbols. Avoid reusing passwords from other systems."));

  out.push(h2("2.6 Logging Out"));
  out.push(p("Click your name in the top-right corner and select Log Out. Always log out when you finish, especially on a shared computer."));

  // ── 3. Dashboard Overview ────────────────────────────────────────────────
  out.push(h1("3. Dashboard Overview"));
  out.push(h2("3.1 Purpose"));
  out.push(p("The Dashboard is your home base. It gives you an at-a-glance view of how the platform is doing: how many weddings are active, how many RSVPs and wishes have been received across all weddings, and which weddings or staff need your attention today."));

  out.push(...screenshot("Master Dashboard", "The Admin Dashboard with summary KPIs, period stats, alerts, pipeline chart, staff workload, and activity feed."));

  out.push(h2("3.2 Summary Stats (Top Row)"));
  out.push(p("Four cards across the top show the key numbers:"));
  out.push(bullet("Total Weddings — every wedding ever created on the platform."));
  out.push(bullet("Active Sites — weddings whose status is currently Active."));
  out.push(bullet("Avg RSVPs / Wedding — the average number of RSVP submissions per wedding."));
  out.push(bullet("Avg Wishes / Wedding — the average number of guest wishes per wedding."));

  out.push(h2("3.3 Period Stats"));
  out.push(p("Use the MTD, YTD, and Custom buttons to choose a time period. The platform shows how many new weddings and RSVPs were received during that period, plus the previous matching period and the percentage growth or decline between the two. A green arrow means growth; a red arrow means decline."));

  out.push(h2("3.4 Alerts"));
  out.push(p("Four alert cards highlight items that may need your attention:"));
  out.push(bullet("Expiring Access — weddings whose couple access is about to expire."));
  out.push(bullet("Upcoming Weddings — weddings happening in the next 30 days."));
  out.push(bullet("Inactive Staff — staff who have not logged in for a long time."));
  out.push(bullet("Incomplete Drafts — weddings with very little content filled in yet."));
  out.push(p("Click any couple name in these cards to open their public wedding website in a new tab."));

  out.push(h2("3.5 Pipeline Funnel"));
  out.push(p("A horizontal bar chart shows how many weddings are in each lifecycle stage: Onboarding, Active, Completed, Expired, and Suspended. This helps you see the overall health of the business at a glance."));

  out.push(h2("3.6 Staff Workload"));
  out.push(p("A table lists every staff member, their role, the number of weddings they are assigned to (split between Consultant and Coordinator roles), and their last login time. Click the Export button to download this table as a CSV file."));

  out.push(h2("3.7 Recent Activity"));
  out.push(p("A scrolling list shows the most recent actions across the platform — who created, updated, or deleted what, and when. Use this to spot-check what your team has been working on."));

  out.push(callout("tip", "Bookmark the Dashboard", "Make the Dashboard your browser homepage so you always see platform status first thing in the morning."));

  // ── 4. Creating a New Wedding ────────────────────────────────────────────
  out.push(h1("4. Creating a New Wedding"));
  out.push(h2("4.1 Purpose"));
  out.push(p("Creating a new wedding is the very first step when a couple signs up. The wizard collects the couple's details, lets you pick a package, assigns staff, and seeds the new wedding with default content from the platform's default Content Template."));

  out.push(h2("4.2 When to Use It"));
  out.push(p("Use this wizard whenever a new couple joins the platform. Do not use it to fix typos on an existing wedding — edit the existing wedding instead (see section 5)."));

  out.push(h2("4.3 Step-by-Step"));
  const createSteps = newListRef();
  out.push(numItem(createSteps, "From the Dashboard or Weddings page, click the New Wedding button. The Wedding Creation Wizard opens."));
  out.push(numItem(createSteps, "Step 1 — Couple Details. Enter the couple's display name (e.g. \"Eleanor & James\"), the bride and groom's individual names, the couple's contact email and phone, and an internal job number if your team uses one."));
  out.push(numItem(createSteps, "Step 2 — Wedding Date & Venue. Pick the wedding date using the calendar picker. Enter the start time, the venue name, the venue address, and a Google Maps URL (the \"Share\" link from Google Maps works perfectly)."));
  out.push(numItem(createSteps, "Step 3 — Package. Choose Gold, Platinum, or Diamond. Each package unlocks a different set of features. You can see what is included in each by reading the package description under the selector."));
  out.push(numItem(createSteps, "Step 4 — Features. The wizard pre-selects the features included in your chosen package. Tick any additional features you want to grant (for example, add Music to a Gold package as a complimentary upgrade)."));
  out.push(numItem(createSteps, "Step 5 — Staff Assignment. Pick a Consultant (senior staff who owns the account) and a Coordinator (junior staff who handles day-to-day edits). Both fields are optional but recommended."));
  out.push(numItem(createSteps, "Step 6 — Internal Notes. Add any private notes for your team. These are never shown to the couple."));
  out.push(numItem(createSteps, "Review the summary on the last step, then click Create Wedding."));

  out.push(h2("4.4 Expected Result"));
  out.push(p("A new wedding is created in the database with status DRAFT (or whatever your platform's default wedding status is set to). The default Content Template is automatically cloned into the new wedding — this gives the couple a starting set of hero text, schedule items, FAQs, story items, and media. The couple's display name is substituted into the hero title, and the wedding date is substituted into the hero date display. Everything else comes from the template so the couple can edit it themselves."));

  out.push(callout("note", "Default Template Required", "If no Content Template is marked as default in the system, the wizard will still create the wedding but it will have no starting content. Always make sure a default template exists (see section 8)."));

  out.push(h2("4.5 Giving the Couple Access"));
  out.push(p("After creating the wedding, you need to give the couple a way to log in. From the Weddings page, find the new wedding and use the menu to set or reset the couple's password. Share the Couple CMS web address and their credentials with them through a secure channel."));

  out.push(callout("best", "Send a Welcome Email", "After creating the wedding, send the couple a personal welcome email with their login link, temporary password, and a link to this user manual's Couple CMS section."));

  // ── 5. Managing Wedding Accounts ─────────────────────────────────────────
  out.push(h1("5. Managing Wedding Accounts"));
  out.push(h2("5.1 Purpose"));
  out.push(p("The Weddings page lists every wedding account on the platform. Use it to search for a specific couple, view their details, change their status, suspend access, edit information, or open their site."));

  out.push(...screenshot("Weddings List", "The Weddings page showing the searchable, filterable table of all wedding accounts."));

  out.push(h2("5.2 Finding a Wedding"));
  const findSteps = newListRef();
  out.push(numItem(findSteps, "Open the Weddings page from the sidebar."));
  out.push(numItem(findSteps, "Type the couple's name, email, or job number into the search box at the top."));
  out.push(numItem(findSteps, "Use the Plan and Status dropdown filters to narrow the list (for example, show only Active Platinum weddings)."));
  out.push(numItem(findSteps, "Click Search. Matching weddings appear in the table below."));

  out.push(h2("5.3 Editing Wedding Details"));
  const editSteps = newListRef();
  out.push(numItem(editSteps, "Find the wedding you want to edit."));
  out.push(numItem(editSteps, "Click the Edit (pencil) icon in the Actions column."));
  out.push(numItem(editSteps, "Update any field — couple name, bride/groom names, wedding date and time, venue, plan, status, consultant, coordinator, internal notes, and which optional sections are enabled."));
  out.push(numItem(editSteps, "Click Save Changes."));

  out.push(h2("5.4 Changing Wedding Status"));
  out.push(p("Each wedding has a status that controls its lifecycle. The available statuses are:"));
  out.push(bullet("DRAFT — the wedding is being prepared and is not yet live for the couple to edit."));
  out.push(bullet("ACTIVE — the couple can log in and edit, and their site is visible to guests."));
  out.push(bullet("SUSPENDED — temporarily blocked (for example, while awaiting payment)."));
  out.push(bullet("COMPLETED — the wedding is over and the site is archived."));
  out.push(bullet("ARCHIVED — permanently archived; not shown in default lists."));
  out.push(p("To change the status, edit the wedding and pick a new value from the Status dropdown. Save your changes."));

  out.push(callout("note", "Suspending a Wedding", "Suspending a wedding immediately blocks couple and guest access. Use this only when necessary (for example, a payment dispute) and notify the couple beforehand."));

  out.push(h2("5.5 Viewing a Wedding Website"));
  out.push(p("Click the View (eye) icon in the Actions column to open the couple's public wedding website in a new browser tab. This is the same view guests see."));

  out.push(h2("5.6 Resetting Couple Password"));
  out.push(p("If a couple forgets their password, you can reset it for them. Find the wedding, open the actions menu, and choose Reset Password. Enter a new temporary password and share it with the couple through a secure channel. They will be prompted to change it on their next login."));

  out.push(h2("5.7 Copying Public Link"));
  out.push(p("Use the Copy Link action to copy the couple's public website URL to your clipboard. This is handy for sharing the link with the couple or with vendors."));

  // ── 6. Managing Couples ──────────────────────────────────────────────────
  out.push(h1("6. Managing Couples"));
  out.push(h2("6.1 Purpose"));
  out.push(p("Couples are the end-users of the platform. Each wedding has one Couple account that owns it. The Couples management view lets you see who is logged in, when they last visited, and how to contact them."));

  out.push(h2("6.2 Viewing the Couple List"));
  out.push(p("The Couples list is part of the Users page (see section 7). Filter the role to Couple to see only couple accounts. The table shows each couple's name, email, the wedding they own, when they last logged in, and whether their account is active."));

  out.push(h2("6.3 Common Couple Tasks"));
  out.push(bullet("Reset a forgotten couple password (see section 5.6)."));
  out.push(bullet("Activate or deactivate a couple account without touching their wedding data."));
  out.push(bullet("Manually mark a couple's access as extended when they renew their package."));

  out.push(h2("6.4 Account Lifecycle"));
  out.push(p("Every couple account goes through a lifecycle: ONBOARDING (just created), ACTIVE (currently editing or live), COMPLETED (wedding is over), EXPIRED (access has lapsed), or SUSPENDED (temporarily blocked). The lifecycle is visible in the Dashboard alerts and on the wedding record itself."));

  out.push(callout("tip", "Proactive Renewals", "Watch the Expiring Access alert on the Dashboard. Reach out to couples two weeks before their access expires to renew their package — this prevents last-minute panic on the wedding week."));

  // ── 7. Team Management ───────────────────────────────────────────────────
  out.push(h1("7. Team Management"));
  out.push(h2("7.1 Purpose"));
  out.push(p("The Users page lets you create staff accounts, assign roles, deactivate former staff, and reset passwords. The Roles page lets you customise what each role can do — including creating entirely new roles for unusual job functions."));

  out.push(h2("7.2 User Roles Available"));
  out.push(p("The platform ships with these built-in staff roles:"));
  out.push(dataTable(
    ["Role Key", "Display Name", "What They Can Do"],
    [
      ["SUPER_ADMIN_1", "Super Admin 1", "Full access to everything including settings, users, and roles."],
      ["SUPER_ADMIN_2", "Super Admin 2", "Same as Super Admin 1 — a second super admin for redundancy."],
      ["CONSULTANT_1", "Consultant 1 (Senior)", "Manages weddings, templates, and analytics. Cannot edit platform settings."],
      ["CONSULTANT_2", "Consultant 2", "Manages weddings and analytics. Limited template access."],
      ["COORDINATOR_1", "Coordinator 1", "Manages weddings and content. Cannot manage users or templates."],
      ["SUPPORT_1", "Support 1", "Read-only access to all weddings for assisting couples."],
      ["SUPPORT_2", "Support 2", "Read-only access to all weddings. Same as Support 1."],
      ["COUPLE", "Couple", "End-user role. Couples are not staff and only see the Couple CMS."],
    ],
    [20, 25, 55]
  ));

  out.push(h2("7.3 Adding a New Staff User"));
  const addStaffSteps = newListRef();
  out.push(numItem(addStaffSteps, "Open the Users page from the sidebar."));
  out.push(numItem(addStaffSteps, "Click the Add User button."));
  out.push(numItem(addStaffSteps, "Enter the staff member's full name and email address."));
  out.push(numItem(addStaffSteps, "Choose a role from the dropdown."));
  out.push(numItem(addStaffSteps, "Enter a temporary password (the staff member will be prompted to change it on first login)."));
  out.push(numItem(addStaffSteps, "Make sure the Active toggle is switched on."));
  out.push(numItem(addStaffSteps, "Click Create User."));

  out.push(h2("7.4 Editing a User"));
  out.push(p("Click the Edit (pencil) icon next to any user. You can change their name, email, role, and active status. To reset a password without editing the user, use the Reset Password action in the user's row menu."));

  out.push(h2("7.5 Deactivating a User"));
  out.push(p("When a staff member leaves your team, do not delete their account — historical audit logs reference their user ID. Instead, switch their Active toggle off. They will no longer be able to log in, but their past actions remain attributed to them in the audit trail."));

  out.push(callout("note", "Never Delete Users", "Deleting a user can break audit logs and historical references. Always deactivate instead. Only delete a user if they were created by mistake and have never performed any action."));

  out.push(h2("7.6 Resetting a Staff Password"));
  const resetStaffSteps = newListRef();
  out.push(numItem(resetStaffSteps, "Find the user in the Users list."));
  out.push(numItem(resetStaffSteps, "Open the row menu (three dots) and choose Reset Password."));
  out.push(numItem(resetStaffSteps, "Enter a new temporary password."));
  out.push(numItem(resetStaffSteps, "Click Reset. Share the new password with the staff member through a secure channel."));

  out.push(h2("7.7 Per-User Permission Overrides"));
  out.push(p("Sometimes you need to give one specific user a permission their role does not have, or revoke a permission their role normally has. The user edit dialog includes a Permissions tab where you can grant or revoke any platform or wedding permission for just that user. Overrides take precedence over role permissions."));

  out.push(h2("7.8 Managing Roles"));
  out.push(p("Open the Roles page from the sidebar to see every role in the system. System roles (like Super Admin) cannot be deleted, but you can create new custom roles for unusual needs."));
  out.push(p("To create a custom role:"));
  const newRoleSteps = newListRef();
  out.push(numItem(newRoleSteps, "Click Add Role on the Roles page."));
  out.push(numItem(newRoleSteps, "Enter a unique role key (for example, EVENT_STAFF) and a display label."));
  out.push(numItem(newRoleSteps, "Pick a tier: Platform (full platform access), Wedding Staff (per-wedding access), or Account."));
  out.push(numItem(newRoleSteps, "Tick the permissions this role should have. Each permission has a human-readable label so you know exactly what you are granting."));
  out.push(numItem(newRoleSteps, "Click Save."));

  out.push(callout("best", "Least Privilege", "When in doubt, grant fewer permissions. You can always add more later. Granting too much is hard to undo because the user may have already performed actions they should not have been able to."));

  // ── 8. Content Template Management ───────────────────────────────────────
  out.push(h1("8. Content Template Management"));
  out.push(h2("8.1 Purpose"));
  out.push(p("Content Templates are starter kits for new weddings. Whenever you create a new wedding, the platform clones the default template into that wedding — giving the couple a starting set of hero text, schedule items, FAQs, story items, media, and a visual theme. Without a default template, new couples start with an empty website and have to build everything from scratch."));

  out.push(p("Templates save your team hours of repetitive setup. Maintain one strong default template, plus optional seasonal variants (Spring, Winter, Cultural, etc.) that you can clone from when creating specialty weddings."));

  out.push(...screenshot("Content Templates List", "The Templates page showing each template's name, default flag, status, content counts, and theme."));

  out.push(h2("8.2 Viewing Templates"));
  out.push(p("Open the Templates page from the sidebar. The table shows every template, including:"));
  out.push(bullet("Name and description."));
  out.push(bullet("Default flag — a gold star marks the current default template."));
  out.push(bullet("Active flag — inactive templates are not available for new weddings."));
  out.push(bullet("Counts of content, schedule, FAQ, story, and media items in the template."));
  out.push(bullet("Visual theme — the colours and fonts that will be applied to weddings using this template."));

  out.push(h2("8.3 Creating a New Template"));
  const newTmplSteps = newListRef();
  out.push(numItem(newTmplSteps, "Click the New Template button."));
  out.push(numItem(newTmplSteps, "Enter a name (e.g. \"Spring Garden 2025\") and a short description."));
  out.push(numItem(newTmplSteps, "Optionally pick an existing wedding to clone from. This copies that wedding's content, schedule, FAQs, stories, media, and theme into the new template — a huge time-saver when creating variants."));
  out.push(numItem(newTmplSteps, "Click Create. The new template appears in the list with zero items if you did not clone, or with the cloned items if you did."));

  out.push(h2("8.4 Editing a Template"));
  out.push(p("Click the Edit (pencil) icon on any template to open the full-page Template Editor. The editor has six tabs:"));
  out.push(dataTable(
    ["Tab", "What You Edit"],
    [
      ["Details", "Template name, description, active flag."],
      ["Content", "Hero text, RSVP labels, wishes labels, getting-there text, and all other section text fields."],
      ["Schedule", "Default event schedule items (ceremony, reception, dinner, etc.) with start/end times and locations."],
      ["FAQs", "Default frequently-asked questions and answers."],
      ["Stories", "Default story items with title, content, date, and image."],
      ["Theme", "Five colours (background, text, accent, secondary, muted) plus heading and body fonts."],
    ],
    [20, 80]
  ));

  out.push(p("Make your changes in any tab, then click the Save button at the top of the editor. The Save button saves all tabs at once."));

  out.push(h2("8.5 Setting the Default Template"));
  out.push(p("Only one template can be the default at any time. The default is what gets cloned into every newly created wedding."));
  const setDefSteps = newListRef();
  out.push(numItem(setDefSteps, "Find the template you want to make default."));
  out.push(numItem(setDefSteps, "Open the row menu (three dots) and choose Set as Default."));
  out.push(numItem(setDefSteps, "Confirm when prompted."));
  out.push(p("The previous default loses its star; the new one gains it. Existing weddings are not affected — only weddings created after the change will use the new default."));

  out.push(callout("note", "Existing Weddings Are Unchanged", "Changing the default template does NOT retroactively update existing weddings. Their content was cloned at creation time and now lives independently. To update an existing wedding's content, edit the wedding directly."));

  out.push(h2("8.6 Design Themes"));
  out.push(p("Each template includes a Theme tab where you set the visual identity. Pick five colours that work together:"));
  out.push(bullet("Background — the page background colour (usually a very light tone)."));
  out.push(bullet("Text — the main body text colour (usually a dark tone)."));
  out.push(bullet("Accent — used for buttons, links, and decorative lines."));
  out.push(bullet("Secondary — a secondary brand colour used for headings or highlights."));
  out.push(bullet("Muted — for captions, footers, and less-important text."));
  out.push(p("Then choose a heading font and a body font from the dropdowns. The fonts you pick here will be applied to every wedding created from this template."));

  out.push(callout("tip", "Test Colours for Contrast", "Before saving a theme, preview it on a real wedding. Make sure body text is readable against the background — a contrast ratio of at least 4.5:1 is recommended for accessibility."));

  out.push(h2("8.7 Previewing a Template"));
  out.push(p("From the Templates page, use the Preview action on any template to see what a wedding built from this template would look like. The preview opens in a new tab and shows the template's content with the theme colours and fonts applied."));

  out.push(h2("8.8 Deleting a Template"));
  out.push(p("To remove an obsolete template, open its row menu and choose Delete. You cannot delete the current default template — set a different template as default first. Deleting a template does not affect any weddings that were already created from it."));

  out.push(h2("8.9 Applying a Template to All Weddings"));
  out.push(p("In rare cases you may want to push a template's content to every existing wedding at once (for example, fixing a typo in the default RSVP labels). Use the Apply to All action in the template's row menu."));
  out.push(callout("note", "Destructive Operation", "Apply to All overwrites content on every wedding. This cannot be undone. Always back up by exporting existing weddings first, and only do this when absolutely necessary."));

  // ── 9. Package & Feature Management ──────────────────────────────────────
  out.push(h1("9. Package & Feature Management"));
  out.push(h2("9.1 Purpose"));
  out.push(p("The platform offers three packages — Gold, Platinum, and Diamond — each unlocking a different set of features. The Features page lets you control which features are globally enabled on the platform, and which features are enabled for each individual wedding."));

  out.push(h2("9.2 Available Packages"));
  out.push(dataTable(
    ["Package", "Included Features"],
    [
      ["Gold", "Home, Schedule, RSVP, Getting There, Countdown Timer"],
      ["Platinum", "Everything in Gold, plus: Story, Wishes, Q&A"],
      ["Diamond", "Everything in Platinum, plus: Moments (photo gallery), Background Music, Wedding Video, Theme Templates (curated design themes)"],
    ],
    [18, 82]
  ));

  out.push(h2("9.3 Feature Keys"));
  out.push(p("Each feature has a stable internal key. These keys are used in the database and never change, so you can refer to them confidently in scripts or notes."));
  out.push(dataTable(
    ["Feature Key", "Label", "Description"],
    [
      ["rsvp", "RSVP", "Attendance response form for guests."],
      ["wishes", "Wishes", "Guest well-wishes and messages."],
      ["story", "Our Story", "Couple's love story timeline."],
      ["gallery", "Photo Gallery", "Additional photo gallery."],
      ["schedule", "Event Schedule", "Timeline of wedding day events."],
      ["moments", "Moments", "Photo gallery of captured memories."],
      ["getting-there", "Getting There", "Directions and venue info."],
      ["countdown", "Countdown", "Live countdown to wedding day."],
      ["music", "Background Music", "Music player on the website."],
      ["video", "Wedding Video", "Embedded video player."],
      ["qa", "Q&A", "Frequently asked questions section."],
      ["templates", "Theme Templates", "Curated design themes for the couple to switch between."],
      ["animation:gold-dust", "Gold Dust Animation", "Ambient gold particles drifting upward."],
      ["animation:flying-stars", "Meteors Animation", "Shooting-star streaks across a starfield."],
      ["animation:raining", "Bubbles Animation", "Raindrop ripple rings expanding and fading."],
    ],
    [25, 25, 50]
  ));

  out.push(h2("9.4 Toggling Global Features"));
  out.push(p("On the Features page, the Global Features section lists every feature with an on/off switch. Turning a feature off globally hides it from every wedding, even if the wedding's package includes it. Use this for emergency disablement (for example, if a feature has a bug you are investigating)."));
  const globalSteps = newListRef();
  out.push(numItem(globalSteps, "Open the Features page from the sidebar."));
  out.push(numItem(globalSteps, "Find the feature in the Global Features list."));
  out.push(numItem(globalSteps, "Toggle the switch on or off."));
  out.push(numItem(globalSteps, "Confirm the change. The effect is immediate."));

  out.push(h2("9.5 Toggling Per-Wedding Features"));
  out.push(p("The Tenant Features section lets you override the package defaults for any specific wedding. For example, you can add Music to a Gold wedding as a complimentary upgrade, or remove the Q&A feature from a wedding where the couple does not want it."));
  const tenantSteps = newListRef();
  out.push(numItem(tenantSteps, "On the Features page, select a wedding from the Tenant dropdown at the top."));
  out.push(numItem(tenantSteps, "The list below shows every feature and whether it is enabled for that wedding."));
  out.push(numItem(tenantSteps, "Toggle any feature on or off."));
  out.push(numItem(tenantSteps, "Changes are saved automatically — there is no Save button."));

  out.push(callout("tip", "Complimentary Upgrades", "If a couple is on the fence about upgrading to Platinum, temporarily enable the Story feature for them to try. Disable it after a week if they have not upgraded — they will see the value and be more likely to convert."));

  // ── 10. Platform Settings ────────────────────────────────────────────────
  out.push(h1("10. Platform Settings"));
  out.push(h2("10.1 Purpose"));
  out.push(p("The Settings page is where you configure platform-wide defaults: the platform name and contact emails, default wedding settings, RSVP defaults, notification preferences, navigation tabs, and footer content. These settings apply to every wedding unless overridden."));

  out.push(...screenshot("Platform Settings", "The Settings page with collapsible sections for platform info, wedding defaults, RSVP, notifications, nav tabs, and footer."));

  out.push(h2("10.2 Platform Information"));
  out.push(p("Set the platform name (shown in the browser title bar and email footers), tagline, admin email, and support email. These are used in automated emails and on the public site footer."));

  out.push(h2("10.3 Wedding Defaults"));
  out.push(p("Set the default status for newly created weddings (DRAFT or ACTIVE), the default package (Gold, Platinum, or Diamond), the maximum number of guests per wedding, and the maximum number of media items per wedding. New weddings will use these defaults unless overridden during creation."));

  out.push(h2("10.4 RSVP Settings"));
  out.push(p("Control whether guests can submit RSVPs at all, and the default RSVP deadline (number of days before the wedding). Individual weddings can override the deadline."));

  out.push(h2("10.5 Notification Settings"));
  out.push(p("Toggle email notifications for three events: when a guest submits an RSVP, when a guest posts a wish, and when a guest sends a contact message. When enabled, the relevant couple receives an email notification."));

  out.push(h2("10.6 Navigation Tabs"));
  out.push(p("Control which sections appear in the navigation of every wedding website. Each tab has a label, a target section (Home, Schedule, RSVP, etc.), and an enabled flag. Reorder tabs by dragging the grip handle. Disable a tab to hide that section from the navigation across all weddings."));

  out.push(h2("10.7 Footer Content"));
  out.push(p("Edit the text that appears in the footer of every wedding website:"));
  out.push(bullet("Footer Copyright — the copyright line at the bottom of every page."));
  out.push(bullet("Privacy Policy — full text of your privacy policy."));
  out.push(bullet("Data Protection — full text of your data protection statement."));
  out.push(bullet("Terms of Service — full text of your terms of service."));

  out.push(h2("10.8 Saving Settings"));
  out.push(p("After changing any setting, click the Save button at the top or bottom of the page. A success toast confirms your changes have been saved. Most settings take effect immediately on the public wedding websites."));

  out.push(callout("best", "Review Settings Quarterly", "Set a calendar reminder to review Platform Settings every three months. Legal text (privacy policy, terms of service) can become outdated, and your team may have grown into new defaults that no longer match the original settings."));

  // ── 11. Audit Logs ───────────────────────────────────────────────────────
  out.push(h1("11. Audit Logs"));
  out.push(h2("11.1 Purpose"));
  out.push(p("The Audit Log page records every meaningful action taken on the platform — who did what, when, and to which entity. Use it to investigate incidents, train new staff, and meet any compliance obligations you may have."));

  out.push(...screenshot("Audit Log", "The Audit Log page showing the searchable, filterable list of recent actions."));

  out.push(h2("11.2 Viewing Recent Activity"));
  const auditSteps = newListRef();
  out.push(numItem(auditSteps, "Open the Audit Log page from the sidebar."));
  out.push(numItem(auditSteps, "The most recent 50 actions appear in the table by default."));
  out.push(numItem(auditSteps, "Use the Action filter to show only CREATE, UPDATE, or DELETE actions."));
  out.push(numItem(auditSteps, "Use the search box to find actions by user name, user email, or entity type."));

  out.push(h2("11.3 What Gets Logged"));
  out.push(p("The audit log captures these key actions:"));
  out.push(bullet("CREATE — when a new wedding, user, template, or content item is created."));
  out.push(bullet("UPDATE — when an existing record is modified."));
  out.push(bullet("DELETE — when a record is removed."));
  out.push(p("Each entry shows the timestamp, the user who performed the action, the action type, the entity type (Wedding, User, Template, etc.), and a details field with the changes made."));

  out.push(callout("tip", "Investigating an Incident", "If a couple reports that something changed unexpectedly, search the audit log for their wedding name. Look for UPDATE actions in the last 24–48 hours. The user field tells you who made the change."));

  // ── 12. Best Practices ───────────────────────────────────────────────────
  out.push(h1("12. Best Practices"));
  out.push(p("This section collects the most important habits for keeping your DreamWeavers platform healthy, secure, and easy to manage. Treat them as team policy."));

  out.push(h2("12.1 Onboarding New Couples"));
  out.push(callout("best", "Standard Welcome Workflow", "Always: (1) create the wedding with accurate details, (2) verify the default template is current, (3) set the couple's password, (4) send a personal welcome email with login link and this manual, (5) schedule a 15-minute kickoff call for the next business day."));

  out.push(h2("12.2 Template Maintenance"));
  out.push(callout("best", "Quarterly Template Review", "Every quarter, review the default template. Update sample text, refresh images, and verify that FAQs are still accurate. A stale template makes every new wedding look out of date."));

  out.push(h2("12.3 Access Control"));
  out.push(callout("best", "Least Privilege", "Grant staff only the permissions they actually need. New coordinators should start with Coordinator 1, not Consultant 1. Promote after they have demonstrated competence."));

  out.push(h2("12.4 Account Hygiene"));
  out.push(callout("best", "Deactivate, Don't Delete", "When staff leave, deactivate their account the same day. Change any shared passwords they had access to. Conduct an exit interview to retrieve any platform materials."));

  out.push(h2("12.5 Backup and Recovery"));
  out.push(callout("best", "Verify Backups Weekly", "Confirm with your hosting provider that database backups are running daily and that you can restore from them. Do not wait for a disaster to discover your backups are broken."));

  out.push(h2("12.6 Communication with Couples"));
  out.push(callout("best", "Be Proactive", "Watch the Dashboard alerts daily. Reach out to couples before they reach out to you — about expiring access, missing content, or upcoming wedding dates. Proactive communication prevents most support escalations."));

  // ── 13. FAQ ──────────────────────────────────────────────────────────────
  out.push(h1("13. Frequently Asked Questions (FAQ)"));

  out.push(faqQuestion("Q: I created a wedding but the couple says their site is blank. Why?"));
  out.push(p("A: Most likely no Content Template is marked as default. Go to the Templates page, find your preferred template, and use Set as Default. Then either recreate the wedding (if it was just created) or manually clone the template content into the existing wedding."));

  out.push(faqQuestion("Q: A couple upgraded from Gold to Platinum. How do I unlock the new features?"));
  out.push(p("A: Edit the wedding on the Weddings page and change the Plan from Gold to Platinum. This unlocks the package's default features. If you want to add features beyond what Platinum includes, go to the Features page, select the wedding from the Tenant dropdown, and toggle the additional features on."));

  out.push(faqQuestion("Q: How do I find out who changed a specific wedding's content?"));
  out.push(p("A: Open the Audit Log page, search for the wedding's couple name, and filter by UPDATE actions. The list shows every change with the user and timestamp."));

  out.push(faqQuestion("Q: Can I have more than one Super Admin?"));
  out.push(p("A: Yes. The platform supports two Super Admin roles (Super Admin 1 and Super Admin 2) for redundancy. Always have at least two super admins in case one is unavailable."));

  out.push(faqQuestion("Q: A staff member left and I deleted their account. Now the audit log shows blank names. Why?"));
  out.push(p("A: Deleting a user removes their identity from the system, but the audit log entries still exist with broken references. That is why this guide says to deactivate rather than delete. Reactivate the account (even with a placeholder email) to restore the names, then leave it inactive."));

  out.push(faqQuestion("Q: How do I change which sections appear in the wedding website navigation?"));
  out.push(p("A: Go to Platform Settings and open the Navigation Tabs section. Toggle sections on or off, reorder them by dragging, and click Save. Changes apply to every wedding."));

  out.push(faqQuestion("Q: Can I give one couple a feature that is not in their package?"));
  out.push(p("A: Yes. Go to the Features page, pick the wedding from the Tenant dropdown, and toggle the feature on. This is a per-wedding override and does not change the package for any other couple."));

  out.push(faqQuestion("Q: What happens if I turn off a feature globally?"));
  out.push(p("A: The feature is hidden from every wedding immediately, even weddings whose package includes it. Couples will see a \"This feature is not available\" message if they try to access that page. Use global disable only for emergency situations."));

  // ── 14. Troubleshooting ──────────────────────────────────────────────────
  out.push(h1("14. Troubleshooting"));

  out.push(h2("14.1 I Cannot Log In"));
  out.push(p("Possible causes and fixes:"));
  out.push(bullet("Wrong email or password — click \"Forgot password?\" to reset."));
  out.push(bullet("Account deactivated — ask a Super Admin to reactivate your account."));
  out.push(bullet("Account locked after too many failed attempts — wait 10 minutes and try again."));
  out.push(bullet("Browser cached old login page — hard refresh (Ctrl+F5 on Windows, Cmd+Shift+R on Mac) and try again."));

  out.push(h2("14.2 A Page Loads Forever"));
  out.push(p("If a page hangs on the loading spinner:"));
  out.push(bullet("Refresh the page (F5)."));
  out.push(bullet("Check your internet connection."));
  out.push(bullet("Try a different browser (Chrome, Edge, Firefox, Safari are all supported)."));
  out.push(bullet("If the issue persists, contact your platform administrator — there may be a server issue."));

  out.push(h2("14.3 Changes I Made Did Not Save"));
  out.push(p("If you clicked Save but the change did not stick:"));
  out.push(bullet("Look for an error toast in the bottom-right corner — it may explain what went wrong."));
  out.push(bullet("Check your internet connection. The save may have failed silently."));
  out.push(bullet("Refresh the page and try again. If the field is empty, your change was not saved."));
  out.push(bullet("Check the Audit Log — if your action appears, the save succeeded but you may be looking at a cached view."));

  out.push(h2("14.4 Couple Cannot Log Into Their Site"));
  out.push(p("Walk the couple through these checks:"));
  out.push(bullet("Confirm they are using the Couple CMS URL, not the Admin CMS URL."));
  out.push(bullet("Verify their email is spelled correctly (no typos)."));
  out.push(bullet("Reset their password from the Weddings page (see section 5.6) and share the new password."));
  out.push(bullet("Check that their wedding is Active (not Suspended or Draft)."));
  out.push(bullet("Check that their couple account is active on the Users page."));

  out.push(h2("14.5 A Feature Is Missing from a Couple's CMS"));
  out.push(p("If a couple cannot see a feature they expect:"));
  out.push(bullet("Check the Features page — is the feature globally enabled?"));
  out.push(bullet("Check the per-wedding feature override for their wedding — is it enabled there?"));
  out.push(bullet("Check the wedding's Plan — does the package include that feature?"));
  out.push(bullet("Check Platform Settings → Navigation Tabs — is the section's tab enabled?"));

  out.push(h2("14.6 The Dashboard Shows Numbers I Don't Understand"));
  out.push(p("Most numbers on the Dashboard are simple counts. If something looks wrong:"));
  out.push(bullet("Avg RSVPs/Wedding is total RSVPs divided by total weddings — including draft and archived weddings. So if you have many draft weddings with zero RSVPs, the average will look low."));
  out.push(bullet("Period stats show the most recent complete period. If today is mid-month, MTD only counts from the 1st to today."));
  out.push(bullet("Pipeline stages update in real time as wedding statuses change."));

  out.push(callout("tip", "When in Doubt, Refresh", "Most \"the data looks wrong\" issues are stale caches. Hard refresh the page (Ctrl+F5 / Cmd+Shift+R) before assuming there is a real problem."));

  return out;
}

// =============================================================================
// 7. PART 2 — COUPLE CMS USER GUIDE (21 sections)
// =============================================================================

function buildPart2() {
  const out = [];

  // ── Part divider ──────────────────────────────────────────────────────────
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 200, line: 360 },
    pageBreakBefore: true,
    children: [new TextRun({
      text: "PART 2",
      bold: true, size: 56, color: P.accent, font: FONT_BOLD,
      characterSpacing: 60,
    })],
  }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 600, line: 360 },
    children: [new TextRun({
      text: "Couple CMS User Guide",
      bold: true, size: SIZE.h1, color: P.primary, font: FONT_BOLD,
    })],
  }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 480, line: 320 },
    children: [
      new TextRun({
        text: "For couples editing their DreamWeavers wedding website — managing details, schedule, RSVPs, guest list, story, gallery, and more.",
        italics: true, size: SIZE.body, color: P.secondary, font: FONT,
      }),
      new PageBreak(),
    ],
  }));

  // ── 1. Welcome ───────────────────────────────────────────────────────────
  out.push(h1NoBreak("1. Welcome"));
  out.push(p("Welcome to your DreamWeavers wedding website! This guide will help you turn your starter site into a beautiful, personalised invitation that your guests will love."));
  out.push(p("Your website was set up by your DreamWeavers consultant, who chose a starting design and added some sample content for you. Everything you see is editable — text, images, colours, schedule, RSVP form, and more. You do not need any technical skills; if you can use a word processor, you can use the Couple CMS."));
  out.push(p("Take your time. There is no rush. You can save your changes as you go and come back later. When you are happy with how everything looks, you publish your changes — and only then do your guests see the new version."));

  out.push(h2("1.1 What You Can Do With Your Website"));
  out.push(bullet("Share your love story and photos with guests."));
  out.push(bullet("Show the wedding day schedule so guests know where to be and when."));
  out.push(bullet("Collect RSVPs online — no more paper reply cards."));
  out.push(bullet("Display directions and parking info for the venue."));
  out.push(bullet("Receive heartfelt wishes from family and friends."));
  out.push(bullet("Answer common questions guests might have (dress code, gifts, kids, etc.)."));
  out.push(bullet("Share a gallery of moments — engagement photos, pre-wedding shoots, and post-wedding highlights."));

  out.push(h2("1.2 How Long Will It Take?"));
  out.push(p("Most couples spend about 3–5 hours total spread over a few sessions. You do not need to do it all at once. We recommend doing it in this order:"));
  out.push(bullet("Session 1 (1 hour): Update wedding details, upload a hero photo, write your story."));
  out.push(bullet("Session 2 (1 hour): Add the event schedule, set the RSVP deadline, fill in the Getting There page."));
  out.push(bullet("Session 3 (30 min): Add FAQs, review wishes settings, pick a design theme."));
  out.push(bullet("Session 4 (30 min): Add your guest list, preview the site, publish."));

  out.push(callout("tip", "Take It One Step at a Time", "You do not need to do everything in one sitting. Save your work often and come back when you feel inspired. The site looks best when it reflects your personalities, not when it is rushed."));

  out.push(h2("1.3 Getting Help"));
  out.push(p("If you get stuck at any point, your DreamWeavers consultant is your first point of contact. Their email is in the welcome message you received. For technical emergencies (site not loading, cannot log in), use the Contact form on your website or email the support address listed there."));

  // ── 2. Logging In ────────────────────────────────────────────────────────
  out.push(h1("2. Logging In"));
  out.push(h2("2.1 Purpose"));
  out.push(p("Logging in takes you to your private Couple CMS where you can edit your wedding website. Only you (and anyone you invite as a team member) can log in."));

  out.push(h2("2.2 How to Log In"));
  const cLoginSteps = newListRef();
  out.push(numItem(cLoginSteps, "Open your web browser and go to the Couple CMS web address your consultant gave you. It usually looks like https://your-platform.com/cms/couple."));
  out.push(numItem(cLoginSteps, "Enter the email address you signed up with."));
  out.push(numItem(cLoginSteps, "Enter your password. If this is your first time, use the temporary password your consultant sent you."));
  out.push(numItem(cLoginSteps, "Click Sign In."));
  out.push(numItem(cLoginSteps, "If this is your first login, you will be asked to change your password to something only you know."));

  out.push(h2("2.3 Expected Result"));
  out.push(p("After logging in, you see your Dashboard — a personal home page showing how many days until your wedding, your RSVP progress, recent guest activity, and quick links to every part of your site."));

  out.push(callout("note", "Keep Your Password Safe", "Choose a password that is easy for you to remember but hard for others to guess. Do not share it with anyone — invite team members through the Team page instead (see your consultant for details)."));

  out.push(h2("2.4 If You Forgot Your Password"));
  out.push(p("On the login page, click \"Forgot password?\" Enter your email address and click Send Reset Link. Check your inbox (and spam folder) for an email from DreamWeavers. Click the link in the email and choose a new password. The link expires after a short time, so use it promptly."));

  out.push(h2("2.5 If You Forgot Which Email You Used"));
  out.push(p("Click the \"Forgot my login email?\" link on the login page. Enter your names and wedding date. If we find a matching account, we will send the email address to the contact email on file. If you still cannot find it, contact your consultant — they can look it up for you."));

  // ── 3. Dashboard Overview ────────────────────────────────────────────────
  out.push(h1("3. Dashboard Overview"));
  out.push(h2("3.1 Purpose"));
  out.push(p("Your Dashboard is your command centre. It shows you the most important numbers about your wedding at a glance: how many days are left, how many guests have responded, how many are attending, and what still needs your attention. Smart alerts appear at the top only when there is something you should do."));

  out.push(...screenshot("Couple Dashboard Overview", "The redesigned Overview page with mode-aware KPIs, smart alerts, guest activity feed, and setup checklist."));

  out.push(h2("3.2 What You Will See"));
  out.push(p("The Overview page is divided into several sections:"));
  out.push(bullet("Days Until Wedding — a big countdown at the top."));
  out.push(bullet("Smart Alerts — coloured banners (red, amber, blue, green) that appear only when something needs your attention."));
  out.push(bullet("Key Numbers — total guests, RSVPs received, attendance rate, wishes count, content completion."));
  out.push(bullet("Setup Checklist — a list of tasks to complete, with checkmarks showing what is done."));
  out.push(bullet("Recent Guest Activity — the latest RSVPs and wishes from your guests."));
  out.push(bullet("Recent Activity Log — every change you (or your team) have made."));

  out.push(h2("3.3 Smart Alerts"));
  out.push(p("Alerts appear at the top of the Dashboard only when needed. Here are the alerts you might see:"));
  out.push(dataTable(
    ["Alert Colour", "What It Means", "What to Do"],
    [
      ["Red", "Urgent — something needs attention now.", "Examples: RSVP deadline has passed but many guests have not responded; wedding is in 7 days and key content is missing."],
      ["Amber", "Heads up — action soon.", "Examples: wedding is approaching; guest list has gaps; some content sections are still empty."],
      ["Blue", "Information — useful to know.", "Examples: new wishes this week; RSVP deadline coming up in a few days."],
      ["Green", "Good news — celebrate!", "Examples: 100% RSVP response rate; all content sections complete."],
    ],
    [15, 35, 50]
  ));
  out.push(p("You can dismiss an alert by clicking the X in its corner. Dismissed alerts stay hidden for 7 days, then reappear if the condition is still true. Dismissing does not fix the underlying issue — it just hides the banner."));

  out.push(h2("3.4 Setup Checklist"));
  out.push(p("The checklist on the right side of the Dashboard lists the key tasks to get your site ready. Click any item to jump straight to the relevant page. Tasks you have already completed show a green checkmark. The progress bar shows how far along you are."));

  out.push(callout("tip", "Start with the Checklist", "If you are not sure where to begin, work through the checklist top to bottom. By the time every item has a checkmark, your site will be ready to publish."));

  out.push(h2("3.5 Mode-Aware Display"));
  out.push(p("The Dashboard automatically changes what it emphasises based on where you are in your wedding journey:"));
  out.push(bullet("Before the wedding — focuses on RSVP collection, content completion, and upcoming deadlines."));
  out.push(bullet("Wedding week — focuses on final headcount, last-minute RSVPs, and confirmations."));
  out.push(bullet("After the wedding — focuses on wishes received, photo uploads, and thank-you messages."));
  out.push(p("You do not need to switch modes — the platform detects your wedding date and adjusts automatically."));

  // ── 4. Wedding Details ───────────────────────────────────────────────────
  out.push(h1("4. Wedding Details"));
  out.push(h2("4.1 Purpose"));
  out.push(p("The Wedding Details page is where you set the fundamental facts about your wedding: your names, the date and time, the venue, and the venue's address. These details appear throughout your website — in the hero banner, on the schedule, in the RSVP form, and in the Getting There section."));

  out.push(...screenshot("Wedding Details Form", "The Wedding Details page with fields for couple name, bride/groom names, date, time, venue, and address."));

  out.push(h2("4.2 Fields You Can Edit"));
  out.push(dataTable(
    ["Field", "What to Enter", "Where It Shows Up"],
    [
      ["Couple Display Name", "How you want to be addressed on the site (e.g. \"Eleanor & James\").", "Hero banner, page title, RSVP form."],
      ["Bride Name", "Full name of the bride.", "Story section, footers."],
      ["Groom Name", "Full name of the groom.", "Story section, footers."],
      ["Wedding Date", "The date of your wedding.", "Hero banner, countdown, RSVP deadline calculation."],
      ["Wedding Time", "Start time of the main ceremony.", "Hero banner, schedule."],
      ["Venue", "Name of your venue (e.g. \"The Grand Ballroom\").", "Hero banner, Getting There section."],
      ["Venue Address", "Full street address of the venue.", "Getting There section, embedded map."],
      ["Google Maps URL", "The share link from Google Maps for the venue.", "Powers the embedded map and directions button."],
    ],
    [22, 43, 35]
  ));

  out.push(h2("4.3 How to Edit Your Details"));
  const detailsSteps = newListRef();
  out.push(numItem(detailsSteps, "Open the Wedding Details page from the sidebar."));
  out.push(numItem(detailsSteps, "Update any field by typing in the text box or picking a date from the calendar."));
  out.push(numItem(detailsSteps, "Double-check the spelling of names and the accuracy of the date and address."));
  out.push(numItem(detailsSteps, "Click the Save button at the bottom of the form."));
  out.push(numItem(detailsSteps, "A success message confirms your changes have been saved."));

  out.push(h2("4.4 Getting Your Google Maps URL"));
  const mapsSteps = newListRef();
  out.push(numItem(mapsSteps, "Go to maps.google.com in your browser."));
  out.push(numItem(mapsSteps, "Search for your venue."));
  out.push(numItem(mapsSteps, "Click the Share button on the venue's card."));
  out.push(numItem(mapsSteps, "Click Copy Link to copy the URL to your clipboard."));
  out.push(numItem(mapsSteps, "Paste it into the Google Maps URL field on the Wedding Details page."));

  out.push(callout("note", "Couple Display Name Is Required", "You cannot save with an empty Couple Display Name. This name appears on every page of your site, so pick something you are happy to see everywhere."));

  out.push(h2("4.5 Expected Result"));
  out.push(p("After saving, your details immediately update across the website. The hero banner shows your new couple name and date. The countdown recalculates if you changed the date. The Getting There section shows the new venue and address."));

  // ── 5. Home Page ─────────────────────────────────────────────────────────
  out.push(h1("5. Home Page"));
  out.push(h2("5.1 Purpose"));
  out.push(p("The Home Page is the first thing guests see when they open your wedding website. It contains the hero banner (the big photo at the top with your names and date), the countdown timer, the introduction text, and any decorative animations you want to enable."));

  out.push(...screenshot("Home Page Editor", "The Couple Home page editor with hero text fields, hero image upload, and animation toggles."));

  out.push(h2("5.2 Editing Hero Text"));
  out.push(p("The hero is the large banner at the top of your homepage. You can edit five text fields:"));
  out.push(bullet("Hero Title — the main line, usually your names or \"Together with their families\"."));
  out.push(bullet("Hero Subtitle — a line under the title, often the invitation wording."));
  out.push(bullet("Hero Description — optional additional text below the subtitle."));
  out.push(bullet("Date Display — how the date is shown (e.g. \"Saturday, 25th December 2027\")."));
  out.push(bullet("Countdown Target Date — the date and time the countdown counts down to."));

  out.push(h2("5.3 Uploading a Hero Image"));
  out.push(p("A great hero photo sets the tone for your whole website. Use a high-quality landscape photo (at least 1920×1080 pixels) — engagement photos work beautifully."));
  const heroImgSteps = newListRef();
  out.push(numItem(heroImgSteps, "On the Home page, find the Hero Image section."));
  out.push(numItem(heroImgSteps, "Click Upload Image."));
  out.push(numItem(heroImgSteps, "Choose a photo from your computer."));
  out.push(numItem(heroImgSteps, "Wait for the upload to complete — you will see a preview."));
  out.push(numItem(heroImgSteps, "Click Save to apply the new hero image."));

  out.push(callout("tip", "Pick a Wide Photo", "Hero images are displayed in landscape (wide) format. Portrait photos will be cropped and may cut off important parts. If you only have a portrait photo, consider using it on the Story page instead."));

  out.push(h2("5.4 Animations"));
  out.push(p("Depending on your package, you may have access to ambient animations that play softly in the background of your hero banner. The available animations are:"));
  out.push(bullet("Gold Dust — gentle gold particles drifting upward. Elegant and timeless."));
  out.push(bullet("Meteors — shooting-star streaks across a starfield. Dreamy and romantic."));
  out.push(bullet("Bubbles — soft raindrop ripple rings expanding and fading. Playful and modern."));
  out.push(p("You can enable one animation at a time. Toggle it on, click Save, and preview your site to see it in action. If you change your mind, toggle it off and try another."));

  out.push(callout("note", "Animations Are Optional", "Animations can make your site feel magical, but they also use more battery on mobile devices. If many of your guests are older or have older phones, you may want to leave animations off."));

  out.push(h2("5.5 Tea Ceremony and Narrative Sections"));
  out.push(p("If your wedding includes a tea ceremony or other cultural tradition, the Home page also lets you edit the labels and descriptions for those sections. Each has a Label (small eyebrow text), a Title (the main heading), and a Body (the descriptive paragraph). Edit these to reflect your specific traditions."));

  out.push(h2("5.6 Saving Your Changes"));
  out.push(p("After editing any Home page field, click the Save button at the top or bottom of the editor. A success message confirms your changes are saved. To see them on the actual website, click Preview in the top bar."));

  // ── 6. Schedule ──────────────────────────────────────────────────────────
  out.push(h1("6. Schedule"));
  out.push(h2("6.1 Purpose"));
  out.push(p("The Schedule page lets you build a timeline of your wedding day so guests know exactly what is happening when. Each item shows a title, start and end time, optional description, and optional location."));

  out.push(...screenshot("Schedule Editor", "The Schedule page with event items listed, an Add Event button, and editable time/location fields."));

  out.push(h2("6.2 Event Types"));
  out.push(p("Each schedule item has a type, which controls its colour on the public schedule. Available types:"));
  out.push(dataTable(
    ["Type", "Use For", "Colour"],
    [
      ["Ceremony Section", "Tea ceremony, traditional rites, pre-ceremony events", "Amber"],
      ["Ceremony", "The main wedding ceremony (solemnisation, vows)", "Rose"],
      ["Reception", "Cocktail hour, meet-and-greet, photo session", "Emerald"],
      ["Dinner", "Banquet, dinner, toasts", "Violet"],
      ["Custom", "Anything else (after-party, farewell brunch, etc.)", "Sky blue"],
    ],
    [25, 55, 20]
  ));

  out.push(h2("6.3 Adding a Schedule Item"));
  const addEventSteps = newListRef();
  out.push(numItem(addEventSteps, "Open the Schedule page from the sidebar."));
  out.push(numItem(addEventSteps, "Click the Add Event button."));
  out.push(numItem(addEventSteps, "Pick an event type from the dropdown."));
  out.push(numItem(addEventSteps, "Enter a title (e.g. \"Wedding Ceremony\")."));
  out.push(numItem(addEventSteps, "Enter the start time (and optionally end time) using the time picker."));
  out.push(numItem(addEventSteps, "Optional: add a description (e.g. \"Solemnisation followed by group photos\")."));
  out.push(numItem(addEventSteps, "Optional: add a location (e.g. \"Main Ballroom\")."));
  out.push(numItem(addEventSteps, "Click Save."));

  out.push(h2("6.4 Editing or Deleting an Item"));
  out.push(p("Find the item in the list, then click the Edit (pencil) or Delete (trash) icon. Confirm deletion when prompted — deleted items cannot be recovered."));

  out.push(h2("6.5 Reordering Items"));
  out.push(p("Schedule items are automatically sorted by start time on the public website. You can also set a manual sort order by editing an item and changing its position — but in most cases the automatic time-based sort is what you want."));

  out.push(callout("tip", "Add Buffer Time", "Always leave 15–30 minutes of buffer between major events. Weddings rarely run exactly on time, and the buffer absorbs small delays without throwing off the whole schedule."));

  out.push(h2("6.6 Section Text"));
  out.push(p("Above the list of events, there is a Section Title and Subtitle field. Edit these to label the schedule section on your website (for example, \"Wedding Day Schedule\" and \"Saturday, 25th December 2027\")."));

  out.push(h2("6.7 Saving All Changes"));
  out.push(p("The Schedule page has one Save button that saves both the section text and any event edits you have made. Click it before leaving the page to avoid losing changes."));

  // ── 7. RSVP Settings ─────────────────────────────────────────────────────
  out.push(h1("7. RSVP Settings"));
  out.push(h2("7.1 Purpose"));
  out.push(p("The RSVP page lets you customise how your RSVP form looks and behaves. You can change every label your guests see, set the RSVP deadline, write custom thank-you messages, define dietary options, and more."));

  out.push(...screenshot("RSVP Settings Page", "The RSVP page with the section content fields at the top and the list of received RSVPs below."));

  out.push(h2("7.2 Customising Section Text"));
  out.push(p("Edit the labels and prompts that appear on your RSVP section:"));
  out.push(bullet("Section Title — the heading above the RSVP form (e.g. \"RSVP\")."));
  out.push(bullet("Section Subtitle — a prompt above the form (e.g. \"Kindly respond by 1st November 2027\")."));
  out.push(bullet("RSVP Deadline — the date by which guests must respond. Used in reminders and alerts."));
  out.push(bullet("Thank You Message — shown after a guest submits their RSVP."));
  out.push(bullet("Declined Message — shown when a guest declines."));
  out.push(bullet("Ceremony Name — the name of your ceremony (e.g. \"Wedding Solemnisation\")."));

  out.push(h2("7.3 Customising RSVP Option Labels"));
  out.push(p("Guests choose from three options when responding. You can customise the label for each:"));
  out.push(bullet("\"Yes\" Option Label — for guests attending the whole event."));
  out.push(bullet("\"Partial\" Option Label — for guests attending only part (e.g. ceremony but not reception)."));
  out.push(bullet("\"No\" Option Label — for guests who cannot attend."));

  out.push(h2("7.4 Dietary Options"));
  out.push(p("Enter the dietary options guests can choose from, separated by commas (e.g. \"Halal, Vegetarian, No Seafood, Vegan\"). Guests select one per person in their party."));

  out.push(h2("7.5 Step Labels"));
  out.push(p("The RSVP form has three steps. You can customise the title and subtext of each:"));
  out.push(bullet("Step 1 — guest enters their name to find their invitation."));
  out.push(bullet("Step 2 — guest indicates how many people are in their party."));
  out.push(bullet("Step 3 — guest confirms each person's attendance and dietary needs."));

  out.push(h2("7.6 Result Messages"));
  out.push(p("Customise the headlines shown on the result screens:"));
  out.push(bullet("Thank You Title — the heading on the success screen."));
  out.push(bullet("Declined Title — the heading when a guest declines."));

  out.push(h2("7.7 Viewing Received RSVPs"));
  out.push(p("Below the settings, the page lists every RSVP you have received. Each entry shows the guest's name, party size, response date, and the attendance status of each person in their party. Use the search box to find a specific guest, and the status filter to show only \"All Attending\", \"All Declined\", or \"Mixed\" responses."));

  out.push(h2("7.8 Exporting RSVPs"));
  out.push(p("Click the Export CSV button to download all your RSVPs as a spreadsheet. This is useful for printing a final headcount for your caterer or seating chart."));

  out.push(callout("tip", "Set a Realistic Deadline", "Set your RSVP deadline 2–3 weeks before the wedding. This gives you time to follow up with non-responders and finalize your headcount with the caterer."));

  // ── 8. Guest Management ──────────────────────────────────────────────────
  out.push(h1("8. Guest Management"));
  out.push(h2("8.1 Purpose"));
  out.push(p("The Guests page is your master guest list. Every guest you add here gets a unique invitation code that lets them RSVP without you having to track responses manually. You can also organise guests into groups (Bride's Family, Groom's Friends, etc.) and assign table numbers for seating charts."));

  out.push(...screenshot("Guests List", "The Guests page showing the searchable, filterable table of all guests with their RSVP status."));

  out.push(h2("8.2 Adding a Single Guest"));
  const addGuestSteps = newListRef();
  out.push(numItem(addGuestSteps, "Open the Guests page from the sidebar."));
  out.push(numItem(addGuestSteps, "Click the Add Guest button."));
  out.push(numItem(addGuestSteps, "Enter the guest's name (required)."));
  out.push(numItem(addGuestSteps, "Optional: enter their email and phone number."));
  out.push(numItem(addGuestSteps, "Optional: enter a group name (e.g. \"Bride's Family\") to organise guests."));
  out.push(numItem(addGuestSteps, "Optional: enter a table number for seating chart purposes."));
  out.push(numItem(addGuestSteps, "Optional: tick the Plus One box if this guest is allowed to bring a guest, and enter the plus-one's name if known."));
  out.push(numItem(addGuestSteps, "Optional: add dietary notes (e.g. \"Vegetarian\")."));
  out.push(numItem(addGuestSteps, "Click Save."));

  out.push(h2("8.3 Editing or Deleting a Guest"));
  out.push(p("Find the guest in the list, then click the Edit (pencil) or Delete (trash) icon. Confirm deletion when prompted. Deleting a guest also removes their RSVP and invitation code."));

  out.push(h2("8.4 Searching and Filtering"));
  out.push(p("Use the search box at the top to find guests by name, email, or phone. Use the Status filter to show only guests with a specific RSVP status:"));
  out.push(bullet("Pending — invited but has not responded yet."));
  out.push(bullet("Attending — confirmed they are coming."));
  out.push(bullet("Declined — confirmed they cannot make it."));
  out.push(bullet("Partial — attending only part of the event."));

  out.push(h2("8.5 Invitation Codes"));
  out.push(p("Every guest gets a unique invitation code automatically. This code is what they enter on your RSVP form to find their invitation. You do not need to do anything to generate codes — they are created when you add the guest. You can see each guest's code in the Guests list."));

  out.push(h2("8.6 Tracking RSVP Status"));
  out.push(p("The RSVP Status column shows each guest's current status, colour-coded for quick scanning. The status updates automatically when a guest submits their RSVP. If you receive a verbal RSVP (over the phone or in person), you can manually update a guest's status by editing their record."));

  out.push(h2("8.7 Sending Invitations"));
  out.push(p("For each guest, you can record how you sent their invitation (Email, SMS, WhatsApp, Paper) and when. Use the Sharing page (see section 16) to generate a personalised link or QR code for each guest."));

  out.push(callout("tip", "Use Groups Wisely", "Organise guests into meaningful groups (Bride's Family, Groom's Family, Bride's Friends, Groom's Friends, Colleagues, etc.). This makes it easy to filter the list and to see response rates by group on the Analytics page."));

  out.push(callout("best", "Add All Guests Before Sending Invitations", "It is much easier to add all your guests at once (using CSV import — see section 9) before you start sending invitations. This way every guest has a valid invitation code when they try to RSVP."));

  // ── 9. Importing Guests from CSV ─────────────────────────────────────────
  out.push(h1("9. Importing Guests from CSV"));
  out.push(h2("9.1 Purpose"));
  out.push(p("If you have a large guest list (50+ guests), adding them one by one is tedious. The CSV import feature lets you upload a spreadsheet of all your guests at once. The platform parses it, shows you a preview, and creates all the guest records in one go."));

  out.push(h2("9.2 Step-by-Step Import"));
  const csvSteps = newListRef();
  out.push(numItem(csvSteps, "Open the Guests page from the sidebar."));
  out.push(numItem(csvSteps, "Click the Import CSV button. The import dialog opens."));
  out.push(numItem(csvSteps, "Optional: click Download Template to get a sample CSV file with the correct column headers and an example row."));
  out.push(numItem(csvSteps, "Open the template in Excel, Google Sheets, or any spreadsheet app. Replace the example row with your actual guests."));
  out.push(numItem(csvSteps, "Save the file as a CSV (Comma-Separated Values) file."));
  out.push(numItem(csvSteps, "Back in the import dialog, click Choose File and select your CSV."));
  out.push(numItem(csvSteps, "Click Upload. The platform parses your file and shows a preview of every row."));
  out.push(numItem(csvSteps, "Review the preview. Any rows with problems (e.g. missing name) are highlighted in red."));
  out.push(numItem(csvSteps, "Click Confirm Import to create the guest records."));
  out.push(numItem(csvSteps, "A summary screen shows how many guests were created, how many were skipped (duplicates), and any errors."));

  out.push(h2("9.3 CSV Column Format"));
  out.push(p("Your CSV must have a header row with these column names (lowercase). Only \"name\" is required; the rest are optional:"));
  out.push(dataTable(
    ["Column", "Required?", "Example"],
    [
      ["name", "Yes", "John Smith"],
      ["email", "No", "john@email.com"],
      ["phone", "No", "+65 9123 4567"],
      ["group", "No", "Bride's Family"],
      ["tableNumber", "No", "1"],
      ["plusOne", "No", "yes"],
      ["plusOneName", "No", "Jane Smith"],
      ["dietaryNotes", "No", "Vegetarian"],
    ],
    [22, 18, 60]
  ));

  out.push(callout("note", "Column Name Flexibility", "The import tool also recognises column names from the platform's own export format (e.g. \"Plus One\", \"Dietary Notes\", \"Table 8\"). It is not case-sensitive. So if you exported your existing guest list and want to re-import an edited version, you do not need to rename columns first."));

  out.push(h2("9.4 Plus One Values"));
  out.push(p("In the plusOne column, use any of these values to indicate the guest has a plus-one: yes, true, 1, y. Leave the cell blank or use no/false/0 to indicate no plus-one."));

  out.push(h2("9.5 Common Import Mistakes"));
  out.push(callout("note", "Watch Out for These", "(1) Forgetting the header row — the first row must contain column names, not a guest. (2) Using a semicolon instead of a comma as the separator — CSV means comma. (3) Special characters in names — accents (é, ñ) are fine but make sure your file is saved as UTF-8. (4) Leading or trailing spaces in names — these cause RSVP lookup failures."));

  out.push(h2("9.6 Exporting Your Guest List"));
  out.push(p("You can download your current guest list as a CSV at any time. Click the Export CSV button on the Guests page. The downloaded file contains every guest with their current RSVP status — useful for sharing with your caterer or printing seating chart labels."));

  out.push(h2("9.7 Handling Duplicates"));
  out.push(p("When importing, the platform checks for guests with the same name (case-insensitive). Duplicates are skipped and reported in the import summary. If you want to update an existing guest's details, edit them individually instead of re-importing."));

  // ── 10. Analytics ────────────────────────────────────────────────────────
  out.push(h1("10. Analytics"));
  out.push(h2("10.1 Purpose"));
  out.push(p("The Analytics page turns your guest list and RSVP data into insights. See your overall response rate, break it down by group, identify who has not responded yet, check dietary requirements, and resolve any unmatched RSVP submissions."));

  out.push(...screenshot("Analytics Page", "The Analytics page with KPI cards, RSVP pie chart, group breakdown table, and action lists."));

  out.push(h2("10.2 KPI Cards"));
  out.push(p("Four cards across the top show your headline numbers:"));
  out.push(bullet("Total Guests — every guest on your list."));
  out.push(bullet("Response Rate — percentage of guests who have responded."));
  out.push(bullet("Wishes Count — how many wishes you have received."));
  out.push(bullet("Plus-Ones Confirmed — total plus-ones confirmed by attending guests."));

  out.push(h2("10.3 RSVP Distribution"));
  out.push(p("A pie chart shows the breakdown of RSVP responses: Attending, Declined, Pending, and Partial. Each slice is colour-coded. Hover over a slice to see the exact count."));

  out.push(h2("10.4 Group Breakdown"));
  out.push(p("A table shows RSVP stats broken down by group (Bride's Family, Groom's Friends, etc.). For each group you can see total guests, attending, declined, pending, and the response rate. This helps you spot groups that need a nudge."));

  out.push(h2("10.5 Non-Responders List"));
  out.push(p("A list shows every guest who has not responded yet. Each row shows the guest's name, group, email, and phone — so you can reach out directly. Use the Export button to download this list for follow-up calls or messages."));

  out.push(callout("tip", "Follow Up Strategically", "Sort the Non-Responders list by group. Reach out to the group with the lowest response rate first — usually a single group chat or family member can chase multiple guests at once."));

  out.push(h2("10.6 Dietary Requirements"));
  out.push(p("A list shows every guest who has indicated a dietary requirement, with the specific note they entered (e.g. \"Vegetarian\", \"No shellfish\", \"Halal\"). Print this list and hand it to your caterer a few days before the wedding."));

  out.push(h2("10.7 Unmatched RSVPs"));
  out.push(p("Sometimes a guest submits an RSVP but their name does not match anyone on your guest list exactly. This can happen because of:"));
  out.push(bullet("A typo in their name when they filled out the form."));
  out.push(bullet("A guest using a different name (e.g. a nickname or middle name)."));
  out.push(bullet("A plus-one RSVPing without being on your list."));
  out.push(p("The Unmatched RSVPs list shows every such submission. For each one, you can:"));
  out.push(bullet("Match it to an existing guest on your list (use the dropdown to pick the right guest)."));
  out.push(bullet("Create a new guest record from the submission."));
  out.push(bullet("Dismiss it if it was a duplicate or mistake."));

  out.push(h2("10.8 How to Match an Unmatched RSVP"));
  const matchSteps = newListRef();
  out.push(numItem(matchSteps, "On the Analytics page, scroll to the Unmatched RSVPs section."));
  out.push(numItem(matchSteps, "Read the submitted name and party size to figure out who it is."));
  out.push(numItem(matchSteps, "Use the dropdown next to the submission to pick the matching guest from your list."));
  out.push(numItem(matchSteps, "Click Match. The submission is linked to that guest and the guest's RSVP status is updated."));

  out.push(callout("note", "Check Unmatched Regularly", "Check the Unmatched RSVPs list at least once a week while RSVPs are coming in. The sooner you match a submission, the more accurate your headcount will be."));

  // ── 11. Wishes ───────────────────────────────────────────────────────────
  out.push(h1("11. Wishes"));
  out.push(h2("11.1 Purpose"));
  out.push(p("The Wishes feature lets your guests leave heartfelt messages on your website. It is a digital guestbook that you can read during the lead-up to the wedding and treasure for years afterwards."));

  out.push(...screenshot("Wishes Page", "The Wishes page with customisable section text and the list of received wishes."));

  out.push(h2("11.2 Customising the Wishes Section"));
  out.push(p("Edit the labels and prompts that appear on your public wishes section:"));
  out.push(bullet("Section Title — e.g. \"Wishes & Blessings\"."));
  out.push(bullet("Section Subtitle — e.g. \"Leave your heartfelt message for the couple\"."));
  out.push(bullet("Name Field Label — e.g. \"Your Name\"."));
  out.push(bullet("Message Field Label — e.g. \"Your Message\"."));
  out.push(bullet("Relationship Field Label — e.g. \"Your Relationship to the Couple\"."));
  out.push(bullet("Submit Button Label — e.g. \"Weave into Archive\"."));
  out.push(bullet("Section Eyebrow — small text above the title, e.g. \"The Living Heirloom\"."));
  out.push(bullet("Form Eyebrow / Heading — labels for the form area."));

  out.push(h2("11.3 Viewing Received Wishes"));
  out.push(p("Below the settings, the page lists every wish you have received, newest first. Each entry shows the sender's name, their relationship (if provided), the message, the date it was posted, and how long ago. Use the search box to find wishes from a specific person or containing specific words."));

  out.push(h2("11.4 Deleting a Wish"));
  out.push(p("If a wish is inappropriate or duplicate, you can delete it. Click the Delete (trash) icon next to the wish and confirm. Deleted wishes cannot be recovered. Use this sparingly — guests put thought into their messages."));

  out.push(h2("11.5 Exporting Wishes"));
  out.push(p("Click the Export CSV button to download all your wishes as a spreadsheet. This is a beautiful way to preserve them — print them out, paste them into a wedding scrapbook, or read them at your rehearsal dinner."));

  out.push(callout("best", "Read Wishes Aloud", "Many couples read a selection of wishes at their rehearsal dinner or morning-of breakfast. It is a wonderful way to feel the love from guests who could not be there."));

  out.push(h2("11.6 Wishes With Photos"));
  out.push(p("Depending on your package, guests may be able to attach a photo to their wish. Photo wishes appear with the image inline. You can delete a wish with a photo just like a text wish — the photo is removed along with the message."));

  // ── 12. Story ────────────────────────────────────────────────────────────
  out.push(h1("12. Story"));
  out.push(h2("12.1 Purpose"));
  out.push(p("The Story section is your love story timeline. Add milestones — how you met, your first date, the proposal, and other meaningful moments — each with a title, date, photo, and description. Guests love reading the backstory of how you came to be together."));

  out.push(...screenshot("Story Editor", "The Story page with timeline items, an Add Story button, and editable story fields."));

  out.push(h2("12.2 Adding a Story Item"));
  const addStorySteps = newListRef();
  out.push(numItem(addStorySteps, "Open the Story page from the sidebar."));
  out.push(numItem(addStorySteps, "Click the Add Story button."));
  out.push(numItem(addStorySteps, "Enter a title (e.g. \"How We Met\")."));
  out.push(numItem(addStorySteps, "Optional: enter a date (e.g. \"June 2019\")."));
  out.push(numItem(addStorySteps, "Optional: upload an image. Pick a photo that captures the moment — engagement photos work beautifully here."));
  out.push(numItem(addStorySteps, "Write the story content in the large text box. Take your time — this is your chance to share your voice with your guests."));
  out.push(numItem(addStorySteps, "Click Save."));

  out.push(h2("12.3 Editing or Deleting a Story Item"));
  out.push(p("Find the story item in the list and click Edit (pencil) or Delete (trash). Confirm deletion when prompted."));

  out.push(h2("12.4 Reordering Story Items"));
  out.push(p("Story items appear on your website in the order you set. You can reorder them by editing each item and changing its sort order, or by dragging the grip handle if your interface supports it. Most couples arrange their story chronologically."));

  out.push(h2("12.5 Story Tidbits (Optional)"));
  out.push(p("In addition to the main story timeline, you can add short \"tidbits\" — quick fun facts about the two of you. Examples: \"Our first date was at a tiny ramen shop in town\", \"We have a cat named Mochi who thinks she owns the apartment\", \"James proposed on a rainy Sunday morning in pyjamas\". Tidbits appear as small cards between story items."));

  out.push(h2("12.6 Honeymoon Destinations (Optional)"));
  out.push(p("If you want to share where you are going on your honeymoon, you can add destination cards to your story page. Each destination shows a name and an optional image."));

  out.push(h2("12.7 Section Text"));
  out.push(p("Above the story items, edit the Section Title (e.g. \"Our Story\") and Subtitle (e.g. \"How we got here\"). These appear at the top of your story page on the public website."));

  out.push(callout("tip", "Write in Your Own Voice", "Your story does not need to be poetic — it just needs to be you. Write the way you talk. Guests who know you will hear your voice in the words, and that is what makes it special."));

  // ── 13. Moments Gallery ──────────────────────────────────────────────────
  out.push(h1("13. Moments Gallery"));
  out.push(h2("13.1 Purpose"));
  out.push(p("The Moments section is your photo gallery — a place to share captured memories with your guests. Use it for engagement photos, pre-wedding shoot highlights, behind-the-scenes snaps, and after the wedding, your professional photos."));

  out.push(...screenshot("Moments Gallery", "The Moments page with section title/subtitle fields and the photo upload area."));

  out.push(h2("13.2 Setting Section Text"));
  out.push(p("Edit two fields:"));
  out.push(bullet("Section Title — e.g. \"Moments\" or \"Captured Memories\"."));
  out.push(bullet("Section Subtitle — e.g. \"Photos from our journey together\"."));
  out.push(p("Click Save after editing."));

  out.push(h2("13.3 Uploading Photos"));
  out.push(p("Photos for the Moments gallery are managed through your wedding's media library. To add new photos:"));
  const momentsUploadSteps = newListRef();
  out.push(numItem(momentsUploadSteps, "Use the media upload control on the Moments page (or the dedicated Media page if available)."));
  out.push(numItem(momentsUploadSteps, "Click Upload and select one or more photos from your computer."));
  out.push(numItem(momentsUploadSteps, "Wait for the upload to complete — large photos may take a few seconds each."));
  out.push(numItem(momentsUploadSteps, "Uploaded photos appear in the gallery immediately."));
  out.push(numItem(momentsUploadSteps, "Click Save if your changes have not been auto-saved."));

  out.push(callout("tip", "Use High-Quality Photos", "Photos look best at 1200×800 pixels or larger. Avoid extremely small images — they will look blurry when displayed in the gallery. Most modern phone cameras produce photos that are more than good enough."));

  out.push(h2("13.4 Reordering Photos"));
  out.push(p("Drag photos into the order you want them to appear on the website. Most couples start with their favourite photo as the first one guests see."));

  out.push(h2("13.5 Deleting a Photo"));
  out.push(p("Hover over a photo and click the Delete (trash) icon to remove it. Confirm when prompted. The photo is removed from your gallery but stays in your media library if you want to re-add it later."));

  out.push(h2("13.6 Adding Photos After the Wedding"));
  out.push(p("After your wedding, you will receive your professional photos. Upload your favourites to the Moments gallery to share them with guests who attended — and with those who could not. Many couples add 20–40 highlights over the weeks following the wedding."));

  out.push(callout("best", "Curate, Don't Dump", "It is tempting to upload every photo from your shoot, but guests will only look at the first 10–15. Pick your absolute favourites and leave the rest for your personal album. Quality over quantity."));

  // ── 14. Q&A ──────────────────────────────────────────────────────────────
  out.push(h1("14. Q&A"));
  out.push(h2("14.1 Purpose"));
  out.push(p("The Q&A (Questions & Answers) section lets you pre-empt the questions guests are bound to ask: what is the dress code, are kids allowed, where should I park, is there a gift registry. Answering these on your website saves you and your consultant dozens of phone calls and messages."));

  out.push(...screenshot("Q&A Page", "The Q&A page with section text fields and the list of question/answer pairs."));

  out.push(h2("14.2 Customising Section Text"));
  out.push(p("Edit the labels and prompts on your Q&A section:"));
  out.push(bullet("Section Title — e.g. \"Questions & Answers\"."));
  out.push(bullet("Section Subtitle — e.g. \"Everything you need to know\"."));
  out.push(bullet("Contact Prompt — e.g. \"Still have questions? Message the couple\"."));
  out.push(bullet("Contact Email — where guests can reach you."));
  out.push(bullet("CTA Eyebrow — small text above the call-to-action."));
  out.push(bullet("CTA Description — a paragraph inviting guests to reach out."));
  out.push(bullet("CTA Button Label — e.g. \"Message the Couple\"."));

  out.push(h2("14.3 Adding a Question"));
  const addFaqSteps = newListRef();
  out.push(numItem(addFaqSteps, "Open the Q&A page from the sidebar."));
  out.push(numItem(addFaqSteps, "Click the Add Question button."));
  out.push(numItem(addFaqSteps, "Type the question (e.g. \"What is the dress code?\")."));
  out.push(numItem(addFaqSteps, "Type the answer (e.g. \"Garden formal — think floral dresses, light suits, comfortable shoes for the lawn.\")."));
  out.push(numItem(addFaqSteps, "Make sure the Active toggle is on so the question appears on your website."));
  out.push(numItem(addFaqSteps, "Click Save."));

  out.push(h2("14.4 Editing or Deleting a Question"));
  out.push(p("Find the question in the list and click Edit (pencil) or Delete (trash). Confirm deletion when prompted."));

  out.push(h2("14.5 Hiding a Question Without Deleting"));
  out.push(p("If you want to keep a question for later but not show it currently, switch its Active toggle off. The question stays in your list but is hidden from the public website. Toggle it back on to show it again."));

  out.push(h2("14.6 Reordering Questions"));
  out.push(p("Questions appear in the order you set. Edit each question and change its sort order, or use the drag handle if available. Put the most important questions (dress code, parking, kids) at the top."));

  out.push(h2("14.7 Suggested Questions to Include"));
  out.push(callout("tip", "Common Guest Questions", "Consider adding Q&A entries for: (1) Dress code. (2) Parking and transport. (3) Whether kids are invited. (4) Gift registry details. (5) Photography policy (can guests take photos during the ceremony?). (6) Start time and arrival recommendation. (7) Dietary accommodations. (8) Hotel room block details."));

  out.push(h2("14.8 Saving Changes"));
  out.push(p("After editing any field or list item, click the Save button. Your changes are stored but not yet visible on your public website until you publish (see section 18)."));

  // ── 15. Getting There ────────────────────────────────────────────────────
  out.push(h1("15. Getting There"));
  out.push(h2("15.1 Purpose"));
  out.push(p("The Getting There section gives guests directions to your venue — by car, by public transit, and parking information. A good Getting There page reduces late arrivals and lost guests on your big day."));

  out.push(...screenshot("Getting There Editor", "The Getting There page with title/subtitle fields and sections for car, transit, and parking."));

  out.push(h2("15.2 Fields You Can Edit"));
  out.push(dataTable(
    ["Field", "What to Enter"],
    [
      ["Section Title", "e.g. \"Getting There\""],
      ["Section Subtitle", "e.g. \"Find your way to our celebration\""],
      ["By Car Title", "e.g. \"By Car\""],
      ["By Car Directions", "Driving directions and parking info. Be specific — mention landmarks, exit numbers, and any one-way streets."],
      ["Public Transit Title", "e.g. \"Public Transit\""],
      ["Public Transit Directions", "MRT/bus directions. Mention the nearest station, exit number, and walking time."],
      ["Parking Note", "Parking availability and rates. Mention if parking is free, validated, or paid."],
    ],
    [25, 75]
  ));

  out.push(h2("15.3 How to Edit"));
  const gettingThereSteps = newListRef();
  out.push(numItem(gettingThereSteps, "Open the Getting There page from the sidebar."));
  out.push(numItem(gettingThereSteps, "Update any field by typing in the text box."));
  out.push(numItem(gettingThereSteps, "Use the large text areas for multi-line directions."));
  out.push(numItem(gettingThereSteps, "Click the Save button."));

  out.push(h2("15.4 The Embedded Map"));
  out.push(p("Below your text, an embedded Google Map shows your venue location. The map is powered by the Google Maps URL you entered on the Wedding Details page (see section 4.4). If the map is blank or shows the wrong location, update your Google Maps URL on the Wedding Details page."));

  out.push(callout("tip", "Test the Directions Yourself", "Before publishing, drive or take transit to your venue following your own directions. Fix anything that is unclear. Your guests will thank you."));

  out.push(h2("15.5 Expected Result"));
  out.push(p("After saving and publishing, your Getting There section shows the title, subtitle, directions text, parking note, and the embedded map. Guests can click the map to open Google Maps for turn-by-turn navigation."));

  // ── 16. Sharing Your Invitation ──────────────────────────────────────────
  out.push(h1("16. Sharing Your Invitation"));
  out.push(h2("16.1 Purpose"));
  out.push(p("The Sharing page helps you distribute your wedding website link to guests. Generate a QR code for paper invitations, copy your public website URL, and track which guests have received their invitation."));

  out.push(...screenshot("Sharing Page", "The Sharing page with QR code, copy link button, and per-guest invitation tracking."));

  out.push(h2("16.2 Your Public Website URL"));
  out.push(p("At the top of the Sharing page, you will see your public website URL — something like https://your-platform.com/your-couple-name. This is the link guests visit to see your wedding website."));
  out.push(bullet("Click the Copy button to copy the URL to your clipboard."));
  out.push(bullet("Click the Open button to open your website in a new tab."));
  out.push(bullet("Paste the URL into emails, WhatsApp messages, social media, or paper invitations."));

  out.push(h2("16.3 Generating a QR Code"));
  out.push(p("A QR code is displayed on the Sharing page. Guests can scan it with their phone camera to open your wedding website instantly — no typing required."));
  const qrSteps = newListRef();
  out.push(numItem(qrSteps, "On the Sharing page, find the QR code image."));
  out.push(numItem(qrSteps, "Click the Download button below the QR code."));
  out.push(numItem(qrSteps, "Save the image file to your computer."));
  out.push(numItem(qrSteps, "Insert the QR code image into your paper invitation design, or print it on a separate card to include with your invitation."));
  out.push(numItem(qrSteps, "Test the QR code by scanning it with your own phone before sending."));

  out.push(h2("16.4 Per-Guest Invitation Tracking"));
  out.push(p("Below the QR code, a table lists every guest on your list. For each guest, you can record:"));
  out.push(bullet("Sent Via — how you sent the invitation (Email, SMS, WhatsApp, Paper, etc.)."));
  out.push(bullet("Sent At — when you sent it."));
  out.push(bullet("RSVP Status — their current response."));
  out.push(p("Use this table to keep track of who you have contacted and who still needs a nudge."));

  out.push(h2("16.5 Searching for a Specific Guest"));
  out.push(p("Use the search box above the guest table to find a specific guest by name. This is helpful when you have a large list and want to update just one guest's invitation status."));

  out.push(h2("16.6 Marking an Invitation as Sent"));
  const markSentSteps = newListRef();
  out.push(numItem(markSentSteps, "Find the guest in the table (use search if needed)."));
  out.push(numItem(markSentSteps, "Use the Sent Via dropdown to pick how you sent their invitation."));
  out.push(numItem(markSentSteps, "The Sent At date is automatically recorded as today."));
  out.push(numItem(markSentSteps, "Repeat for each guest as you send their invitations."));

  out.push(callout("tip", "Personalise Where Possible", "A personal WhatsApp message with the link almost always gets a faster response than a mass email. Take 10 minutes to send personalised messages to your closest 20 guests — they will respond quickly and others will follow their lead."));

  out.push(callout("best", "Send in Batches", "Do not send all your invitations on the same day. Send them in batches of 20–30 over a week. This spreads out the RSVP responses so you are not overwhelmed, and lets you fix any issues (typos, broken links) early."));

  // ── 17. Previewing Your Website ──────────────────────────────────────────
  out.push(h1("17. Previewing Your Website"));
  out.push(h2("17.1 Purpose"));
  out.push(p("Preview mode shows you exactly what your guests will see — without publishing your changes yet. Use it every time you make significant edits, so you can catch mistakes before they go live."));

  out.push(h2("17.2 How to Preview"));
  const previewSteps = newListRef();
  out.push(numItem(previewSteps, "Click the Preview button in the top bar of the Couple CMS."));
  out.push(numItem(previewSteps, "Your wedding website opens in a new browser tab, showing all your saved (but unpublished) changes."));
  out.push(numItem(previewSteps, "Browse every page — Home, Schedule, RSVP, Story, Wishes, Q&A, Moments, Getting There."));
  out.push(numItem(previewSteps, "Test the RSVP form yourself to make sure the steps and labels are clear."));
  out.push(numItem(previewSteps, "Check on your phone as well as your computer — most guests will view on mobile."));
  out.push(numItem(previewSteps, "Close the preview tab when you are done."));

  out.push(h2("17.3 What You See in Preview"));
  out.push(p("Preview shows your website exactly as guests will see it — same colours, fonts, images, text, and animations. The only difference is the URL: preview URLs include a special token that lets you see unpublished changes. Guests who visit your normal URL still see the last published version."));

  out.push(h2("17.4 What to Check in Preview"));
  out.push(callout("tip", "Preview Checklist", "Each time you preview, check: (1) Hero image looks good on mobile and desktop. (2) Names and dates are spelled correctly. (3) All menu items work and lead to the right pages. (4) RSVP form flows correctly and shows the right messages. (5) No placeholder text remains (e.g. \"Lorem ipsum\"). (6) Photos load quickly and are not blurry. (7) Contact information is correct."));

  out.push(h2("17.5 Expected Result"));
  out.push(p("After previewing, you should feel confident that your website looks great and works smoothly. If you spot any issues, go back to the relevant CMS page, fix them, save, and preview again. Only click Publish when you are completely happy."));

  // ── 18. Publishing Changes ───────────────────────────────────────────────
  out.push(h1("18. Publishing Changes"));
  out.push(h2("18.1 Purpose"));
  out.push(p("Publishing pushes your saved changes from the CMS to the live website your guests see. Until you publish, your changes are saved in your account but invisible to guests. Publishing is what makes your edits \"go live\"."));

  out.push(h2("18.2 How to Publish"));
  const publishSteps = newListRef();
  out.push(numItem(publishSteps, "Make sure all your changes are saved. Look for any unsaved indicators on the CMS pages."));
  out.push(numItem(publishSteps, "Optional: preview your website one last time (see section 17)."));
  out.push(numItem(publishSteps, "Click the Publish button in the top bar of the Couple CMS."));
  out.push(numItem(publishSteps, "A confirmation dialog appears. Review the summary of changes."));
  out.push(numItem(publishSteps, "Click Confirm to publish."));
  out.push(numItem(publishSteps, "A success message confirms your changes are now live."));

  out.push(h2("18.3 What Happens When You Publish"));
  out.push(p("Your saved content, images, theme, and settings replace the previously published versions on your live website. Guests who visit your URL immediately see the new version. Anyone currently viewing your site may need to refresh their browser to see the latest changes."));

  out.push(callout("note", "Publishing Is Instant", "Once you click Confirm, changes are live immediately. There is no undo for publishing — but you can always make more changes and publish again."));

  out.push(h2("18.4 When to Publish"));
  out.push(p("You can publish as often as you like. Most couples publish in waves:"));
  out.push(bullet("First publish: when the basics are ready (details, hero photo, schedule). This makes the site shareable."));
  out.push(bullet("Second publish: after adding the story, photos, and Q&A."));
  out.push(bullet("Final publish: after the guest list is loaded and RSVP is ready to receive responses."));
  out.push(bullet("Post-wedding publish: to add wedding photos and a thank-you message."));

  out.push(h2("18.5 What Publishing Does NOT Change"));
  out.push(p("Publishing does not change your wedding's URL, your login credentials, or your guest list. It only updates the visible content of your website. Guests who have already submitted RSVPs will not be affected — their responses are stored in your guest list and analytics."));

  out.push(callout("best", "Publish Confidently", "Do not be afraid to publish. You can always make changes and publish again. The biggest mistake couples make is leaving their site unpublished for too long because they are waiting for it to be \"perfect\". Done is better than perfect."));

  // ── 19. Best Practices ───────────────────────────────────────────────────
  out.push(h1("19. Best Practices"));
  out.push(p("This section collects the most important tips from couples who have used DreamWeavers before. Treat them as friendly advice from people who learned the hard way."));

  out.push(h2("19.1 Photography"));
  out.push(callout("best", "Invest in a Pro Photographer", "Your wedding photos will outlast the cake, the flowers, and most of the memories. If your budget allows, hire a professional photographer — the difference in quality is enormous. The photos they take will look beautiful on your Moments gallery for years."));

  out.push(h2("19.2 Content"));
  out.push(callout("best", "Write from the Heart", "Your story, your RSVP messages, your Q&A answers — these are chances for your personality to shine through. Write the way you talk. Do not copy generic templates; guests can tell. A few sincere, personal sentences are worth more than a polished essay that sounds like everyone else."));

  out.push(h2("19.3 Guest List Management"));
  out.push(callout("best", "Build the List Early", "Start your guest list as soon as you set the date. Even a rough first draft lets you start thinking about venue capacity, catering numbers, and invitation timing. Use the CSV import (section 9) once you have the list in a spreadsheet."));

  out.push(h2("19.4 RSVP Management"));
  out.push(callout("best", "Set a Realistic Deadline", "Set your RSVP deadline 2–3 weeks before the wedding. This gives you time to chase non-responders (use the Non-Responders list on the Analytics page) and give your caterer a final headcount 5–7 days before."));

  out.push(h2("19.5 Mobile Experience"));
  out.push(callout("best", "Test on Your Phone", "Most of your guests will view your website on their phone. After every publish, open your site on your phone and click through every page. Fix anything that is hard to read or tap."));

  out.push(h2("19.6 Backups"));
  out.push(callout("best", "Export Your Data", "Once a week during the planning period, export your guest list and RSVPs as CSV files. Keep them somewhere safe (cloud storage, email to yourself). If anything ever goes wrong with the platform, you have a local copy."));

  out.push(h2("19.7 Communication"));
  out.push(callout("best", "Be Reachable", "Make sure your contact email on the Q&A page is one you check daily. Guests will have questions, and a quick response makes them feel cared for. If you will be unavailable for a few days, ask your consultant to monitor for you."));

  // ── 20. FAQ ──────────────────────────────────────────────────────────────
  out.push(h1("20. FAQ"));

  out.push(faqQuestion("Q: Can I edit my website after the wedding?"));
  out.push(p("A: Yes. Your website stays live for as long as your account is active. Many couples add wedding photos to the Moments gallery and update their story with a \"married!\" update in the weeks after the wedding."));

  out.push(faqQuestion("Q: How do I change the colours and fonts of my website?"));
  out.push(p("A: Open the Design page from the sidebar. You will see a set of pre-made theme templates you can apply with one click. Pick one, click Apply, and your whole website updates to the new colours and fonts. You can change themes any time."));

  out.push(faqQuestion("Q: A guest says they cannot RSVP. What should I check?"));
  out.push(p("A: First, check the Guests page to make sure the guest is on your list. Their name on the list must match what they are typing on the RSVP form (case-insensitive, but spelling matters). If they are using a nickname, ask them to use their full name as it appears on your guest list. If they still cannot RSVP, you can manually update their RSVP status from the Guests page."));

  out.push(faqQuestion("Q: I made a typo on my website. How do I fix it?"));
  out.push(p("A: Open the relevant CMS page (Home, Story, Q&A, etc.), fix the typo, click Save, then click Publish. The fix goes live immediately."));

  out.push(faqQuestion("Q: Can I add more than one photo to the Moments gallery?"));
  out.push(p("A: Yes — add as many as you like. The gallery supports any number of photos. We recommend 10–30 for the best experience; more than that and guests may not scroll through them all."));

  out.push(faqQuestion("Q: How do I remove a wish someone posted?"));
  out.push(p("A: Open the Wishes page, find the wish in the list, and click the Delete (trash) icon next to it. Confirm when prompted. The wish is removed permanently."));

  out.push(faqQuestion("Q: Can I change the order of items on my schedule?"));
  out.push(p("A: Schedule items are sorted automatically by start time. If you want a different order, change the start times so they reflect the order you want."));

  out.push(faqQuestion("Q: My consultant said I have access to a feature, but I do not see it. Why?"));
  out.push(p("A: The features you can see depend on your package and any per-wedding overrides. Contact your consultant — they can confirm which features are enabled for you and add more if needed."));

  out.push(faqQuestion("Q: How long does my website stay live?"));
  out.push(p("A: Your website stays live as long as your account is active. Account expiry depends on your package — check with your consultant. You will receive an email reminder before your access expires, with options to renew."));

  out.push(faqQuestion("Q: Can I let someone else (a parent, bridesmaid) edit the website?"));
  out.push(p("A: Yes. Your consultant can add additional team members to your wedding. Each team member gets their own login and can edit (or view, depending on their role). Contact your consultant to set this up."));

  // ── 21. Troubleshooting ──────────────────────────────────────────────────
  out.push(h1("21. Troubleshooting"));

  out.push(h2("21.1 I Cannot Log In"));
  out.push(p("Possible causes:"));
  out.push(bullet("Wrong email — check the email you used to sign up. It may be different from your current main email."));
  out.push(bullet("Wrong password — click \"Forgot password?\" to reset."));
  out.push(bullet("Account not yet active — if you just signed up, your consultant may not have activated your account yet. Contact them."));
  out.push(bullet("Wrong URL — make sure you are on the Couple CMS login page, not the Admin CMS page."));

  out.push(h2("21.2 My Changes Did Not Save"));
  out.push(p("If you clicked Save but your changes are not there when you come back:"));
  out.push(bullet("Check for an error toast in the bottom corner — it may explain what went wrong."));
  out.push(bullet("Check your internet connection. The save may have failed silently."));
  out.push(bullet("Refresh the page and try again."));
  out.push(bullet("Try a different browser. Chrome, Edge, Firefox, and Safari are all supported."));

  out.push(h2("21.3 My Photo Will Not Upload"));
  out.push(p("If a photo upload fails or hangs:"));
  out.push(bullet("Check the file size. Photos larger than 10MB may fail to upload. Resize them first."));
  out.push(bullet("Check the file format. JPG, PNG, and WebP are supported. HEIC (from iPhones) may need to be converted."));
  out.push(bullet("Try a different photo to see if the issue is with the file or the upload system."));
  out.push(bullet("Refresh the page and try again. If the issue persists, contact your consultant."));

  out.push(h2("21.4 My Website Looks Different on My Phone"));
  out.push(p("Mobile browsers sometimes cache old versions of your website. To see the latest version:"));
  out.push(bullet("Pull down to refresh the page."));
  out.push(bullet("Close and reopen the browser tab."));
  out.push(bullet("Clear your browser cache."));
  out.push(bullet("Open your website in a private/incognito window."));

  out.push(h2("21.5 A Guest Says They Cannot Find Their Invitation"));
  out.push(p("Walk the guest through:"));
  out.push(bullet("Confirm they are using the correct website URL (the one on your Sharing page)."));
  out.push(bullet("Have them type their full name exactly as it appears on your guest list. Spelling matters; case does not."));
  out.push(bullet("If they are still stuck, you can manually update their RSVP status from the Guests page."));

  out.push(h2("21.6 The Countdown Timer Is Wrong"));
  out.push(p("If the countdown shows the wrong number of days:"));
  out.push(bullet("Open the Wedding Details page and check the wedding date."));
  out.push(bullet("Open the Home page and check the Countdown Target Date field. It should match your wedding date and start time, including the timezone."));
  out.push(bullet("If you change the date, click Save and Publish."));

  out.push(h2("21.7 The Map on the Getting There Page Is Blank"));
  out.push(p("The map is powered by the Google Maps URL on your Wedding Details page. If it is blank:"));
  out.push(bullet("Open Wedding Details and verify the Google Maps URL field is filled in."));
  out.push(bullet("Verify the URL is a valid Google Maps share link (see section 4.4 for how to get one)."));
  out.push(bullet("Save and Publish."));

  out.push(h2("21.8 I Want to Start Over"));
  out.push(p("If you want to reset your website content back to the original template, contact your consultant. They can re-apply the default template to your wedding. Note that this overwrites any custom content you have added — export your guest list and any custom text first so you do not lose them."));

  out.push(callout("tip", "When in Doubt, Ask", "Your DreamWeavers consultant is there to help. If something is not working and you cannot figure it out in 5 minutes, send them an email. They would much rather help you than have you struggle for hours."));

  return out;
}

// =============================================================================
// 8. ASSEMBLY — Document construction
// =============================================================================

const pgSize = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };
const coverMargin = { top: 0, bottom: 0, left: 0, right: 0 };

// Footer with current page number (Arabic, for body)
function bodyFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 },
      children: [
        new TextRun({
          children: [PageNumber.CURRENT],
          size: SIZE.footer, color: P.secondary, font: FONT,
        }),
      ],
    })],
  });
}

// Footer with current page number (Roman, for TOC)
function tocFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 },
      children: [
        new TextRun({
          children: [PageNumber.CURRENT],
          size: SIZE.footer, color: P.secondary, font: FONT,
        }),
      ],
    })],
  });
}

// Header for body sections (small document title)
function bodyHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { line: 240, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.accent, space: 4 } },
      children: [
        new TextRun({
          text: "DreamWeavers Digital Invite Platform — User Manual v1.0",
          size: SIZE.footer, color: P.secondary, font: FONT, italics: true,
        }),
      ],
    })],
  });
}

// Build all numbering configs (one per numbered list used)
function buildNumberingConfigs() {
  const configs = [];
  for (let i = 1; i <= _listCounter; i++) {
    configs.push({
      reference: `manual-list-${i}`,
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    });
  }
  return configs;
}

// =============================================================================
// 9. MAIN — Build the document
// =============================================================================

function main() {
  // Reset counter so buildNumberingConfigs captures all lists created below
  _listCounter = 0;

  // Build content (this populates _listCounter via newListRef calls)
  const coverChildren = buildCover();
  const tocChildren = buildTOCSection();
  const part1Children = buildPart1();
  const part2Children = buildPart2();

  // Now collect numbering configs
  const numberingConfig = buildNumberingConfigs();

  const doc = new Document({
    creator: "DreamWeavers Team",
    title: "DreamWeavers Digital Invite Platform — User Manual",
    description: "Complete user manual for Admin CMS and Couple CMS",
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: "Calibri", eastAsia: "Calibri" },
            size: SIZE.body,
            color: P.body,
          },
          paragraph: { spacing: { line: 312 } },
        },
        heading1: {
          run: { font: { ascii: "Calibri", eastAsia: "Calibri" }, size: SIZE.h1, bold: true, color: P.primary },
          paragraph: { spacing: { before: 480, after: 200, line: 312 } },
        },
        heading2: {
          run: { font: { ascii: "Calibri", eastAsia: "Calibri" }, size: SIZE.h2, bold: true, color: P.primary },
          paragraph: { spacing: { before: 320, after: 140, line: 312 } },
        },
        heading3: {
          run: { font: { ascii: "Calibri", eastAsia: "Calibri" }, size: SIZE.h3, bold: true, color: P.primary },
          paragraph: { spacing: { before: 240, after: 100, line: 312 } },
        },
      },
    },
    numbering: { config: numberingConfig },
    sections: [
      // ── Section 1: Cover (no page numbers, no footer) ────────────────────
      {
        properties: {
          page: { size: pgSize, margin: coverMargin },
        },
        children: coverChildren,
      },
      // ── Section 2: TOC (Roman numerals) ──────────────────────────────────
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: pgSize,
            margin: pgMargin,
            pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
          },
        },
        footers: { default: tocFooter() },
        children: tocChildren,
      },
      // ── Section 3: Body (Arabic, reset to 1) ─────────────────────────────
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: pgSize,
            margin: pgMargin,
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        headers: { default: bodyHeader() },
        footers: { default: bodyFooter() },
        children: [...part1Children, ...part2Children],
      },
    ],
  });

  return Packer.toBuffer(doc).then((buf) => {
    const outPath = path.join(__dirname, "..", "DWdigitalInvite-User-Manual.docx");
    fs.writeFileSync(outPath, buf);
    console.log(`Manual generated: ${outPath}`);
    console.log(`  Size: ${(buf.length / 1024).toFixed(1)} KB`);
    console.log(`  Numbered lists: ${_listCounter}`);
    console.log(`  Screenshots: ${_figCounter}`);
  });
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
