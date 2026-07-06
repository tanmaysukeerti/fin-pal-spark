import {
  Flame, Trophy, Zap, Sparkles, Target, Sunrise, Shield, IndianRupee,
  PiggyBank, TrendingUp, Users, Award, type LucideIcon,
} from "lucide-react";

/** Map achievement `icon` string (stored in DB) → Lucide component. */
export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  Flame, Trophy, Zap, Sparkles, Target, Sunrise, Shield, IndianRupee,
  PiggyBank, TrendingUp, Users, Award,
};

export function achievementIcon(name: string): LucideIcon {
  return ACHIEVEMENT_ICONS[name] ?? Award;
}
