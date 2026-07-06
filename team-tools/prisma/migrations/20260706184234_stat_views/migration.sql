-- Aggregate stat views. Season/career totals are DERIVED from the per-game box
-- score rows so they can never drift. Counting stats use SUM; single-play "long"
-- stats use MAX. These views are not modeled in the Prisma schema on purpose --
-- the Quarto Python reader queries them directly with raw SQL.

-- ---------------------------------------------------------------------------
-- Per-player, per-season totals
-- ---------------------------------------------------------------------------
CREATE VIEW season_player_stats AS
SELECT
    gps.player_id,
    g.season_id,
    COUNT(DISTINCT gps.game_id)     AS games_played,
    -- Offensive: passing
    SUM(gps.pass_cmp)               AS pass_cmp,
    SUM(gps.pass_att)               AS pass_att,
    SUM(gps.pass_yds)               AS pass_yds,
    SUM(gps.pass_td)                AS pass_td,
    SUM(gps.pass_int)               AS pass_int,
    MAX(gps.pass_long)              AS pass_long,
    SUM(gps.sacked)                 AS sacked,
    -- Offensive: rushing
    SUM(gps.rush_att)               AS rush_att,
    SUM(gps.rush_yds)               AS rush_yds,
    SUM(gps.rush_td)                AS rush_td,
    MAX(gps.rush_long)              AS rush_long,
    -- Offensive: receiving
    SUM(gps.targets)                AS targets,
    SUM(gps.rec)                    AS rec,
    SUM(gps.rec_yds)                AS rec_yds,
    SUM(gps.rec_td)                 AS rec_td,
    MAX(gps.rec_long)               AS rec_long,
    -- Defensive
    SUM(gps.tackles_solo)           AS tackles_solo,
    SUM(gps.tackles_ast)            AS tackles_ast,
    SUM(gps.tackles_for_loss)       AS tackles_for_loss,
    SUM(gps.sacks)                  AS sacks,
    SUM(gps.qb_hurries)             AS qb_hurries,
    SUM(gps.def_int)                AS def_int,
    SUM(gps.int_yds)                AS int_yds,
    SUM(gps.passes_defended)        AS passes_defended,
    SUM(gps.forced_fumbles)         AS forced_fumbles,
    SUM(gps.fumbles_recovered)      AS fumbles_recovered,
    SUM(gps.def_td)                 AS def_td,
    -- Kicking
    SUM(gps.fg_made)                AS fg_made,
    SUM(gps.fg_att)                 AS fg_att,
    MAX(gps.fg_long)                AS fg_long,
    SUM(gps.xp_made)                AS xp_made,
    SUM(gps.xp_att)                 AS xp_att,
    SUM(gps.punts)                  AS punts,
    SUM(gps.punt_yds)               AS punt_yds,
    MAX(gps.punt_long)              AS punt_long,
    -- Other: returns + fumbles
    SUM(gps.kr_ret)                 AS kr_ret,
    SUM(gps.kr_yds)                 AS kr_yds,
    SUM(gps.kr_td)                  AS kr_td,
    SUM(gps.pr_ret)                 AS pr_ret,
    SUM(gps.pr_yds)                 AS pr_yds,
    SUM(gps.pr_td)                  AS pr_td,
    SUM(gps.fumbles)                AS fumbles,
    SUM(gps.fumbles_lost)           AS fumbles_lost
FROM game_player_stats gps
JOIN games g ON g.id = gps.game_id
GROUP BY gps.player_id, g.season_id;

