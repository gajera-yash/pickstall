import { stepPosition, type SignupStep } from "@/lib/signup-steps";

/**
 * Thin progress bar at the top of the account wizard (DESIGN.md 9.10). The fill grows with
 * transform only, and always has a text value for people who cannot see the bar.
 */
export function WizardProgress({ step }: { step: SignupStep }) {
  const { current, total } = stepPosition(step);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2">
      <div
        role="progressbar"
        aria-label="Account setup"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={`Step ${current} of ${total}`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full w-full origin-left rounded-full bg-blue transition-transform duration-(--dur-slow) ease-(--ease-out)"
          style={{ transform: `scaleX(${current / total})` }}
        />
      </div>
      <p className="text-xs font-medium text-mute">
        Step {current} of {total}
      </p>
    </div>
  );
}
