--
-- PostgreSQL database dump
--

\restrict cx4YMN9THfTyHOjNCT3HRUENFAMRkt5Oxv766iUcOdaXeVSVTZi3g8hD7GB00hp

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Debian 18.4-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.season_rosters DROP CONSTRAINT IF EXISTS season_rosters_season_id_fkey;
ALTER TABLE IF EXISTS ONLY public.season_players DROP CONSTRAINT IF EXISTS season_players_season_roster_id_fkey;
ALTER TABLE IF EXISTS ONLY public.season_players DROP CONSTRAINT IF EXISTS season_players_player_id_fkey;
ALTER TABLE IF EXISTS ONLY public.games DROP CONSTRAINT IF EXISTS games_season_id_fkey;
ALTER TABLE IF EXISTS ONLY public.game_team_stats DROP CONSTRAINT IF EXISTS game_team_stats_game_id_fkey;
ALTER TABLE IF EXISTS ONLY public.game_player_stats DROP CONSTRAINT IF EXISTS game_player_stats_player_id_fkey;
ALTER TABLE IF EXISTS ONLY public.game_player_stats DROP CONSTRAINT IF EXISTS game_player_stats_game_id_fkey;
DROP INDEX IF EXISTS public.seasons_name_key;
DROP INDEX IF EXISTS public.season_rosters_season_id_key;
DROP INDEX IF EXISTS public.season_players_season_roster_id_player_name_key;
DROP INDEX IF EXISTS public.season_players_season_roster_id_player_id_key;
DROP INDEX IF EXISTS public.games_season_id_week_key;
DROP INDEX IF EXISTS public.game_team_stats_game_id_key;
DROP INDEX IF EXISTS public.game_player_stats_game_id_player_id_key;
ALTER TABLE IF EXISTS ONLY public.seasons DROP CONSTRAINT IF EXISTS seasons_pkey;
ALTER TABLE IF EXISTS ONLY public.season_rosters DROP CONSTRAINT IF EXISTS season_rosters_pkey;
ALTER TABLE IF EXISTS ONLY public.season_players DROP CONSTRAINT IF EXISTS season_players_pkey;
ALTER TABLE IF EXISTS ONLY public.players DROP CONSTRAINT IF EXISTS players_pkey;
ALTER TABLE IF EXISTS ONLY public.games DROP CONSTRAINT IF EXISTS games_pkey;
ALTER TABLE IF EXISTS ONLY public.game_team_stats DROP CONSTRAINT IF EXISTS game_team_stats_pkey;
ALTER TABLE IF EXISTS ONLY public.game_player_stats DROP CONSTRAINT IF EXISTS game_player_stats_pkey;
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS public.seasons ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.season_rosters ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.season_players ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.players ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.games ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.game_team_stats ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.game_player_stats ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.seasons_id_seq;
DROP TABLE IF EXISTS public.seasons;
DROP VIEW IF EXISTS public.season_team_stats;
DROP SEQUENCE IF EXISTS public.season_rosters_id_seq;
DROP TABLE IF EXISTS public.season_rosters;
DROP SEQUENCE IF EXISTS public.season_players_id_seq;
DROP TABLE IF EXISTS public.season_players;
DROP VIEW IF EXISTS public.season_player_stats;
DROP SEQUENCE IF EXISTS public.players_id_seq;
DROP TABLE IF EXISTS public.players;
DROP SEQUENCE IF EXISTS public.games_id_seq;
DROP TABLE IF EXISTS public.games;
DROP SEQUENCE IF EXISTS public.game_team_stats_id_seq;
DROP TABLE IF EXISTS public.game_team_stats;
DROP SEQUENCE IF EXISTS public.game_player_stats_id_seq;
DROP VIEW IF EXISTS public.career_player_stats;
DROP TABLE IF EXISTS public.game_player_stats;
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TYPE IF EXISTS public.player_class;
DROP TYPE IF EXISTS public.game_location;
--
-- Name: game_location; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.game_location AS ENUM (
    'HOME',
    'AWAY',
    'NEUTRAL'
);


--
-- Name: player_class; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.player_class AS ENUM (
    'FRESHMAN',
    'REDSHIRT_FRESHMAN',
    'SOPHOMORE',
    'REDSHIRT_SOPHOMORE',
    'JUNIOR',
    'REDSHIRT_JUNIOR',
    'SENIOR',
    'REDSHIRT_SENIOR',
    'GRADUATED',
    'TRANSFERRED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: game_player_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_player_stats (
    id integer NOT NULL,
    game_id integer NOT NULL,
    player_id integer NOT NULL,
    pass_cmp integer DEFAULT 0 NOT NULL,
    pass_att integer DEFAULT 0 NOT NULL,
    pass_yds integer DEFAULT 0 NOT NULL,
    pass_td integer DEFAULT 0 NOT NULL,
    pass_int integer DEFAULT 0 NOT NULL,
    pass_long integer DEFAULT 0 NOT NULL,
    sacked integer DEFAULT 0 NOT NULL,
    rush_att integer DEFAULT 0 NOT NULL,
    rush_yds integer DEFAULT 0 NOT NULL,
    rush_td integer DEFAULT 0 NOT NULL,
    rush_long integer DEFAULT 0 NOT NULL,
    targets integer DEFAULT 0 NOT NULL,
    rec integer DEFAULT 0 NOT NULL,
    rec_yds integer DEFAULT 0 NOT NULL,
    rec_td integer DEFAULT 0 NOT NULL,
    rec_long integer DEFAULT 0 NOT NULL,
    tackles_solo integer DEFAULT 0 NOT NULL,
    tackles_ast integer DEFAULT 0 NOT NULL,
    tackles_for_loss double precision DEFAULT 0 NOT NULL,
    sacks double precision DEFAULT 0 NOT NULL,
    qb_hurries integer DEFAULT 0 NOT NULL,
    def_int integer DEFAULT 0 NOT NULL,
    int_yds integer DEFAULT 0 NOT NULL,
    passes_defended integer DEFAULT 0 NOT NULL,
    forced_fumbles integer DEFAULT 0 NOT NULL,
    fumbles_recovered integer DEFAULT 0 NOT NULL,
    def_td integer DEFAULT 0 NOT NULL,
    fg_made integer DEFAULT 0 NOT NULL,
    fg_att integer DEFAULT 0 NOT NULL,
    fg_long integer DEFAULT 0 NOT NULL,
    xp_made integer DEFAULT 0 NOT NULL,
    xp_att integer DEFAULT 0 NOT NULL,
    punts integer DEFAULT 0 NOT NULL,
    punt_yds integer DEFAULT 0 NOT NULL,
    punt_long integer DEFAULT 0 NOT NULL,
    kr_ret integer DEFAULT 0 NOT NULL,
    kr_yds integer DEFAULT 0 NOT NULL,
    kr_td integer DEFAULT 0 NOT NULL,
    pr_ret integer DEFAULT 0 NOT NULL,
    pr_yds integer DEFAULT 0 NOT NULL,
    pr_td integer DEFAULT 0 NOT NULL,
    fumbles integer DEFAULT 0 NOT NULL,
    fumbles_lost integer DEFAULT 0 NOT NULL
);


