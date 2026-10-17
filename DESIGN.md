---
titre: "DESIGN - Be Stable, Le Livret"
created: 2026-09-30
modified: 2026-10-18
tags: [sujet/mon-ecurie]
name: "Be Stable, Le Livret"
description: "Every stable gets its livret: numbered fields, true prices, an earned flot."
colors:
  vert: "#134E3A"
  vert-deep: "#0B3325"
  rose: "#F6B3CB"
  rose-soft: "#FCE3EC"
  ink: "#1B1225"
  ink-2: "#5A5264"
  paper: "#FCFBF9"
  mist: "#F1EEF3"
  line: "#DCD6E0"
  surface: "#FFFFFF"
  on-vert-muted: "#BFD6CB"
  vert-2: "#1A5E47"
  ink-3: "#7A7284"
  line-2: "#EAE6ED"
  on-vert-2: "#8FB3A3"
  app-sheet: "#FFFFFF"
  app-mist: "#F4F1F5"
  app-line: "#E7E2EA"
  app-line-2: "#F0ECF2"
  app-ink-3: "#6E6678"
  app-cream: "#FDF5E6"
  app-hay: "#E9C46A"
  money-in: "#134E3A"
  money-out: "#A0285A"
  print-black: "#000000"
  print-ink: "#111111"
  print-grey: "#444444"
  print-rule: "#999999"
  print-line: "#C9C9C9"
typography:
  wordmark:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "192px"
    fontWeight: 800
    lineHeight: 0.85
    letterSpacing: "-0.004em"
    fontVariation: "\"wdth\" 88"
  display:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "132px"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.035em"
    fontVariation: "\"wdth\" 90"
  headline:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.035em"
    fontVariation: "\"wdth\" 90"
  title:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.035em"
    fontVariation: "\"wdth\" 90"
  lead:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.55
  meta:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.06em"
  figure:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1"
  app-figure:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 88"
    fontFeature: "\"tnum\" 1"
  app-small:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
  app-meta:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  app-body:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  app-row:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "14.5px"
    fontWeight: 640
    lineHeight: 1.2
  app-lead:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  app-field:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  app-section:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    letterSpacing: "-0.015em"
  app-hello:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "32px"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.03em"
    fontVariation: "\"wdth\" 86"
  app-big:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "44px"
    fontWeight: 780
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: "\"wdth\" 86"
    fontFeature: "\"tnum\" 1"
rounded:
  print: "4px"
  ui: "6px"
  field: "10px"
  frame: "14px"
  pill: "40px"
  sheet: "16px"
  app-card: "16px"
  app-control: "10px"
spacing:
  gap: "10px"
  block: "26px"
  cell: "28px"
  gutter: "72px"
  page: "88px"
  section: "88px"
components:
  button-primary:
    backgroundColor: "{colors.vert}"
    textColor: "{colors.surface}"
    rounded: "{rounded.ui}"
    padding: "0 24px"
    height: "52px"
  button-rose:
    backgroundColor: "{colors.rose}"
    textColor: "{colors.vert-deep}"
    rounded: "{rounded.ui}"
    padding: "0 24px"
    height: "52px"
  button-outline:
    textColor: "{colors.ink}"
    rounded: "{rounded.ui}"
    padding: "0 24px"
    height: "52px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "38px"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "38px"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 10px 0 22px"
    height: "76px"
  field-label:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
  price-card-vert:
    backgroundColor: "{colors.vert}"
    textColor: "{colors.surface}"
    rounded: "{rounded.ui}"
    padding: "18px 22px"
  box-gain:
    backgroundColor: "{colors.vert}"
    textColor: "{colors.surface}"
    padding: "9px 10px 8px"
    height: "84px"
  box-even:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    padding: "9px 10px 8px"
    height: "84px"
  box-loss:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    padding: "9px 10px 8px"
    height: "84px"
  box-free:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    padding: "9px 10px 8px"
    height: "84px"
  month-banner:
    backgroundColor: "{colors.vert}"
    textColor: "{colors.surface}"
    typography: "{typography.app-figure}"
    padding: "14px 18px 16px"
  stamp-done:
    backgroundColor: "{colors.rose}"
    textColor: "{colors.vert-deep}"
    rounded: "{rounded.print}"
    padding: "6px 10px 6px 8px"
  tab-note:
    backgroundColor: "{colors.vert}"
    textColor: "{colors.surface}"
    rounded: "50%"
    size: "58px"
  sim-result:
    backgroundColor: "{colors.vert}"
    textColor: "{colors.surface}"
    rounded: "{rounded.ui}"
    padding: "18px 16px"
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "10px 18px 22px"
  app-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.ui}"
    padding: "0 16px"
    height: "44px"
  app-button-delete:
    textColor: "{colors.ink}"
    rounded: "{rounded.ui}"
    padding: "0 16px"
    height: "44px"
  app-tab-plus:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "50%"
    size: "56px"
  app-money-in:
    textColor: "{colors.money-in}"
  app-money-out:
    textColor: "{colors.money-out}"
