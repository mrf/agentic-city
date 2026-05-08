import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { RightRail } from './RightRail';
import { BottomStrip } from './BottomStrip';

/**
 * HudOverlay renders all four HUD panels as fixed-position HTML elements
 * layered over the isometric canvas. pointer-events: none on the container
 * ensures canvas interactions pass through; individual panels opt back in
 * only where needed.
 */
export function HudOverlay(): JSX.Element {
  return (
    <>
      <TopBar />
      <LeftRail />
      <RightRail />
      <BottomStrip />
    </>
  );
}
