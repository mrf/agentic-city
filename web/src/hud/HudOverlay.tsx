import { useUiStore } from '../store/uiStore';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { RightRail } from './RightRail';
import { BottomStrip } from './BottomStrip';
import { ShortcutOverlay } from './ShortcutOverlay';
import { Minimap } from './Minimap';
import { DispatchWizard } from '../orchestration/DispatchWizard';
import { CommandPalette } from '../orchestration/CommandPalette';
import { AlarmOverlay } from '../orchestration/AlarmOverlay';

export function HudOverlay(): JSX.Element {
  const highContrast = useUiStore((s) => s.highContrast);
  const alarmActive = useUiStore((s) => s.alarmActive);

  return (
    <>
      <div
        style={
          highContrast
            ? { filter: 'brightness(1.5) contrast(1.2)', isolation: 'isolate' }
            : undefined
        }
      >
        {/* Alarm overlay replaces normal top bar / rails when active */}
        {!alarmActive && <TopBar />}
        {!alarmActive && <LeftRail />}
        {!alarmActive && <RightRail />}
        <BottomStrip />
      </div>
      <ShortcutOverlay />
      <Minimap />
      <AlarmOverlay />
      <DispatchWizard />
      <CommandPalette />
    </>
  );
}
