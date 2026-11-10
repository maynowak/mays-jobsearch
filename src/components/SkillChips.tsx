import { useState } from "react";
import { useLang } from "../i18n";

interface Props {
  skills: readonly string[];
  max?: number;
  label?: string;
}

function displaySkill(skill: string): string {
  return skill
    .trim()
    .replace(/^[\s"'“”„«»]+/, "")
    .replace(/[\s"'“”„«»]+$/, "")
    .trim();
}

/** Read-only skill chips; display-only quote cleanup, no data mutation. */
export default function SkillChips({ skills, max = 6, label }: Props) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const normalized = skills.map(displaySkill).filter((skill) => skill.length > 0);
  const visible = expanded ? normalized : normalized.slice(0, max);
  const hasMore = normalized.length > max;

  if (normalized.length === 0) return <span aria-hidden="true">—</span>;

  return (
    <div className="skill-chips">
      <ul className="skill-chips__list" aria-label={label ?? t("skills.aria")}>
        {visible.map((skill, index) => (
          <li key={`${skill}-${index}`} className="skill-chips__chip">{skill}</li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          className="skill-chips__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("skills.showLess") : t("skills.showMore")}
        </button>
      )}
    </div>
  );
}