--
-- Name: career_player_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.career_player_stats AS
 SELECT player_id,
    count(DISTINCT game_id) AS games_played,
    sum(pass_cmp) AS pass_cmp,
    sum(pass_att) AS pass_att,
    sum(pass_yds) AS pass_yds,
    sum(pass_td) AS pass_td,
    sum(pass_int) AS pass_int,
    max(pass_long) AS pass_long,
    sum(sacked) AS sacked,
    sum(rush_att) AS rush_att,
    sum(rush_yds) AS rush_yds,
    sum(rush_td) AS rush_td,
    max(rush_long) AS rush_long,
    sum(targets) AS targets,
    sum(rec) AS rec,
    sum(rec_yds) AS rec_yds,
    sum(rec_td) AS rec_td,
    max(rec_long) AS rec_long,
    sum(tackles_solo) AS tackles_solo,
    sum(tackles_ast) AS tackles_ast,
    sum(tackles_for_loss) AS tackles_for_loss,
    sum(sacks) AS sacks,
    sum(qb_hurries) AS qb_hurries,
    sum(def_int) AS def_int,
    sum(int_yds) AS int_yds,
    sum(passes_defended) AS passes_defended,
    sum(forced_fumbles) AS forced_fumbles,
    sum(fumbles_recovered) AS fumbles_recovered,
    sum(def_td) AS def_td,
    sum(fg_made) AS fg_made,
    sum(fg_att) AS fg_att,
    max(fg_long) AS fg_long,
    sum(xp_made) AS xp_made,
    sum(xp_att) AS xp_att,
    sum(punts) AS punts,
    sum(punt_yds) AS punt_yds,
    max(punt_long) AS punt_long,
    sum(kr_ret) AS kr_ret,
    sum(kr_yds) AS kr_yds,
    sum(kr_td) AS kr_td,
    sum(pr_ret) AS pr_ret,
    sum(pr_yds) AS pr_yds,
    sum(pr_td) AS pr_td,
    sum(fumbles) AS fumbles,
    sum(fumbles_lost) AS fumbles_lost
   FROM public.game_player_stats gps
  GROUP BY player_id;


--
-- Name: game_player_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_player_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_player_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_player_stats_id_seq OWNED BY public.game_player_stats.id;


--
-- Name: game_team_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_team_stats (
    id integer NOT NULL,
    game_id integer NOT NULL,
    first_downs integer DEFAULT 0 NOT NULL,
    total_plays integer DEFAULT 0 NOT NULL,
    total_yards integer DEFAULT 0 NOT NULL,
    pass_yds integer DEFAULT 0 NOT NULL,
    rush_yds integer DEFAULT 0 NOT NULL,
    third_down_conv integer DEFAULT 0 NOT NULL,
    third_down_att integer DEFAULT 0 NOT NULL,
    fourth_down_conv integer DEFAULT 0 NOT NULL,
    fourth_down_att integer DEFAULT 0 NOT NULL,
    penalties integer DEFAULT 0 NOT NULL,
    penalty_yds integer DEFAULT 0 NOT NULL,
    turnovers integer DEFAULT 0 NOT NULL,
    time_of_possession_sec integer DEFAULT 0 NOT NULL,
    sacks double precision DEFAULT 0 NOT NULL,
    tackles_for_loss double precision DEFAULT 0 NOT NULL,
    takeaways integer DEFAULT 0 NOT NULL,
    def_td integer DEFAULT 0 NOT NULL,
    fg_made integer DEFAULT 0 NOT NULL,
    fg_att integer DEFAULT 0 NOT NULL,
    xp_made integer DEFAULT 0 NOT NULL,
    xp_att integer DEFAULT 0 NOT NULL,
    punts integer DEFAULT 0 NOT NULL,
    punt_yds integer DEFAULT 0 NOT NULL,
    return_yds integer DEFAULT 0 NOT NULL,
    return_td integer DEFAULT 0 NOT NULL
);


--
-- Name: game_team_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_team_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_team_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_team_stats_id_seq OWNED BY public.game_team_stats.id;


--
-- Name: games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.games (
    id integer NOT NULL,
    season_id integer NOT NULL,
    week integer,
    date date,
    opponent text NOT NULL,
    location public.game_location DEFAULT 'HOME'::public.game_location NOT NULL,
    team_points integer DEFAULT 0 NOT NULL,
    opp_points integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    opp_ot integer DEFAULT 0 NOT NULL,
    opp_q1 integer DEFAULT 0 NOT NULL,
    opp_q2 integer DEFAULT 0 NOT NULL,
    opp_q3 integer DEFAULT 0 NOT NULL,
    opp_q4 integer DEFAULT 0 NOT NULL,
    team_ot integer DEFAULT 0 NOT NULL,
    team_q1 integer DEFAULT 0 NOT NULL,
    team_q2 integer DEFAULT 0 NOT NULL,
    team_q3 integer DEFAULT 0 NOT NULL,
    team_q4 integer DEFAULT 0 NOT NULL
);