-- ---------------------------------------------------------------------------
-- Per-player career totals (all seasons combined)
-- ---------------------------------------------------------------------------
CREATE VIEW career_player_stats AS
SELECT
    gps.player_id,
    COUNT(DISTINCT gps.game_id)     AS games_played,
    SUM(gps.pass_cmp)               AS pass_cmp,
    SUM(gps.pass_att)               AS pass_att,
    SUM(gps.pass_yds)               AS pass_yds,
    SUM(gps.pass_td)                AS pass_td,
    SUM(gps.pass_int)               AS pass_int,
    MAX(gps.pass_long)              AS pass_long,
    SUM(gps.sacked)                 AS sacked,
    SUM(gps.rush_att)               AS rush_att,
    SUM(gps.rush_yds)               AS rush_yds,
    SUM(gps.rush_td)                AS rush_td,
    MAX(gps.rush_long)              AS rush_long,
    SUM(gps.targets)                AS targets,
    SUM(gps.rec)                    AS rec,
    SUM(gps.rec_yds)                AS rec_yds,
    SUM(gps.rec_td)                 AS rec_td,
    MAX(gps.rec_long)               AS rec_long,
    SUM(gps.tackles_solo)           AS tackles_solo,
    SUM(gps.tackles_ast)            AS tackles_ast,
    SUM(gps.tackles_for_loss)       AS tackles_for_loss,
    SUM(gps.sacks)                  AS sacks,
    SUM(gps.qb_hurries)             AS qb_hurries,
    SUM(gps.def_int)                AS def_int,
    SUM(gps.int_yds)                AS int_yds,
    SUM(gps.passes_defended)        AS passes_defended,
    SUM(gps.forced_fumbles)         AS forced_fumbles,
    SUM(gps.fumbles_recovered)      AS fumbles_recovered,
    SUM(gps.def_td)                 AS def_td,
    SUM(gps.fg_made)                AS fg_made,
    SUM(gps.fg_att)                 AS fg_att,
    MAX(gps.fg_long)                AS fg_long,
    SUM(gps.xp_made)                AS xp_made,
    SUM(gps.xp_att)                 AS xp_att,
    SUM(gps.punts)                  AS punts,
    SUM(gps.punt_yds)               AS punt_yds,
    MAX(gps.punt_long)              AS punt_long,
    SUM(gps.kr_ret)                 AS kr_ret,
    SUM(gps.kr_yds)                 AS kr_yds,
    SUM(gps.kr_td)                  AS kr_td,
    SUM(gps.pr_ret)                 AS pr_ret,
    SUM(gps.pr_yds)                 AS pr_yds,
    SUM(gps.pr_td)                  AS pr_td,
    SUM(gps.fumbles)                AS fumbles,
    SUM(gps.fumbles_lost)           AS fumbles_lost
FROM game_player_stats gps
GROUP BY gps.player_id;

-- ---------------------------------------------------------------------------
-- Per-season team totals (plus record derived from the scoreboard)
-- ---------------------------------------------------------------------------
CREATE VIEW season_team_stats AS
SELECT
    g.season_id,
    COUNT(DISTINCT g.id)                                          AS games,
    SUM(CASE WHEN g.team_points > g.opp_points THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN g.team_points < g.opp_points THEN 1 ELSE 0 END) AS losses,
    SUM(CASE WHEN g.team_points = g.opp_points THEN 1 ELSE 0 END) AS ties,
    SUM(g.team_points)              AS points_for,
    SUM(g.opp_points)               AS points_against,
    -- Offensive
    SUM(gts.first_downs)            AS first_downs,
    SUM(gts.total_plays)            AS total_plays,
    SUM(gts.total_yards)            AS total_yards,
    SUM(gts.pass_yds)               AS pass_yds,
    SUM(gts.rush_yds)               AS rush_yds,
    SUM(gts.third_down_conv)        AS third_down_conv,
    SUM(gts.third_down_att)         AS third_down_att,
    SUM(gts.fourth_down_conv)       AS fourth_down_conv,
    SUM(gts.fourth_down_att)        AS fourth_down_att,
    SUM(gts.penalties)              AS penalties,
    SUM(gts.penalty_yds)            AS penalty_yds,
    SUM(gts.turnovers)              AS turnovers,
    SUM(gts.time_of_possession_sec) AS time_of_possession_sec,
    -- Defensive
    SUM(gts.sacks)                  AS sacks,
    SUM(gts.tackles_for_loss)       AS tackles_for_loss,
    SUM(gts.takeaways)              AS takeaways,
    SUM(gts.def_td)                 AS def_td,
    -- Kicking
    SUM(gts.fg_made)                AS fg_made,
    SUM(gts.fg_att)                 AS fg_att,
    SUM(gts.xp_made)                AS xp_made,
    SUM(gts.xp_att)                 AS xp_att,
    SUM(gts.punts)                  AS punts,
    SUM(gts.punt_yds)               AS punt_yds,
    -- Other
    SUM(gts.return_yds)             AS return_yds,
    SUM(gts.return_td)              AS return_td
FROM games g
LEFT JOIN game_team_stats gts ON gts.game_id = g.id
GROUP BY g.season_id;