---

# Design System: Be Stable, Le Livret

## Overview

**Creative North Star: "Le livret signalétique"**

Every stable gets a livret, like the identity booklet a horse carries: numbered fields, true data, an official stamp once it is complete. The system is a near-white page ruled by hairlines, inked in a green-black, set in a single grotesk with character, where prices are the loudest information and two colours (Vert, Rose casaque) make all the noise. Precision in the layout, humour in the words.

Density is editorial and calm: generous page margins (88px), large square photographs, a field grid of 1px hairlines that carries structure instead of cards and shadows. Vert owns whole regions (a poster, a price card, a brand tile, the primary button); Rose casaque is a highlighter band under one key word and the fill of the flot stamp. The flot de concours is a precise geometric stamp earned by a listing, never a costume.

The world refuses the directory default: grey cards, star ratings, a map as the hero. The price comes first, and it is set like a record, in tabular digits.

**Key Characteristics:**
- Near-white paper, green-black ink, 1px lilac-grey hairlines.
- Two loud colours only, used as regions and highlights, never as scattered accents.
- One family (Bricolage Grotesque) from 11px labels to 192px wordmark, driven by the width axis.
- Numbered field labels structure every livret.
- The flot: an 18-scallop rosette stamp that a listing earns field by field.
- Square-cornered photography; 6px radius on UI only.

## Colors

A restrained lilac-tinted neutral base with two saturated voices, a deep English racing green and a racing-silk pink.

### Primary
- **Vert anglais** (vert): whole regions (brand tiles, posters, price cards, Instagram post grounds), the primary button, the flot's scalloped disc. As text on paper it marks at most one action or signal per block (the "J'ai une écurie" nav link, the "1 place" availability).
- **Vert profond** (vert-deep): text on Rose grounds, text of the Rose button, the lettering and dashed ring inside the flot.
- **Vert survol** (vert-2): the hover ground of the primary button. Introduced by the internal tools; a state colour, never a region.

### Secondary
- **Rose casaque** (rose): the highlighter band under one key word, the flot centre, the Rose button, and display text or price figures set on vert.
- **Rose doux** (rose-soft): declared in livret.css as the soft tint of Rose; not yet placed on either board. Reserve it for pale good-news surfaces.

### Neutral
- **Encre** (ink): all primary text, the active chip, the outline button stroke.
- **Encre seconde** (ink-2): meta text, field labels, secondary prices (a "complet" formula).
- **Papier** (paper): the page ground.
- **Brume** (mist): quiet fills (the "+ 6 photos" tile, colour specimens).
- **Ligne** (line): every hairline: field grid, row rules, search dividers, chip outlines.
- **Surface** (surface): white raised surfaces sitting on paper (search bar, chips, the livret frame) and text on vert.
- **Sauge sur vert** (on-vert-muted): secondary text on vert grounds (captions, poster footers). Used as a literal in the boards, not yet a custom property.
- **Encre tierce** (ink-3): tertiary ink for line icons, placeholders, timeline dots and the hover ring of outline controls.
- **Ligne douce** (line-2): the quiet inner hairline inside product surfaces (table rows, column heads, toolbars, list items), where Ligne would be too heavy; Ligne keeps the outer edges.
- **Sauge tierce sur vert** (on-vert-2): tertiary text on vert-deep (sidebar group titles, counts, footers, shortcut keys).

### Named Rules
**The Two Loud Colours Rule.** On a typical page the proportions are paper 66 %, ink 16 %, vert 12 %, rose 6 %. Vert and Rose occupy whole zones or a single highlighted word; everything else stays quiet.