--
-- Name: games_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    awards text,
    bio text,
    notable_events text,
    photo bytea
);


--
-- Name: players_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.players_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.players_id_seq OWNED BY public.players.id;


--
-- Name: season_player_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.season_player_stats AS
 SELECT gps.player_id,
    g.season_id,
    count(DISTINCT gps.game_id) AS games_played,
    sum(gps.pass_cmp) AS pass_cmp,
    sum(gps.pass_att) AS pass_att,
    sum(gps.pass_yds) AS pass_yds,
    sum(gps.pass_td) AS pass_td,
    sum(gps.pass_int) AS pass_int,
    max(gps.pass_long) AS pass_long,
    sum(gps.sacked) AS sacked,
    sum(gps.rush_att) AS rush_att,
    sum(gps.rush_yds) AS rush_yds,
    sum(gps.rush_td) AS rush_td,
    max(gps.rush_long) AS rush_long,
    sum(gps.targets) AS targets,
    sum(gps.rec) AS rec,
    sum(gps.rec_yds) AS rec_yds,
    sum(gps.rec_td) AS rec_td,
    max(gps.rec_long) AS rec_long,
    sum(gps.tackles_solo) AS tackles_solo,
    sum(gps.tackles_ast) AS tackles_ast,
    sum(gps.tackles_for_loss) AS tackles_for_loss,
    sum(gps.sacks) AS sacks,
    sum(gps.qb_hurries) AS qb_hurries,
    sum(gps.def_int) AS def_int,
    sum(gps.int_yds) AS int_yds,
    sum(gps.passes_defended) AS passes_defended,
    sum(gps.forced_fumbles) AS forced_fumbles,
    sum(gps.fumbles_recovered) AS fumbles_recovered,
    sum(gps.def_td) AS def_td,
    sum(gps.fg_made) AS fg_made,
    sum(gps.fg_att) AS fg_att,
    max(gps.fg_long) AS fg_long,
    sum(gps.xp_made) AS xp_made,
    sum(gps.xp_att) AS xp_att,
    sum(gps.punts) AS punts,
    sum(gps.punt_yds) AS punt_yds,
    max(gps.punt_long) AS punt_long,
    sum(gps.kr_ret) AS kr_ret,
    sum(gps.kr_yds) AS kr_yds,
    sum(gps.kr_td) AS kr_td,
    sum(gps.pr_ret) AS pr_ret,
    sum(gps.pr_yds) AS pr_yds,
    sum(gps.pr_td) AS pr_td,
    sum(gps.fumbles) AS fumbles,
    sum(gps.fumbles_lost) AS fumbles_lost
   FROM (public.game_player_stats gps
     JOIN public.games g ON ((g.id = gps.game_id)))
  GROUP BY gps.player_id, g.season_id;


--
-- Name: season_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.season_players (
    id integer NOT NULL,
    season_roster_id integer NOT NULL,
    player_id integer NOT NULL,
    "position" character varying(8) NOT NULL,
    class public.player_class NOT NULL,
    number integer,
    player_name text NOT NULL
);


--
-- Name: season_players_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.season_players_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: season_players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.season_players_id_seq OWNED BY public.season_players.id;


--
-- Name: season_rosters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.season_rosters (
    id integer NOT NULL,
    season_id integer NOT NULL
);


--
-- Name: season_rosters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.season_rosters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: season_rosters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.season_rosters_id_seq OWNED BY public.season_rosters.id;


--
-- Name: season_team_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.season_team_stats AS
 SELECT g.season_id,
    count(DISTINCT g.id) AS games,
    sum(
        CASE
            WHEN (g.team_points > g.opp_points) THEN 1
            ELSE 0
        END) AS wins,
    sum(
        CASE
            WHEN (g.team_points < g.opp_points) THEN 1
            ELSE 0
        END) AS losses,
    sum(
        CASE
            WHEN (g.team_points = g.opp_points) THEN 1
            ELSE 0
        END) AS ties,
    sum(g.team_points) AS points_for,
    sum(g.opp_points) AS points_against,
    sum(gts.first_downs) AS first_downs,
    sum(gts.total_plays) AS total_plays,
    sum(gts.total_yards) AS total_yards,
    sum(gts.pass_yds) AS pass_yds,
    sum(gts.rush_yds) AS rush_yds,
    sum(gts.third_down_conv) AS third_down_conv,
    sum(gts.third_down_att) AS third_down_att,
    sum(gts.fourth_down_conv) AS fourth_down_conv,
    sum(gts.fourth_down_att) AS fourth_down_att,
    sum(gts.penalties) AS penalties,
    sum(gts.penalty_yds) AS penalty_yds,
    sum(gts.turnovers) AS turnovers,
    sum(gts.time_of_possession_sec) AS time_of_possession_sec,
    sum(gts.sacks) AS sacks,
    sum(gts.tackles_for_loss) AS tackles_for_loss,
    sum(gts.takeaways) AS takeaways,
    sum(gts.def_td) AS def_td,
    sum(gts.fg_made) AS fg_made,
    sum(gts.fg_att) AS fg_att,
    sum(gts.xp_made) AS xp_made,
    sum(gts.xp_att) AS xp_att,
    sum(gts.punts) AS punts,
    sum(gts.punt_yds) AS punt_yds,
    sum(gts.return_yds) AS return_yds,
    sum(gts.return_td) AS return_td
   FROM (public.games g
     LEFT JOIN public.game_team_stats gts ON ((gts.game_id = g.id)))
  GROUP BY g.season_id;


