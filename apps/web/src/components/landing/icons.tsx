import {
  Bot,
  Download,
  FileText,
  MessagesSquare,
  Sparkles,
  UserRound,
  Video,
  Wrench,
  type LucideIcon,
  CircleDot,
} from "lucide-react";

/**
 * Maps `landingpageconfig.features[].icon` strings to lucide components.
 * Keeping an explicit allow-list (vs dynamic import) means config can't pull an
 * arbitrary symbol and the icons stay tree-shakeable in the server bundle.
 */
const ICONS: Record<string, LucideIcon> = {
  MessagesSquare,
  Bot,
  Video,
  Wrench,
  Sparkles,
  FileText,
  UserRound,
  Download,
};

export function FeatureIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? CircleDot;
  return <Icon aria-hidden className={className} />;
}