**The Rose Legibility Rule.** Rose is never text on paper or white. It is text only on vert (figures, display lines), and a ground only under vert or vert-deep text.

**The Brand Colour Rule (app, 18 October 2026).** The app speaks mon-ecurie.fr's colours. Vert anglais (`--acc`, #134E3A) carries the controls: primary buttons, the tab bar +, the active tab, checked boxes and chips, selected segments, progress fills, the help card; its deep shade (#0B3325) carries hover, toasts and tooltips. Rose casaque is a flat ground only (count badges, the sidebar's open screen, the remaining part of the goal bar) with vert-deep text, never text on white. Money keeps its sign: money in reads in vert anglais (+), money out in a readable dark rose drawn from the casaque (#A0285A, −). Delete stays an ink outline; data marks (charts), carets and the now line stay ink. Activity types are told apart by a pictogram.

## Typography

**Display Font:** Bricolage Grotesque (with sans-serif)
**Body Font:** Bricolage Grotesque (with sans-serif)

**Character:** One grotesk with a slightly wonky, warm character, tightened for display and opened for text. The width axis does the hierarchy work: condensed for the wordmark, a touch narrower for headlines, normal for text.

### Hierarchy
- **Wordmark** (800, 22px to 192px, line-height 0.85, letter-spacing -0.004em, width 88, never wraps): the lowercase "be stable" logotype and the biggest price figures (330 € at 132px to 176px).
- **Display** (700, 132px, line-height 0.9, -0.035em, width 90): the campaign's lead punchline. The same style runs at 64px for a board hero line and 44px to 52px for punchlines and poster lines.
- **Headline** (700, 40px): section heads; 52px for a stable's name at the top of its livret.
- **Title** (700, 24px): prices in a formula list, card titles (20px to 26px).
- **Lead** (400, 21px, 1.5): the one introductory paragraph, max about 640px.
- **Body** (400, 18px, 1.55): livret text and formula rows, max about 560px.
- **Meta** (400, 13px, ink-2): captions, distances, availability, footnotes (12px for credits).
- **Label** (600, 12px, +0.06em, uppercase, ink-2): numbered field labels only.
- **Figure** (700, 20px, -0.02em, tabular): values in a data strip, over an 11px 600 caption at 75 % opacity.

### Named Rules
**The One Family Rule.** Bricolage Grotesque is the only typeface, including inside the flot. Hierarchy comes from weight, size and the width axis (88 wordmark, 90 display, default text).

**The Tabular Price Rule.** Every price, count and figure uses tabular digits, with a thin space before the unit ("330 €", "/ mois" in 500 weight at roughly a third of the figure's size).

**The One Highlight Rule.** A headline carries at most one Rose highlight, a flat band from 58 % to 92 % of the line box under a single key word, padded 0.06em. The punchline without its highlight must still read.

## Layout

The boards are fixed-width compositions (1600px) with 88px page margins; responsive behaviour is not yet built. Sections are separated by 88px to 96px, headings sit 26px above their content, and two-column splits use a 72px gutter.

Structure is a field grid: cells share 1px hairlines (the grid draws top and left, each cell draws right and bottom), cells pad 28px, and each cell opens with its label. Inside a livret, sections are stacked rows separated by hairlines at 18px vertical padding, and formulas align on a three-column grid (description, availability, right-aligned price). Data strips set three to four figures side by side under a single currentColor rule.

The app is mobile-first: one column of at most 480px, 18px side padding, sections ruled by line hairlines, an opaque white sticky header and a fixed white tab bar (no blur, see the iPhone sheet rule). From 1024px a 232px white sidebar replaces both, the content runs up to 1120px, and sheets open as a 440px panel on the right. No vert band in the app: the interface stays paper and ink.

**The Hairline Grid Rule.** Group content with shared 1px Ligne rules, not with separate boxed cards.

## Elevation & Depth

The world is flat and ruled. Depth appears only on surfaces that float above the page: the search bar, the framed livret page, and printed or posted artefacts shown as objects. Shadows are soft, vert-tinted and ambient, always paired with a 1px inset Ligne edge. Outline buttons and chips draw their stroke as an inset ring, not as elevation.

### Shadow Vocabulary
- **Search float** (`box-shadow: 0 1px 2px rgba(27,18,37,.06), 0 8px 24px rgba(27,18,37,.07), inset 0 0 0 1px #DCD6E0`): the search bar.
- **Frame** (`box-shadow: 0 2px 4px rgba(27,18,37,.05), 0 24px 60px rgba(27,18,37,.10), inset 0 0 0 1px #DCD6E0`): a whole page or livret shown in situ.
- **Print** (`box-shadow: 0 2px 4px rgba(27,18,37,.06), 0 18px 44px rgba(27,18,37,.12)`): posters and social posts presented as objects.

In the app, three pieces of chrome float like the search bar: the central + button (ink, `0 8px 18px` ink at 25 %), bottom sheets (`0 -10px 30px` ink at 18 % over a 35 % ink scrim) and the ink toast (`0 10px 26px` ink at 25 %). Panels and rows stay flat.

### Named Rules
**The Flat Page Rule.** Content on the page is never lifted; only the search bar and presented artefacts float, and their shadows stay soft and ink-tinted.

## Shapes

Photographs are cropped square-cornered and large; they take a radius only when clipped by a rounded container. UI carries a small, firm 6px radius (buttons, price cards, social inner cards); the search field takes 10px, the framed livret page 14px, printed artefacts 4px. Chips are full pills (40px). Circles are reserved for field numbers, avatars (initials on Rose) and the flot. App icon tiles follow platform rounding (28px on 120px, 10px on 48px).

In the app, cards and buttons take 6px to 8px, bottom sheets 18px top corners (square once docked on desktop), chips and pills are full pills; bars and seuil cells take 2px to 3px.

**The Square Photo Rule.** A photo never gets its own radius or a decorative frame.

## Components

### Buttons
Firm, compact and wordy: a button says the action in full ("Demander une place").
- **Shape:** gently squared corners (6px), 52px tall (56px inside the search bar), 24px horizontal padding, 600 weight 17px, -0.01em, 10px gap to an optional 20px line arrow.
- **Primary:** Vert ground, white text. One per view, for the request action.
- **Rose:** Rose ground, vert-deep text, for a returning or secondary positive action.
- **Outline:** transparent, ink text, 1.5px inset ink ring, for navigation-like actions ("Voir la carte").
- **Hover / Focus:** not yet built on the boards.

### Chips
- **Style:** 38px pills, 16px padding, 500 weight 15px, white ground with a 1px inset Ligne ring.
- **State:** selected chip turns solid ink with white text and no ring. Filters for formula and amenities.

### Inputs / Fields
- **Style:** the search bar is one 76px white field (10px radius, Search float shadow) split by 1px Ligne dividers into segments, each with a 12px 600 ink-2 question ("Où ?", "Formule", "Budget") over a 17px 500 value, a 28px line pin icon leading, and the primary button docked at the end.
- **Focus / Error:** not yet built.

### Navigation
- **Style:** a 72px white bar with the wordmark at 28px left and 15px 500 links right, separated from content by a hairline; the gérant entry ("J'ai une écurie") is the only vert link.

### Field label (signature)
The livret's native device. A 20px circle outlined in currentColor holding the field number (700, 11px), followed by the uppercase 12px label. It opens each data section of a listing (1 Formules et prix, 2 Installations, 3 La gérante). It labels data, never a marketing headline.

### Price card
A vert block (6px radius, 18px 22px padding) with the price in Rose at display weight and tabular digits, the unit in white 500, and a 15px sourced caption. Overlaps a photo edge by about 28px when used in a hero.

### Data strip
Three or four figures in a row under one currentColor rule, 11px captions over 20px tabular figures; used on posters and social posts to put a verifiable fact beside a punchline.

### Le flot (signature)
The rosette stamp, generated as SVG: a Vert disc (r 42) ringed by 18 scalloped circles (r 9.5 at radius 41), an Rose centre (r 35), a dotted vert-deep inner ring (0.8 stroke, 1.6 / 2.4 dash), one or two lines of Bricolage 700 lettering (12.5px for two lines), and two tails, the second at 82 % opacity. On vert grounds the colours invert (Rose disc, Vert centre, Rose lettering). Without tails it becomes the app icon and avatar mark. It names an earned status: Places libres, Prix affichés, Gérant vérifié, Livret complet, or the brand signature. Shown upright in specimens; stamped onto layouts it tilts between -8 and 8 degrees, typically 84px to 150px wide.

### Installation pictograms
28px (22px inline) line icons on a 28 grid, 1.6 stroke in ink, round caps and joins, paired with a 15px label: Box, Paddock, Pré, Manège, Carrière, plus the pin and arrow.

### Livret du gérant
Added with the logged-in gérant space (7 octobre 2026). One flat white card per stable (6px radius, 1px inset Ligne edge, 22px 20px padding, 28px from 700px), above Directorist's own dashboard; from 1100px it sits sticky in a 440px left column beside it.
- **Head:** the stable's name stays fixed at title size (24px to 32px, balanced) on the left, the flot at right (84px, 108px from 700px, tilted -6 degrees).
- **Count line:** "n sur 3" on its own line, 30px 800 width 88 tabular ink, followed by a 17px sentence naming what remains, "flot" carrying the Rose band; once earned the count gives way to a reminder to confirm places each month.
- **Conditions:** exactly three numbered rows between 1px Ligne rules. Each row leads with a 24px circle (1.5px inset ink ring, 12px 700 tabular number); a met condition turns it into a solid ink disc with a white check. The condition name reads as a phrase (16px 600 ink), its state below (15px 400 ink-2), then an ink underlined action link (14.5px 600, 40px tap height; 500 ink-2 once met). From 700px to 1099px the link moves to the end of the row.
- **Action:** one Vert primary button, full width on mobile, leading to Places et tarifs. Vert is reserved for that single action; links, count and checks stay ink.

### Flot à gagner
The flot shown before it is earned, as an imprint: mist disc and tails (second tail one step darker), white centre, dotted ring in line-2, ink-3 lettering, same geometry. Once all three conditions are met it takes the earned colours of Le flot. The stamp animation (from -14 degrees and 125 % to rest, 0.5s ease-out) plays only the first time it is earned for that gérant and never under reduced motion.

### Sommaire de fiche
A sticky row of 38px pills (15px 500, 16px padding, white with a 1px inset Ligne ring) under the header on the edit form, opaque paper ground and a hairline below, scrolling sideways on mobile. The part in view is filled ink with white text. "Places et tarifs" keeps a 1.5px Vert ring with Vert 600 text, and fills Vert with white text when it is the current part. It replaces Directorist's own side summary.

### Champ places libres
The one figure a gérant comes to change. A rose-soft band bleeding to the card edges, a 16px 600 label and vert-deep help text, over a white input 64px tall and at most 160px wide with a Vert 1px border, its figure 34px 800 width 88 tabular in Vert.

### Product UI (internal tools)
Added with the internal Operate tool "Base mon écurie" (visualiseur-base). Same family, colours and radii as the livret, at product density.
- **Type ramp:** denser than the boards. Text runs 11px to 26px on a 14px body (line-height 1.45): 11px group titles and badges, 12px to 13px meta and pills, 22px 700 width-90 page titles, 26px 700 width-90 record names and column figures. Tabular figures may reach 30px (summary strip) and 40px (price card) as records, not as text.
- **Sidebar:** a 252px vert-deep region carrying the 22px wordmark, a translucent white search trigger (7 % white, 12 % on hover) and 32px items on on-vert text. Hover lifts to 7 % white; the active item is a Rose ground with vert-deep 600 text. Count badges are Rose pills that invert to vert-deep on the active item.
- **Stage pills:** 22px pills (12px 600, 9px padding) led by a 6px currentColor dot, ordered by progress: mist with ink-2 (to contact), transparent with a Ligne inset ring (no e-mail), white with a Ligne ring (contacted), rose-soft with vert-deep (opened), Rose with vert-deep (in verification), Vert with white (verified).
- **Tableau d'écurie** (outil Enrichissement, 6 octobre 2026): five columns on a hairline grid, each headed by a 15px 600 name, a 40px 700 width-90 tabular total and a 13px ink-2 help line, then flat white stable cards. The column that needs Samuel (À valider) is the only Vert region, its total in Rose. Above it, the bilan: the percentage at 112px 800 width-88 in Vert, a 34px headline carrying the single Rose highlight, and a five-segment progress bar (14px, 2px gaps, segments grow from the left once on load).
- **Livret gauge:** ten 9px squares (14px in the open sheet), one per field a cavalier reads: Vert filled, Rose proposed, ink-3 outline searched and not found, mist not yet searched. Always paired with a tabular "n/10".
- **Confidence pill:** a note out of 100 on a pill, Vert at 90 and above, rose-soft from 75, amber from 50, alert below. Its reasons are always one click away.
- **Paquets de validation** (outil Enrichissement, vue À valider): a grid of 52px tiles, one row per field, one column per confidence band (Très sûres, Sûres, À regarder, Douteuses). Tiles reuse the department heat ramp, from Vert with white figures (90 and above) to mist (below 50). The selected tile takes a 3px Rose ring. Beside the grid, a floating white panel (Search float shadow, 14px radius) shows a random sample of five and the two packet actions; it is the only floating surface of the view.
- **Revue en quatre blocs** (outil Enrichissement, À valider, 10 octobre 2026): sections ruled by a Ligne hairline, each opened by a 26px numbered circle and a 24px title, with an effect pill on the right above a 44px tabular count: mist « Invisible sur le site », Vert « Visible sur les fiches », amber « Remplace une valeur », alert « Retire ou signale ». Rows read as a sentence (verb first, old value struck in ink-3, new value bold), followed by the italic citation and a « source » link. Confidence is said in words, never as a number: Sûr (Vert on #E3ECE7), Probable (mist), À vérifier (amber). Bulk decisions run in batches behind a sticky ink progress bar with a Rose fill.
- **Department heat ramp:** four steps from light to full, #E3ECE7, #C4D8CD, #8FB3A3 (on-vert-2), then Vert. The lightest step carries ink text, the two middle steps vert-deep, the Vert step on-vert text with white figures. Departments without data stay mist. Always shown with a "Moins / Plus" legend.

### App Be Stable (le carnet)
The app as it ships since 15 October 2026 (the carnet illustré, rules of 17 October 2026). One token set, defined once in `:root` (`app/globals.css`) and used by every screen; the clickable prototype of 11 October lives on in `prototype/`.
- **Tokens:** paper `#FCFBF9` (page), sheet `#FFFFFF` (raised surfaces), mist `#F4F1F5` (quiet fills, segmented controls), line `#E7E2EA` and line-2 `#F0ECF2` (hairlines), ink `#1B1225`, ink-2 `#5A5264`, ink-3 `#6E6678` (5.3:1 on paper, 4.9:1 on mist), cream `#FDF5E6` and hay `#E9C46A` (illustration grounds only), money-in `#134E3A` (vert anglais, 9.6:1 on paper), money-out `#A0285A` (6.9:1 on paper), scrim ink at 35 %. Brand tokens `--vert`, `--vert-deep`, `--rose`, `--on-vert` feed `--acc`, `--acc-deep` and `--rose-soft`; radii are `--bloc-r` (16px) and `--ctl-r` (10px), the side gutter `--gut` (16px). Ink transparencies are written `color-mix(in srgb, var(--ink) n%, transparent)`, never as raw rgba.
- **Colour:** The Brand Colour Rule. A figure that has come in reads `+120 €` in money-in, one that has gone out `−85 €` in money-out; what is still planned, an estimate or a potential reads in ink with its sign; zero is ink. Focus is a 2px ink outline (offset 2px); text selection is an ink mist (14 %); the delete button is an ink outline with a trash pictogram, its gravity carried by the words and the confirmation.
- **Type ramp:** 14px body (1.45), 12px minimum anywhere in the app (labels, tab labels, captions, kickers), 13px meta, 14.5px 640 row titles, 15px leads, 16px in every field (so iOS never zooms on focus), 18px 700 section heads, 32px 760 width-86 hellos, 44px 780 width-86 tabular month figure. IBM Plex Mono only on the horse's ticket and its times.
- **Touch targets:** 44 by 44px minimum for anything a gloved thumb can press. When the drawing must stay small (the C'est fait check, a row's trash, back and help in the header, close crosses, week and month arrows, colour swatches, text links), a centred `::after` extends the hit area to 44px around it; segmented controls are 38px inside a 3px mist frame, extended to the frame's edge; chips, steppers, inputs and buttons are 44px tall. A field box is a label: a press anywhere in it puts the caret inside. The tab bar's centre + is a 56px ink disc raised 24px; tab labels are 12px 600.
- **Headings:** one h1 per screen. The app shell reads the screen's name as a visually hidden h1 when the screen has no visible one; account, onboarding and trial screens show their question as the h1. Page titles and sections are h2, their sub-blocks h3. The help card opens on a paragraph, not a heading.
- **Zoom:** pinch-zoom is never blocked (no maximum-scale, no gesture blocking); double-tap zoom is cut by `touch-action: manipulation`.
- **Motion:** screens and lines rise in 0.3s to 0.7s on cubic-bezier(.22,1,.36,1); bars grow with `transform: scaleX`, never `width`. Entrance animations that move a block (`.rise`, the screen fade, the sheets) fill `backwards`, never `both`: once played, the block keeps no transform, so a fixed sheet or a 44px hit area inside it is neither trapped nor clipped. Everything is CSS (the app no longer ships framer-motion). Under reduced motion every loop stops (one iteration, 0.001ms), the steam and the promo ping disappear.
- **Sheets:** every modal sheet (the +, a séance, a lesson, the rond, the forms of a fiche) is portalled to `body` inside `.carnet.carnet-portal` and uses `useFeuille` (`components/bs/feuille.ts`): focus enters on open (the first choice, never a text field, so the phone keyboard does not pop), Tab stays inside, Escape closes the top sheet only, focus returns to the control that opened it.
- **Print colours:** the invoice and the breeding register print black on white, outside the screen palette on purpose: `#000` (register text and rules), `#111` (invoice ink), `#444` (invoice secondary text), `#999` (register inner rules), `#c9c9c9` (invoice hairlines), `#fff` (sheet ground). They live only in `app/carnet/facture.css` and `app/carnet/registre.css`; no screen uses them.
- **Scrollbars:** thin, ink at 26 % on a transparent track, on whatever really scrolls (a long sheet, a row of horses, the week board); only controls drawn as a wheel hide theirs.
- **Agenda (desktop week):** event cards are white with a 1px line ring and a 2px ink top rule (ink-3 once done, a dashed ink outline while waiting); never a coloured side stripe.
- **Service worker:** the cache name changes with every build (`scripts/stamp-sw.mjs`), old caches are deleted on activation, build files are cache-first, images, icons and the manifest are served from cache and refreshed in the background. On install the main screens and the build files they cite are stored ahead. Offline, a screen never opened on the device gets `public/hors-ligne.html` (illustrated, « Réessayer »), never another screen's page under its address.
- **Document title:** each screen names its tab, « Planning · Be Stable ».

## Do's and Don'ts

### Do:
- **Do** keep the page at paper 66 %, ink 16 %, vert 12 %, rose 6 %, with Vert as whole regions.
- **Do** set every price and figure in tabular digits, and show the price before any other listing detail.
- **Do** open each livret data section with a round-numbered field label and separate sections with 1px Ligne rules.
- **Do** highlight at most one key word per headline with the Rose band.
- **Do** keep the wordmark lowercase "be stable", 800, width 88, letter-spacing -0.004em, on one line.
- **Do** award the flot only for a named status, tilted at most 8 degrees.
- **Do** label fictitious stables, prices and portraits in mockups.
- **Do** give app controls the vert anglais and use rose casaque only as a flat ground with vert-deep text; write money with its sign, vert in, dark rose out.
- **Do** use two radii in the app: 16px for every block (cards, cases, panels) and 10px for every control (buttons, fields, segmented choices), on one 16px side gutter.
- **Do** give every touch target 44px, extending the hit area around a small drawing rather than shrinking the target.
- **Do** keep app text at 12px or more, and every field at 16px.

### Don't:
- **Don't** set Rose text on paper or white.
- **Don't** introduce a second typeface or a third loud colour.
- **Don't** build listings as grey cards with star ratings.
- **Don't** round or frame photographs on their own.
- **Don't** lift page content with shadows; only the search bar and presented artefacts float, softly.
- **Don't** use the flot as ornament or change its geometry; it is a stamp, not a costume.
- **Don't** set rose casaque as text on white, colour the delete button, or invent a third hue.
- **Don't** block pinch-zoom, and don't mark a card with a coloured side stripe.
- **Don't** carry the boards' filled index badges or specimen captions onto product surfaces; they annotate the planche.
