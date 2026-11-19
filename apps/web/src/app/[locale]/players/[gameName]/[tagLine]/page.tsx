import type { RankedEntry } from "@tftvn/riot";
import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PlacementBadge } from "@/components/riot/placement";
import { PlayerSearch } from "@/components/riot/player-search";
import { RiotErrorPanel } from "@/components/riot/riot-error";
import { TraitBadge } from "@/components/riot/trait-badge";
import { UnitIcon } from "@/components/riot/unit-icon";
import { currentLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { decodeSegment, riotPath } from "@/lib/riot-paths";
import { type GameLookup, getGameLookup } from "@/server/game-lookup";
import { getPlayerService } from "@/server/riot";
import { guardedLookup } from "@/server/riot/lookup-guard";
import type { PlayerMatch, PlayerUnit } from "@/server/riot/player-service";

type Params = PageProps<"/[locale]/players/[gameName]/[tagLine]">["params"];

const PROFILE_ICON_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons";

const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

const QUEUE_NAMES: Record<number, string> = {
  1090: "NORMAL_TFT",
  1100: "RANKED_TFT",
  1130: "RANKED_TFT_TURBO",
  1160: "RANKED_TFT_DOUBLE_UP",
};

export default function PlayerPage({ params }: Readonly<{ params: Params }>) {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface/5" />}>
        <PlayerContent params={params} />
      </Suspense>
    </main>
  );
}

