import { expect, test } from "@playwright/test";
import { TEXT_ICON_BASE_URL, assetUrl, roleIconUrl, textIconUrl } from "./assets";

test("assetUrl lowercases game paths and swaps texture extensions", () => {
  expect(assetUrl("ASSETS/Maps/Icon.TEX")).toBe(
    "https://raw.communitydragon.org/latest/game/assets/maps/icon.png",
  );
  expect(assetUrl(null)).toBeNull();
  expect(assetUrl("None")).toBeNull();
  expect(assetUrl("")).toBeNull();
});

test("textIconUrl maps game text icons to CommunityDragon stat icons", () => {
  expect(textIconUrl("scaleAD")).toBe(`${TEXT_ICON_BASE_URL}/lol/statsicon/scalead.png`);
  expect(textIconUrl("scaleMR")).toBe(`${TEXT_ICON_BASE_URL}/lol/statsicon/scalemr.png`);
  expect(textIconUrl("TFTBaseAD")).toBe(`${TEXT_ICON_BASE_URL}/lol/statsicon/scalead.png`);
  expect(textIconUrl("goldCoins")).toBe(`${TEXT_ICON_BASE_URL}/lol/gameplay/goldcoins.png`);
  expect(textIconUrl("set14AmpIcon")).toBeNull();
});

test("roleIconUrl maps standard roles to TFT role icons", () => {
  expect(roleIconUrl("ADCarry")).toBe(
    `${TEXT_ICON_BASE_URL}/tft/characterroles/tft_attack_carry.png`,
  );
  expect(roleIconUrl("APTank")).toBe(`${TEXT_ICON_BASE_URL}/tft/characterroles/tft_magic_tank.png`);
  expect(roleIconUrl("HFighter")).toBe(
    `${TEXT_ICON_BASE_URL}/tft/characterroles/tft_hybrid_fighter.png`,
  );
  expect(roleIconUrl("TFT18_CustomRole")).toBeNull();
});
