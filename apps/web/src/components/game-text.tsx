import { type GameTextNode, parseGameText } from "@tftvn/core";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TextIcon } from "./text-icon";

const TAG_CLASSES: Record<string, string> = {
  row: "block",
  li: "block pl-3",
  rules: "block text-sm text-muted italic",
  tftrules: "block text-sm text-muted italic",
  tftitemrules: "block text-sm text-muted italic",
  magicdamage: "text-damage-magic",
  physicaldamage: "text-damage-physical",
  truedamage: "text-damage-true font-semibold",
  scalehealth: "text-heal",
  shield: "text-shield",
  tftkeyword: "font-semibold text-primary",
  tftbold: "font-semibold",
  tfthighlight: "text-primary",
  tftbonus: "text-primary",
  tftradiantitembonus: "text-primary",
  tftshadowitembonus: "text-muted",
};

const ICON_LABELS: Record<string, string> = {
  scaleAP: "AP",
  scaleAD: "AD",
  scaleHealth: "HP",
  scaleArmor: "Armor",
  scaleMR: "MR",
  scaleAS: "AS",
  scaleMana: "Mana",
  scaleCrit: "Crit",
  scaleCritMult: "Crit",
  scaleDA: "DA",
  scaleDR: "DR",
  scaleSV: "Omnivamp",
  scaleRange: "Range",
  scaleManaRegen: "Mana",
  scaleHPRegen: "HP",
  goldCoins: "Gold",
  TFTManaRegen: "Mana",
  TFTBaseAD: "AD",
};

function renderNodes(nodes: readonly GameTextNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return node.value;
      case "break":
        return <br key={index} />;
      case "icon":
        return (
          <TextIcon
            key={index}
            name={node.name}
            label={ICON_LABELS[node.name] ?? node.name.replace(/^scale/, "")}
          />
        );
      case "element":
        return (
          <span key={index} className={TAG_CLASSES[node.tag.toLowerCase()]}>
            {renderNodes(node.children)}
          </span>
        );
    }
  });
}

export function GameText({ text, className }: { text: string; className?: string }) {
  return <p className={cn("leading-relaxed", className)}>{renderNodes(parseGameText(text))}</p>;
}
