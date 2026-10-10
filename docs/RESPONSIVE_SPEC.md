# Responsive & PWA specification

Voomp Forge is **mobile-first**: every capability reachable on desktop must be
reachable on a phone, with layouts adapted — not hidden.

**Status (v0.1.0):** implemented. The three layouts are `PhoneHud`, `TabletHud` and `DesktopHud`, chosen by `useBreakpoint()`. Icons are in `public/icons/`. Where this spec and the code differ, the code is the reference; update this file when that happens.

## Breakpoints (Tailwind)

| Range | Name | Layout |
|---|---|---|
| < 768px (`base`) | Phone | 3D full-bleed + compact top bar + KPI carousel + **bottom navigation** + **bottom sheets** |
| 768–1279px (`md`, `lg`) | Tablet | Top bar + KPI strip + **left drawer** (300px, toggle; open by default in landscape from 1024px) + inspector side panel (320px) + delivery tracking card |
| ≥ 1280px (`xl`) | Desktop | Current WareTrack-style arrangement (`HudLayout.tsx` diagram) |

Use the viewport's safe areas: `env(safe-area-inset-*)` on the top bar, bottom
navigation and sheets (the page sets `viewport-fit=cover`).

## Phone

- **Top bar (56px):** logo mark (no wordmark < 380px), squad selector (code chip only), DEMO DATA chip, search icon (opens a full-screen search sheet), overflow menu (period, view mode, alerts, settings, table view). Nothing may overflow horizontally at 360px.
- **KPI carousel:** horizontal scroll-snap row of the 5 KPI cards (w-[150px]), below the top bar.
- **Bottom navigation (64px + safe area), 5 items with icon + label:** `Mapa` (closes sheets), `Perguntas` (Product View questions / Engineering health), `Entregas` (activity tabs + delivery tracking), `Iniciativas`, `Mais` (view mode, period, legend, table view, explorer, tour, settings). Active item in orange. `aria-current` on the active item.
- **Bottom sheet:** one reusable `BottomSheet` in `hud/kit` with snap points `peek` (35vh) / `full` (90vh), drag handle (pointer events), Esc + close button, focus management, `role="dialog"`, and backdrop only at `full`. Sheets host the existing panel components (reuse, don't fork them).
- **Inspector:** when something is selected, it opens in the BottomSheet at `peek`; dragging up → `full`. The 3D selection stays visible above the sheet.
- **Overlays** (Explorer, Table, Welcome): full-screen on phones, filters collapse into a "Filtros" disclosure.
- Touch targets ≥ 44px. No hover-only affordances (hover tooltip is desktop only).

## Tablet

- Left column inside a drawer (`w-[300px]`) toggled by a button in the top bar; closed by default in portrait, open in landscape ≥ 1024px.
- Inspector as right side panel (`w-[320px]`).
- Activity tabs available from a top-bar button (popover/sheet) instead of the fixed bottom-right card.

## PWA

- `vite-plugin-pwa` (generateSW): precache the app shell and assets; Google Fonts with `StaleWhileRevalidate` runtime caching; `registerType: 'autoUpdate'`.
- Manifest: name "Voomp Forge", short_name "Forge", description "From Code to Delivery", `display: standalone`, `orientation: any`, `background_color` / `theme_color` `#090B10`, `lang: pt-BR`, start_url `./`, scope `./`.
- Icons generated from an SVG forge mark (orange on black): 192, 512, 512 maskable, apple-touch-icon 180. Generate PNGs with a small script (e.g. `sharp` or the Playwright Chromium already on the machine) and commit the PNGs under `public/icons/`.
- Demo Mode is bundled, so the app works fully offline after the first visit.
- `index.html`: `viewport-fit=cover`, `apple-mobile-web-app-capable`, status bar style `black-translucent`, apple-touch-icon. The manifest link is added at build time by `vite-plugin-pwa`.

## Out of scope for this spec

- Camera framing in portrait and touch gestures live in `presentation/scene/stage/CameraRig.tsx`. This spec covers only the HUD and the PWA.