async function PlayerContent({ params }: Readonly<{ params: Params }>) {
  const { gameName: rawName, tagLine: rawTag } = await params;
  const gameName = decodeSegment(rawName);
  const tagLine = decodeSegment(rawTag);
  const [t, result] = await Promise.all([
    getTranslations("players"),
    guardedLookup("player-lookup", () => getPlayerService().profile(gameName, tagLine)),
  ]);

  if (!result.ok) {
    return (
      <>
        <PlayerSearch defaultValue={`${gameName}#${tagLine}`} />
        <RiotErrorPanel kind={result.kind} />
      </>
    );
  }

  const profile = result.value;
  const locale = await currentLocale();
  const setNumbers = [...new Set(profile.matches.map((match) => match.setNumber))];
  const lookups = new Map(
    await Promise.all(
      setNumbers.map(
        async (setNumber) => [setNumber, await getGameLookup(setNumber, locale)] as const,
      ),
    ),
  );

  return (
    <>
      <PlayerSearch defaultValue={`${profile.gameName}#${profile.tagLine}`} />
      <header className="flex items-center gap-4">
        {profile.profileIconId == null ? null : (
          <Image
            src={`${PROFILE_ICON_URL}/${profile.profileIconId}.jpg`}
            alt=""
            width={72}
            height={72}
            unoptimized
            className="rounded-xl border-2 border-primary"
          />
        )}
        <div>
          <h1 className="text-3xl font-bold">
            {profile.gameName}
            <span className="text-muted">#{profile.tagLine}</span>
          </h1>
          {profile.summonerLevel == null ? null : (
            <p className="text-sm text-muted">{t("level", { level: profile.summonerLevel })}</p>
          )}
        </div>
      </header>

      <section aria-labelledby="ranks">
        <h2 id="ranks" className="mb-3 text-xl font-semibold text-primary">
          {t("ranks")}
        </h2>
        {profile.ranks.length === 0 ? (
          <p className="text-muted">{t("unranked")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.ranks.map((entry) => (
              <RankCard key={entry.queueType} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-3 text-xl font-semibold text-primary">
          {t("recent")}
        </h2>
        {profile.matches.length === 0 ? (
          <p className="text-muted">{t("noMatches")}</p>
        ) : (
          <ol className="space-y-3">
            {profile.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                puuid={profile.puuid}
                lookup={lookups.get(match.setNumber)!}
              />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

async function RankCard({ entry }: Readonly<{ entry: RankedEntry }>) {
  const [t, riot] = await Promise.all([getTranslations("players"), getTranslations("riot")]);
  const queueKey = `queues.${entry.queueType}`;
  const queue = riot.has(queueKey) ? riot(queueKey) : riot("queues.other");
  const tierName = entry.tier ?? entry.ratedTier ?? "";
  const tier = riot.has(`tiers.${tierName}`) ? riot(`tiers.${tierName}`) : tierName;
  const division = entry.tier && !APEX_TIERS.has(entry.tier) && entry.rank ? ` ${entry.rank}` : "";

  return (
    <li className="rounded-xl border border-line/10 bg-surface/5 p-4">
      <p className="text-sm text-muted">{queue}</p>
      <p className="text-lg font-semibold text-primary">
        {tier}
        {division}
      </p>
      <p className="text-sm">
        {entry.leaguePoints == null ? entry.ratedRating : t("lp", { lp: entry.leaguePoints })}
      </p>
      <p className="text-sm text-muted">
        {t("record", { wins: entry.wins, losses: entry.losses })}
      </p>
    </li>
  );
}

function Board({
  units,
  lookup,
  size,
}: Readonly<{ units: PlayerUnit[]; lookup: GameLookup; size?: number }>) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {units.map((unit, index) => (
        <li key={`${unit.apiName}-${index}`}>
          <UnitIcon
            champion={lookup.champion(unit.apiName)}
            star={unit.star}
            items={unit.items.map((item) => lookup.item(item))}
            size={size}
          />
        </li>
      ))}
    </ul>
  );
}

async function MatchCard({
  match,
  puuid,
  lookup,
}: Readonly<{ match: PlayerMatch; puuid: string; lookup: GameLookup }>) {
  const [t, riot, format] = await Promise.all([
    getTranslations("players"),
    getTranslations("riot"),
    getFormatter(),
  ]);
  const queueKey = `queues.${QUEUE_NAMES[match.queueId] ?? "other"}`;
  const queue = riot.has(queueKey) ? riot(queueKey) : riot("queues.other");
  const playedAt = new Date(match.playedAt);

  return (
    <li className="rounded-xl border border-line/10 bg-surface/5 p-4">
      <div className="flex flex-wrap items-start gap-4">
        <PlacementBadge
          placement={match.placement}
          label={t("placement", { placement: match.placement })}
        />
        <div className="min-w-32 text-sm">
          <p className="font-semibold">{queue}</p>
          <p className="text-muted">
            <time dateTime={playedAt.toISOString()}>
              {format.dateTime(playedAt, { dateStyle: "short", timeStyle: "short" })}
            </time>
          </p>
          <p className="text-muted">
            {t("duration", { minutes: Math.round(match.durationSeconds / 60) })} -{" "}
            {t("playerLevel", { level: match.level })}
          </p>
        </div>
        <div className="flex-1 space-y-3">
          <ul className="flex flex-wrap gap-1.5">
            {match.traits.map((trait) => (
              <li key={trait.apiName}>
                <TraitBadge
                  trait={lookup.trait(trait.apiName)}
                  style={trait.style}
                  units={trait.units}
                />
              </li>
            ))}
          </ul>
          <Board units={match.units} lookup={lookup} />
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted hover:text-primary">{t("lobby")}</summary>
        <ol className="mt-3 space-y-2">
          {match.lobby.map((player) => (
            <li
              key={player.puuid}
              className="flex flex-wrap items-center gap-3 border-t border-line/10 pt-2"
            >
              <span className="w-6 text-center font-bold">{player.placement}</span>
              <span className="w-40 truncate">
                {player.name && player.tag ? (
                  <Link
                    href={riotPath.player(player.name, player.tag)}
                    aria-current={player.puuid === puuid ? "page" : undefined}
                    className={player.puuid === puuid ? "text-primary" : "hover:text-primary"}
                  >
                    {player.name}
                    <span className="text-muted">#{player.tag}</span>
                  </Link>
                ) : (
                  "-"
                )}
              </span>
              <Board units={player.units} lookup={lookup} size={32} />
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}