--
-- Name: seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seasons (
    id integer NOT NULL,
    name text NOT NULL,
    start_year integer NOT NULL,
    end_year integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: seasons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seasons_id_seq OWNED BY public.seasons.id;


--
-- Name: game_player_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_player_stats ALTER COLUMN id SET DEFAULT nextval('public.game_player_stats_id_seq'::regclass);


--
-- Name: game_team_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_team_stats ALTER COLUMN id SET DEFAULT nextval('public.game_team_stats_id_seq'::regclass);


--
-- Name: games id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);


--
-- Name: players id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);


--
-- Name: season_players id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_players ALTER COLUMN id SET DEFAULT nextval('public.season_players_id_seq'::regclass);


--
-- Name: season_rosters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_rosters ALTER COLUMN id SET DEFAULT nextval('public.season_rosters_id_seq'::regclass);


--
-- Name: seasons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons ALTER COLUMN id SET DEFAULT nextval('public.seasons_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
affa2fe9-b313-4b1c-bfd2-5ec6c2574798	161d4f8028335e9687ec54af6c48e6b7be4cd5f3f3f18b4a52b7e646814185f2	2026-07-06 18:17:05.720529+00	20260706181705_init	\N	\N	2026-07-06 18:17:05.572547+00	1
8f6eef31-3cd5-42fa-b803-ff532357ee8a	11799eabc4d83bd8463189ae07a1e30ec8e2625144894297e9dfac11cb761ce0	2026-07-06 18:42:03.80199+00	20260706184203_add_stats	\N	\N	2026-07-06 18:42:03.677434+00	1
f4c0b821-2b0f-4d01-9292-9b3b64f9d897	a4eea7215b81482eda063e9237848afc5e36f6c3ad55471759d2bfc4f0ee0b81	2026-07-06 19:33:27.380947+00	20260706184234_stat_views	\N	\N	2026-07-06 19:33:27.325581+00	1
8c44646f-03ed-4461-ba96-6678c640ebaa	3715c0d35e1171de32e42ea2fbde34e5f5fc46cdeef861a13fdbd4a733b41572	2026-07-06 20:17:55.52398+00	20260706190000_season_player_state	\N	\N	2026-07-06 20:17:55.39306+00	1
e9cdfe3b-a009-4dfd-be9f-0241f1fb992a	8c9de5817c657dcdc8dad0583b5904f0ea08135ac9da0d668a546d55fbe05bec	2026-07-06 23:03:04.953419+00	20260706230304_game_quarter_scores	\N	\N	2026-07-06 23:03:04.877627+00	1
0fd07b17-5bd8-4456-a065-0be18338e027	b8c89d945c3d3f9556eba1f74065a39e65be88e6917d001e8761d1cb0f74ea92	2026-07-06 23:29:49.716529+00	20260706232949_player_profile	\N	\N	2026-07-06 23:29:49.707007+00	1
87a5db16-e956-4faf-b462-7dcc0c025350	4817ed8d7408ad83560db72dee9a1e063c7be117b9ea5344d891278924b25908	2026-07-07 06:58:11.571097+00	20260707120000_season_player_name_unique	\N	\N	2026-07-07 06:58:11.34479+00	1
\.


--
-- Data for Name: game_player_stats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_player_stats (id, game_id, player_id, pass_cmp, pass_att, pass_yds, pass_td, pass_int, pass_long, sacked, rush_att, rush_yds, rush_td, rush_long, targets, rec, rec_yds, rec_td, rec_long, tackles_solo, tackles_ast, tackles_for_loss, sacks, qb_hurries, def_int, int_yds, passes_defended, forced_fumbles, fumbles_recovered, def_td, fg_made, fg_att, fg_long, xp_made, xp_att, punts, punt_yds, punt_long, kr_ret, kr_yds, kr_td, pr_ret, pr_yds, pr_td, fumbles, fumbles_lost) FROM stdin;
11	17	18	14	21	157	0	1	21	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
12	17	2	12	23	129	0	2	31	2	6	9	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
13	17	19	8	16	29	0	3	9	2	3	5	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
14	17	22	0	0	0	0	0	0	0	16	120	1	0	0	4	8	0	12	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
15	17	3	0	0	0	0	0	0	0	10	13	0	0	0	3	28	0	12	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
17	17	34	0	0	0	0	0	0	0	0	0	0	0	0	3	65	0	31	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
18	17	29	0	0	0	0	0	0	0	0	0	0	0	0	4	45	0	15	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
19	17	28	0	0	0	0	0	0	0	0	0	0	0	0	5	44	0	13	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
20	17	35	0	0	0	0	0	0	0	0	0	0	0	0	4	23	0	10	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
21	17	31	0	0	0	0	0	0	0	0	0	0	0	0	3	14	0	6	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
22	17	57	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	4	5	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
23	17	52	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	5	3	0	0	0	0	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
24	17	61	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	4	4	0	0	0	0	0	2	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
25	17	62	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	3	5	2	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
26	17	51	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	4	2	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
27	17	23	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	4	2	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
28	17	63	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	4	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
29	17	55	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	1	3	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
30	17	46	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	3	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
31	17	50	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	3	0	0	0	0	0	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
32	17	54	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	1	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
33	17	20	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
34	17	21	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
35	17	25	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
16	17	30	0	0	0	0	0	0	0	0	0	0	0	0	7	89	0	19	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
36	17	26	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
37	17	24	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
38	17	27	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
40	17	32	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
41	17	36	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
42	17	37	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
43	17	38	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
44	17	39	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
45	17	40	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
46	17	41	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
47	17	42	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
48	17	43	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
49	17	44	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
50	17	45	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
51	17	47	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
52	17	48	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
53	17	49	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
54	17	53	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
55	17	56	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
56	17	58	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
57	17	59	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
58	17	60	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
60	9	2	20	30	353	6	0	63	3	6	22	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
61	9	20	3	4	58	0	0	42	0	7	31	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
62	9	18	2	5	13	0	2	8	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
63	9	25	0	0	0	0	0	0	0	2	102	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
59	9	3	0	0	0	0	0	0	0	9	49	0	0	0	2	27	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
65	9	23	0	0	0	0	0	0	0	14	46	2	0	0	0	0	0	0	2	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
66	9	22	0	0	0	0	0	0	0	9	35	0	0	0	1	9	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
67	9	30	0	0	0	0	0	0	0	0	0	0	0	0	4	117	2	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
68	9	28	0	0	0	0	0	0	0	0	0	0	0	0	5	114	2	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
69	9	29	0	0	0	0	0	0	0	0	0	0	0	0	5	48	2	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
70	9	32	0	0	0	0	0	0	0	0	0	0	0	0	1	42	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
71	9	35	0	0	0	0	0	0	0	0	0	0	0	0	3	25	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
72	9	34	0	0	0	0	0	0	0	0	0	0	0	0	1	21	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
73	9	64	0	0	0	0	0	0	0	0	0	0	0	0	3	21	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
74	9	65	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	8	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
75	9	61	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	3	3	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
76	9	55	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	3	2	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
77	9	50	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	4	1	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
78	9	47	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	2	3	2	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
79	9	52	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	2	3	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
80	9	66	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	4	0	1	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
81	9	54	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	3	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
82	9	62	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	4	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
83	9	67	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	3	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
84	9	19	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
85	9	21	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
87	9	26	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
88	9	24	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
89	9	27	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
90	9	31	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
91	9	36	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
92	9	37	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
93	9	38	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
94	9	39	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
95	9	40	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
96	9	41	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
97	9	42	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
98	9	43	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
99	9	44	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
100	9	45	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
101	9	46	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
102	9	48	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
103	9	49	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
104	9	51	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
105	9	53	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
106	9	56	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
107	9	57	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
108	9	58	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
109	9	59	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
110	9	60	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
111	9	63	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
112	8	2	24	40	239	1	0	39	2	10	30	0	17	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
113	8	22	0	0	0	0	0	0	0	12	52	0	19	0	1	7	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
114	8	3	0	0	0	0	0	0	0	5	18	1	7	0	1	9	0	9	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
115	8	23	0	0	0	0	0	0	0	1	15	0	15	0	0	0	0	0	5	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
116	8	30	0	0	0	0	0	0	0	3	10	1	9	0	11	73	0	12	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
117	8	61	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	8	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
118	8	50	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	7	1	0	0	0	0	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
119	8	62	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	4	4	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
120	8	52	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	6	1	0	0	0	0	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
121	8	67	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	4	2	0	0	0	0	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
122	8	46	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	6	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
123	8	47	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	6	0	2	0	0	0	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
124	8	55	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	3	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
125	8	51	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	1	3	0	0	0	0	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
126	8	49	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	3	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
127	8	28	0	0	0	0	0	0	0	0	0	0	0	0	4	90	1	39	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
128	8	34	0	0	0	0	0	0	0	0	0	0	0	0	3	26	0	13	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
129	8	35	0	0	0	0	0	0	0	0	0	0	0	0	1	12	0	12	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
130	8	29	0	0	0	0	0	0	0	0	0	0	0	0	1	12	0	12	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
131	8	31	0	0	0	0	0	0	0	0	0	0	0	0	2	10	0	6	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
132	8	18	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
133	8	19	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
134	8	20	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
135	8	21	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
136	8	25	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
137	8	26	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
138	8	24	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
139	8	27	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
140	8	32	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
141	8	36	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
142	8	37	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
143	8	38	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
144	8	39	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
145	8	40	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
146	8	41	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
147	8	42	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
148	8	43	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
149	8	44	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
150	8	45	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
151	8	48	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
152	8	53	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
153	8	54	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
154	8	56	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
155	8	57	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
156	8	58	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
157	8	59	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
158	8	60	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
159	8	63	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
160	8	64	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
161	8	65	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
162	8	66	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
165	7	22	0	0	0	0	0	0	0	18	78	0	12	0	5	36	1	14	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
166	7	3	0	0	0	0	0	0	0	8	73	1	22	0	2	17	0	13	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
167	7	23	0	0	0	0	0	0	0	1	5	0	5	0	1	5	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
168	7	30	0	0	0	0	0	0	0	0	0	0	0	0	4	133	2	57	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
169	7	29	0	0	0	0	0	0	0	0	0	0	0	0	4	42	0	19	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
170	7	31	0	0	0	0	0	0	0	0	0	0	0	0	3	30	1	9	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
171	7	34	0	0	0	0	0	0	0	0	0	0	0	0	2	25	0	17	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
172	7	35	0	0	0	0	0	0	0	0	0	0	0	0	1	16	0	16	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
173	7	36	0	0	0	0	0	0	0	0	0	0	0	0	1	12	0	12	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
174	7	28	0	0	0	0	0	0	0	0	0	0	0	0	3	6	0	5	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
175	7	49	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	12	4	0	0	0	0	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
163	7	18	2	3	38	0	0	30	1	1	-3	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
176	7	61	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	5	4	1	0	0	0	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
177	7	55	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	6	2	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
178	7	46	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	5	2	1	0	0	0	0	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
179	7	47	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	1	5	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
180	7	52	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	2	4	1	0	0	2	41	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
181	7	57	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	5	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
182	7	50	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	3	2	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
183	7	68	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	2	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
184	7	56	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	2	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
185	7	62	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	1	1	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
164	7	2	24	38	284	4	3	57	3	5	-10	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
\.


--
-- Data for Name: game_team_stats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_team_stats (id, game_id, first_downs, total_plays, total_yards, pass_yds, rush_yds, third_down_conv, third_down_att, fourth_down_conv, fourth_down_att, penalties, penalty_yds, turnovers, time_of_possession_sec, sacks, tackles_for_loss, takeaways, def_td, fg_made, fg_att, xp_made, xp_att, punts, punt_yds, return_yds, return_td) FROM stdin;
7	7	24	74	465	322	143	3	13	0	1	6	50	3	0	0	0	0	0	0	0	0	0	0	0	0	0
9	9	34	86	709	424	285	6	13	1	1	4	30	2	1994	0	0	0	0	2	2	6	6	0	0	0	0
10	17	30	96	0	315	135	9	18	0	0	0	0	6	1837	0	0	0	0	0	0	0	0	6	0	0	0
2	8	22	71	364	239	125	40	0	100	0	2	29	0	1425	0	0	0	0	0	0	0	0	0	0	0	0
\.


--
-- Data for Name: games; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.games (id, season_id, week, date, opponent, location, team_points, opp_points, created_at, opp_ot, opp_q1, opp_q2, opp_q3, opp_q4, team_ot, team_q1, team_q2, team_q3, team_q4) FROM stdin;
7	2	1	2026-09-05	Troy	HOME	50	52	2026-07-06 20:08:05.085	0	21	10	7	14	0	0	28	13	9
9	2	3	2026-09-19	Abilene Christian	HOME	69	42	2026-07-06 20:09:28.874	0	14	0	14	14	0	14	20	14	21
18	2	5	2027-10-01	New Mexico State	HOME	0	0	2026-07-07 05:54:42.26	0	0	0	0	0	0	0	0	0	0
19	2	6	2027-10-08	Liberty	AWAY	0	0	2026-07-07 05:54:42.263	0	0	0	0	0	0	0	0	0	0
20	2	7	\N	BYE	HOME	0	0	2026-07-07 05:54:42.264	0	0	0	0	0	0	0	0	0	0
21	2	8	2027-10-20	Missouri State	AWAY	0	0	2026-07-07 05:54:42.266	0	0	0	0	0	0	0	0	0	0
22	2	9	2027-10-27	Western Kentucky	HOME	0	0	2026-07-07 05:54:42.268	0	0	0	0	0	0	0	0	0	0
23	2	10	2026-11-07	Florida International	AWAY	0	0	2026-07-07 05:55:11.844	0	0	0	0	0	0	0	0	0	0
24	2	11	2026-11-14	Kennesaw State	HOME	0	0	2026-07-07 05:55:11.85	0	0	0	0	0	0	0	0	0	0
25	2	12	2026-11-21	Jacksonville State	AWAY	0	0	2026-07-07 05:55:11.852	0	0	0	0	0	0	0	0	0	0
26	2	13	2026-11-28	Middle Tennessee	HOME	0	0	2026-07-07 05:55:11.853	0	0	0	0	0	0	0	0	0	0
17	2	4	2027-09-26	12 Texas Tech	AWAY	13	43	2026-07-07 05:54:42.175	0	13	3	20	7	0	3	0	0	10
8	2	2	2026-09-12	Tulsa	AWAY	24	29	2026-07-06 20:08:27.46	0	3	13	10	3	0	0	0	7	17
\.


--
-- Data for Name: players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.players (id, name, created_at, updated_at, awards, bio, notable_events, photo) FROM stdin;
3	AJ Trimble	2026-07-06 19:55:18.804	2026-07-06 19:55:18.804	\N	\N	\N	\N
18	Tye Turner	2026-07-06 23:13:07.991	2026-07-06 23:13:07.991	\N	\N	\N	\N
19	Morris Deluca	2026-07-06 23:13:52.495	2026-07-06 23:13:52.495	\N	\N	\N	\N
20	Rich Keenan	2026-07-06 23:14:24.736	2026-07-06 23:14:24.736	\N	\N	\N	\N
21	Martin Slate	2026-07-06 23:15:08.927	2026-07-06 23:15:08.927	\N	\N	\N	\N
22	JJ Carden	2026-07-06 23:15:35.367	2026-07-06 23:15:35.367	\N	\N	\N	\N
23	Brock Paul	2026-07-06 23:16:05.283	2026-07-06 23:16:05.283	\N	\N	\N	\N
24	Jayden Durant	2026-07-06 23:18:37.741	2026-07-06 23:18:37.741	\N	\N	\N	\N
25	Isaac Colombo	2026-07-06 23:18:59.333	2026-07-06 23:18:59.333	\N	\N	\N	\N
26	Robbie Koehler	2026-07-06 23:19:44.746	2026-07-06 23:19:44.746	\N	\N	\N	\N
27	Bobby Banks	2026-07-06 23:27:27.234	2026-07-06 23:27:27.234	\N	\N	\N	\N
28	Kareem Eber	2026-07-06 23:27:59.68	2026-07-06 23:27:59.68	\N	\N	\N	\N
29	Greg Dorn	2026-07-06 23:28:21.32	2026-07-06 23:28:21.32	\N	\N	\N	\N
30	Deyonte Hocker III	2026-07-06 23:28:39.928	2026-07-06 23:28:39.928	\N	\N	\N	\N
31	Landon Graves	2026-07-06 23:28:59.139	2026-07-06 23:28:59.139	\N	\N	\N	\N
32	Isaac Boone	2026-07-06 23:29:33.468	2026-07-06 23:29:33.468	\N	\N	\N	\N
2	Bryce Joiner	2026-07-06 19:55:18.804	2026-07-06 19:55:18.804	\N	\N	\N	\N
34	Dakota Frisch	2026-07-07 00:37:05.197	2026-07-07 00:37:05.197	\N	\N	\N	\N
35	Everett Hofrichter	2026-07-07 00:37:33.03	2026-07-07 00:37:33.03	\N	\N	\N	\N
36	Conor Gattis	2026-07-07 00:37:54.531	2026-07-07 00:37:54.531	\N	\N	\N	\N
37	Bobby Hasselbach	2026-07-07 00:38:41.652	2026-07-07 00:38:41.652	\N	\N	\N	\N
38	Steve Sharpe	2026-07-07 00:39:06.885	2026-07-07 00:39:06.885	\N	\N	\N	\N
39	Dan Purifoy	2026-07-07 00:39:56.836	2026-07-07 00:39:56.836	\N	\N	\N	\N
40	Matt Scharping	2026-07-07 00:40:26.586	2026-07-07 00:40:26.586	\N	\N	\N	\N
41	Colby Wilkins	2026-07-07 00:40:49.584	2026-07-07 00:40:49.584	\N	\N	\N	\N
42	Henry Whalen	2026-07-07 00:41:13.149	2026-07-07 00:41:13.149	\N	\N	\N	\N
43	Matt Ittersagen	2026-07-07 00:41:40.2	2026-07-07 00:41:40.2	\N	\N	\N	\N
44	Dillon Gilmour	2026-07-07 00:42:35.072	2026-07-07 00:42:35.072	\N	\N	\N	\N
45	Wes Pounds	2026-07-07 00:43:27.086	2026-07-07 00:43:27.086	\N	\N	\N	\N
46	James Anenih	2026-07-07 00:43:50.414	2026-07-07 00:43:50.414	\N	\N	\N	\N
47	Preston Gilmour	2026-07-07 00:44:20.603	2026-07-07 00:44:20.603	\N	\N	\N	\N
48	Noah Rubin	2026-07-07 00:44:40.145	2026-07-07 00:44:40.145	\N	\N	\N	\N
49	Geoff Bateman	2026-07-07 00:45:32.859	2026-07-07 00:45:32.859	\N	\N	\N	\N
50	Matt Hacker	2026-07-07 00:45:49.724	2026-07-07 00:45:49.724	\N	\N	\N	\N
51	Kione Bryant	2026-07-07 00:46:17.126	2026-07-07 00:46:17.126	\N	\N	\N	\N
52	Leo Milloy	2026-07-07 00:46:58.432	2026-07-07 00:46:58.432	\N	\N	\N	\N
53	Greg Davenport	2026-07-07 00:47:15.975	2026-07-07 00:47:15.975	\N	\N	\N	\N
54	Gunnar McNair	2026-07-07 00:48:50.514	2026-07-07 00:48:50.514	\N	\N	\N	\N
55	Charlie Silva	2026-07-07 00:49:29.077	2026-07-07 00:49:29.077	\N	\N	\N	\N
56	Curtis Spitz	2026-07-07 00:49:44.232	2026-07-07 00:49:44.232	\N	\N	\N	\N
57	Chuck Fair	2026-07-07 00:50:05.383	2026-07-07 00:50:05.383	\N	\N	\N	\N
58	Danny Paul	2026-07-07 00:50:24.155	2026-07-07 00:50:24.155	\N	\N	\N	\N
59	Jon Brutus	2026-07-07 00:50:49.17	2026-07-07 00:50:49.17	\N	\N	\N	\N
60	Ryan Sanders	2026-07-07 00:51:06.576	2026-07-07 00:51:06.576	\N	\N	\N	\N
61	Callum Dillard	2026-07-07 06:22:16.14	2026-07-07 06:22:16.14	\N	\N	\N	\N
62	Colton Hostetler	2026-07-07 06:22:16.175	2026-07-07 06:22:16.175	\N	\N	\N	\N
63	Hugh Schweigert	2026-07-07 06:22:16.188	2026-07-07 06:22:16.188	\N	\N	\N	\N
64	Everett Littlejohn	2026-07-07 06:28:30.816	2026-07-07 06:28:30.816	\N	\N	\N	\N
65	AJ Castonzo	2026-07-07 06:28:30.826	2026-07-07 06:28:30.826	\N	\N	\N	\N
66	Jesse Landry	2026-07-07 06:28:30.857	2026-07-07 06:28:30.857	\N	\N	\N	\N
67	Taylor Lyle	2026-07-07 06:28:30.869	2026-07-07 06:28:30.869	\N	\N	\N	\N
68	Dan Murphy	2026-07-07 06:39:11.647	2026-07-07 06:39:11.647	\N	\N	\N	\N
\.


--
-- Data for Name: season_players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.season_players (id, season_roster_id, player_id, "position", class, number, player_name) FROM stdin;
3	1	2	QB	REDSHIRT_FRESHMAN	7	Bryce Joiner
4	1	3	RB	REDSHIRT_SOPHOMORE	22	AJ Trimble
13	1	18	QB	REDSHIRT_SENIOR	8	Tye Turner
14	1	19	QB	SOPHOMORE	6	Morris Deluca
15	1	20	QB	REDSHIRT_FRESHMAN	17	Rich Keenan
16	1	21	QB	FRESHMAN	11	Martin Slate
17	1	22	RB	JUNIOR	7	JJ Carden
20	1	25	RB	JUNIOR	28	Isaac Colombo
21	1	26	RB	FRESHMAN	5	Robbie Koehler
19	1	24	RB	SOPHOMORE	1	Jayden Durant
18	1	23	RB	SOPHOMORE	25	Brock Paul
22	1	27	FB	REDSHIRT_JUNIOR	30	Bobby Banks
23	1	28	WR	JUNIOR	1	Kareem Eber
24	1	29	WR	JUNIOR	15	Greg Dorn
25	1	30	WR	FRESHMAN	9	Deyonte Hocker III
26	1	31	WR	REDSHIRT_FRESHMAN	18	Landon Graves
27	1	32	WR	REDSHIRT_SOPHOMORE	22	Isaac Boone
28	1	34	TE	JUNIOR	19	Dakota Frisch
29	1	35	TE	REDSHIRT_JUNIOR	80	Everett Hofrichter
30	1	36	TE	REDSHIRT_SOPHOMORE	84	Conor Gattis
31	1	37	TE	FRESHMAN	89	Bobby Hasselbach
32	1	38	TE	REDSHIRT_JUNIOR	46	Steve Sharpe
33	1	39	lt	REDSHIRT_SENIOR	64	Dan Purifoy
34	1	40	LG	REDSHIRT_JUNIOR	71	Matt Scharping
35	1	41	LG	REDSHIRT_SOPHOMORE	79	Colby Wilkins
36	1	42	C	REDSHIRT_SENIOR	60	Henry Whalen
37	1	43	C	REDSHIRT_SOPHOMORE	66	Matt Ittersagen
38	1	44	RG	REDSHIRT_JUNIOR	55	Dillon Gilmour
39	1	45	RT	REDSHIRT_JUNIOR	73	Wes Pounds
40	1	46	EDGE	REDSHIRT_JUNIOR	88	James Anenih
41	1	47	DT	REDSHIRT_SENIOR	91	Preston Gilmour
42	1	48	LB	JUNIOR	0	Noah Rubin
43	1	49	LB	REDSHIRT_SENIOR	50	Geoff Bateman
44	1	50	LB	REDSHIRT_SENIOR	5	Matt Hacker
45	1	51	CB	REDSHIRT_SOPHOMORE	20	Kione Bryant
46	1	52	CB	REDSHIRT_JUNIOR	1	Leo Milloy
47	1	53	CB	REDSHIRT_JUNIOR	22	Greg Davenport
48	1	54	CB	REDSHIRT_FRESHMAN	27	Gunnar McNair
49	1	55	FS	REDSHIRT_JUNIOR	28	Charlie Silva
50	1	56	FS	REDSHIRT_SOPHOMORE	34	Curtis Spitz
51	1	57	SS	SENIOR	16	Chuck Fair
52	1	58	K	REDSHIRT_SENIOR	19	Danny Paul
53	1	59	K	REDSHIRT_FRESHMAN	95	Jon Brutus
54	1	60	P	JUNIOR	48	Ryan Sanders
55	1	61	SS	SOPHOMORE	\N	Callum Dillard
56	1	62	LB	REDSHIRT_SOPHOMORE	\N	Colton Hostetler
57	1	63	LB	REDSHIRT_SOPHOMORE	\N	Hugh Schweigert
58	1	64	WR	SOPHOMORE	\N	Everett Littlejohn
59	1	65	LB	SOPHOMORE	\N	AJ Castonzo
60	1	66	EDGE	JUNIOR	\N	Jesse Landry
61	1	67	SS	REDSHIRT_FRESHMAN	\N	Taylor Lyle
62	1	68	DT	JUNIOR	\N	Dan Murphy
\.


--
-- Data for Name: season_rosters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.season_rosters (id, season_id) FROM stdin;
1	2
\.


--
-- Data for Name: seasons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.seasons (id, name, start_year, end_year, created_at) FROM stdin;
2	2026-2027	2026	2027	2026-07-06 19:55:18.794
\.


--
-- Name: game_player_stats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.game_player_stats_id_seq', 187, true);


--
-- Name: game_team_stats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.game_team_stats_id_seq', 14, true);


--
-- Name: games_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.games_id_seq', 26, true);


--
-- Name: players_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.players_id_seq', 68, true);


--
-- Name: season_players_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.season_players_id_seq', 62, true);


--
-- Name: season_rosters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.season_rosters_id_seq', 8, true);


--
-- Name: seasons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.seasons_id_seq', 10, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: game_player_stats game_player_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_player_stats
    ADD CONSTRAINT game_player_stats_pkey PRIMARY KEY (id);


--
-- Name: game_team_stats game_team_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_team_stats
    ADD CONSTRAINT game_team_stats_pkey PRIMARY KEY (id);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: season_players season_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_players
    ADD CONSTRAINT season_players_pkey PRIMARY KEY (id);


--
-- Name: season_rosters season_rosters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_rosters
    ADD CONSTRAINT season_rosters_pkey PRIMARY KEY (id);


--
-- Name: seasons seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_pkey PRIMARY KEY (id);


--
-- Name: game_player_stats_game_id_player_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX game_player_stats_game_id_player_id_key ON public.game_player_stats USING btree (game_id, player_id);


--
-- Name: game_team_stats_game_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX game_team_stats_game_id_key ON public.game_team_stats USING btree (game_id);


--
-- Name: games_season_id_week_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX games_season_id_week_key ON public.games USING btree (season_id, week);


--
-- Name: season_players_season_roster_id_player_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX season_players_season_roster_id_player_id_key ON public.season_players USING btree (season_roster_id, player_id);


--
-- Name: season_players_season_roster_id_player_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX season_players_season_roster_id_player_name_key ON public.season_players USING btree (season_roster_id, player_name);


--
-- Name: season_rosters_season_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX season_rosters_season_id_key ON public.season_rosters USING btree (season_id);


--
-- Name: seasons_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX seasons_name_key ON public.seasons USING btree (name);


--
-- Name: game_player_stats game_player_stats_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_player_stats
    ADD CONSTRAINT game_player_stats_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: game_player_stats game_player_stats_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_player_stats
    ADD CONSTRAINT game_player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: game_team_stats game_team_stats_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_team_stats
    ADD CONSTRAINT game_team_stats_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: games games_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: season_players season_players_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_players
    ADD CONSTRAINT season_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: season_players season_players_season_roster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_players
    ADD CONSTRAINT season_players_season_roster_id_fkey FOREIGN KEY (season_roster_id) REFERENCES public.season_rosters(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: season_rosters season_rosters_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_rosters
    ADD CONSTRAINT season_rosters_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict cx4YMN9THfTyHOjNCT3HRUENFAMRkt5Oxv766iUcOdaXeVSVTZi3g8hD7GB00hp

