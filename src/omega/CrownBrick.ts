import { systemClock, type Clock } from "../utils/time";
import type { CrownColor, CrownMode, CrownSignal } from "./contracts";

/**
 * BRICK_D_CROWN — Elegance UI.
 *
 * Theme:  BLACK_GOLD_PATTERN_5PT_CROWN
 * Mode:   Live_Sell / Connect_To_Stitch
 * Visual: Green = Stable | Gold = Resurrection_Active | Red = Breach
 */
export class CrownBrick {
  public static readonly IDENT = "BRICK_D_CROWN" as const;
  public static readonly STATE = "LIVE_SELL" as const;
  public static readonly THEME = "BLACK_GOLD_PATTERN_5PT_CROWN" as const;

  private current: CrownSignal;
  private readonly history: CrownSignal[] = [];

  constructor(private readonly clock: Clock = systemClock, mode: CrownMode = "Idle") {
    this.current = this.build("GREEN", mode, "Crown initialized — stable.");
    this.history.push(this.current);
  }

  signal(color: CrownColor, mode: CrownMode, message: string): CrownSignal {
    this.current = this.build(color, mode, message);
    this.history.push(this.current);
    return this.current;
  }

  green(message = "Stable.", mode: CrownMode = "Live_Sell"): CrownSignal {
    return this.signal("GREEN", mode, message);
  }

  gold(message = "Resurrection active — gold flash.", mode: CrownMode = "Connect_To_Stitch"): CrownSignal {
    return this.signal("GOLD", mode, message);
  }

  red(message = "Breach detected.", mode: CrownMode = "Connect_To_Stitch"): CrownSignal {
    return this.signal("RED", mode, message);
  }

  state(): CrownSignal {
    return this.current;
  }

  trail(): readonly CrownSignal[] {
    return this.history.slice();
  }

  private build(color: CrownColor, mode: CrownMode, message: string): CrownSignal {
    return Object.freeze({
      color,
      mode,
      theme: CrownBrick.THEME,
      message,
      at: this.clock()
    });
  }
}
