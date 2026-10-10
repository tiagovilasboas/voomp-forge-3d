/** Forge mark: an orange tile with a flame over an anvil. */
export function ForgeMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#FF6A00" />
      <path d="M16 5c1 4 5 6 5 10.5a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.4 1 2 2 2.2C14.6 11 15 8 16 5z" fill="#090B10" />
      <path d="M8 24h16l-2 3H10z" fill="#090B10" />
    </svg>
  );
}

export function ForgeLogo() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ForgeMark />
      <div className="hidden leading-tight xl:block">
        <div className="font-display text-[15px] font-bold tracking-tight text-snow">Voomp Forge</div>
        <div className="hidden text-[11px] text-fog 2xl:block">From Code to Delivery</div>
      </div>
    </div>
  );
}
