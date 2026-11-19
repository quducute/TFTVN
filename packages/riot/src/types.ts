export type ApexTier = "challenger" | "grandmaster" | "master";

export interface LeagueEntry {
  puuid: string;
  leaguePoints: number;
  rank: string;
  wins: number;
  losses: number;
  veteran: boolean;
  inactive: boolean;
  freshBlood: boolean;
  hotStreak: boolean;
}

export interface LeagueList {
  tier: string;
  queue: string;
  entries: LeagueEntry[];
}

export interface RankedEntry {
  queueType: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins: number;
  losses: number;
  hotStreak?: boolean;
  ratedTier?: string;
  ratedRating?: number;
}

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface Summoner {
  puuid: string;
  profileIconId: number;
  summonerLevel: number;
  revisionDate: number;
}

export interface MatchTrait {
  name: string;
  num_units: number;
  style: number;
  tier_current: number;
  tier_total: number;
}

export interface MatchUnit {
  character_id: string;
  itemNames: string[];
  rarity: number;
  tier: number;
}

export interface MatchParticipant {
  puuid: string;
  placement: number;
  level: number;
  last_round: number;
  gold_left: number;
  total_damage_to_players: number;
  riotIdGameName?: string;
  riotIdTagline?: string;
  traits: MatchTrait[];
  units: MatchUnit[];
}

export interface Match {
  metadata: { match_id: string; participants: string[] };
  info: {
    game_datetime: number;
    game_length: number;
    game_version: string;
    queue_id: number;
    tft_game_type: string;
    tft_set_number: number;
    tft_set_core_name?: string;
    participants: MatchParticipant[];
  };
}

export const RANKED_TFT_QUEUE_ID = 1100;
