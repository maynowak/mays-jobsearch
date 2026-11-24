import { useCallback, useEffect, useState } from "react";
import { useLang } from "../i18n";
import RadarNavigator, { type RadarNavigatorLabels } from "./RadarNavigator";
import {
  layoutRadarLabels,
  type NavigatorTarget,
} from "../lib/navigation/radarNavigator";

export { layoutRadarLabels };

interface Props {
  radarKey: string;
  onActivate: () => void;
}

function readTargets(): NavigatorTarget[] {
  const section = document.getElementById("matches");
  if (!section) return [];
  return Array.from(section.querySelectorAll<HTMLElement>("[data-radar-job-id]"))
    .map((node) => ({
      id: node.dataset.radarJobId ?? "",
      title: node.dataset.radarJobTitle ?? "",
      element: node,
      getElement: () => node,
    }))
    .filter((target) => Boolean(target.id));
}

function sameTargets(left: NavigatorTarget[], right: NavigatorTarget[]): boolean {
  return left.length === right.length &&
    left.every((target, index) =>
      target.id === right[index].id &&
      target.title === right[index].title &&
      target.element === right[index].element
    );
}

export default function MatchRadar({ radarKey, onActivate }: Props) {
  const { t } = useLang();
  const [targets, setTargets] = useState<NavigatorTarget[]>([]);

  const refreshTargets = useCallback(() => {
    const next = readTargets();
    setTargets((current) => sameTargets(current, next) ? current : next);
  }, []);

  useEffect(() => {
    refreshTargets();
    const section = document.getElementById("matches");
    if (!section || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(refreshTargets);
    observer.observe(section, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-radar-job-id", "data-radar-job-title"],
    });
    return () => observer.disconnect();
  }, [radarKey, refreshTargets]);

  const labels: RadarNavigatorLabels = {
    aria: t("matchRadar.aria"),
    open: t("matchRadar.open"),
    close: t("matchRadar.close"),
    overview: t("matchRadar.overview"),
    goTo: (title) => t("matchRadar.goTo", { title }),
  };

  return (
    <RadarNavigator
      targets={targets}
      labels={labels}
      navigationKey={radarKey}
      onActivate={onActivate}
      regionSelector="#matches"
      classNamePrefix="match-radar"
      panelId="match-radar-panel"
    />
  );
}
