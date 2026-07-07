College Football 27 uses FBCHUNK files to represent our dynasty save. Even a cloud dynasty stores it's files locally on our machine. Ergo that data is accessible an extratable to the team tools schema format!

The directory in which the save files are stored is `C:\Users\William.Local\Documents\EA SPORTS College Football 27\saves` In this directory, there are several FBCHUNK files and I've had Claude do a brief decode:

11,720 players across the whole league, each with a unique ID. Everything you want is extractable. Here's the full picture and the plan.
What each file holds (now confirmed):
PROFILE-COLLEGE (88 KB) is the dynasty state file. Its header cleanly decodes your save timestamp (2026-07-06 19:52:43), and it carries the league_week calendar and per-team dynasty arrays. This is where current date/week, standings, and schedule live.
ROSTER-Official (12.5 MB) is the live league roster — all 11,720 players on every team, each with a unique ID, asset name, real name, hometown, and full ratings. Your Caddo State team's players are in this pool (I found Trimble, Eber, Durant, etc.), keyed by player ID.
The encoding — and the honest tradeoff. These live files use a different, denser format than your TeamBuilder file. Instead of readable PLYR_SPEED\x00<len><value>, each field is a compact C2 <2-byte field-ID> <flag> <varint value> record. The names come out as plaintext, but every rating is behind a numeric field ID that has to be mapped (field-ID 0x1918 = speed, etc.). That mapping is the work. It's very doable — I decoded the record boundaries already — but it's a multi-step reverse-engineering effort, not the one-shot the TeamBuilder file was.
This is exactly the Frostbite franchise DB format, which matters a lot. The community tool madden-franchise (the bep713 Node library) and its CFB forks already decode this precise structure — the tagged tables, the field-ID schemas, the compression. Rather than me re-deriving all 100+ field-ID mappings from scratch and asking you to verify each against your dynasty, the far faster path to reliable data — especially season/game stats — is to build on those existing schema definitions.
My recommended plan, in order:

Current date/week — I can get this from PROFILE-COLLEGE now; the timestamp already decodes and the week counter is close.
Your team's roster with ratings — extract your Caddo State player IDs, pull their full records from ROSTER-Official, map the field IDs. This is the biggest chunk of real work but I've cracked the record layout.
Season/game stats — these weren't in these two files as obvious tables. In CFB dynasty, per-game and season stats often live in additional save files (a stats or "week" file) that the game writes as the season progresses. Since your dynasty may be early (week 1-4 based on the league_week values), there may be little stat history yet.

Since we don't want to test extraction or extract changes I've included a test-save directory that contains real save files I've copied and pasted to help us extract data from them. 

This is exactly the Frostbite franchise DB format, which matters a lot. The community tool madden-franchise (the bep713 Node library) and its CFB forks already decode this precise structure — the tagged tables, the field-ID schemas, the compression. Rather than me re-deriving all 100+ field-ID mappings from scratch and asking you to verify each against your dynasty, the far faster path to reliable data — especially season/game stats — is to build on those existing schema definitions.
My recommended plan, in order:

Current date/week — I can get this from PROFILE-COLLEGE now; the timestamp already decodes and the week counter is close.
Your team's roster with ratings — extract your Caddo State player IDs, pull their full records from ROSTER-Official, map the field IDs. This is the biggest chunk of real work but I've cracked the record layout.
Season/game stats — these weren't in these two files as obvious tables. In CFB dynasty, per-game and season stats often live in additional save files (a stats or "week" file) that the game writes as the season progresses. Since your dynasty may be early (week 1-4 based on the league_week values), there may be little stat history yet.