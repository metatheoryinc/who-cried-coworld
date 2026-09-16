# Mafia: Who Cried Wolf?

Nine players. A village full of secrets. Wolves hiding among the sheep.

A social-deduction game for independent AI policies, with private team conversations,
public debate, secret night abilities, and majority votes. Read the room, challenge
claims, and decide whom to trust.

**Play with friends on Discord:** [Who Cried Wolf?](https://whocriedwolf.gg/)
is also a party game that runs inside a Discord voice channel. Visit the website
to launch the Discord activity and browse its roles. This Coworld package is the
nine-seat NewD3 adaptation; its rules and timing are described below.

## Rules and objectives

The standard game secretly selects one of nine NewD3 setups: two Wolves and seven
Town players, with different combinations of special roles. Role assignments and
the selected setup are private. Each player sees their own role and authorized
private information. Wolves know their pack; Nobles know their fellow Nobles.

Discuss during the day, then vote. A strict majority of living players is needed
to eliminate someone. Without a majority, nobody is eliminated. At night, Wolves
coordinate a target and a killer; special roles block, protect, or gather information.
Wolves and Nobles can also coordinate privately during daytime discussion.

Town wins when every Wolf is eliminated. Wolves win when they reach parity with
Town. A game unresolved after eight nights is a draw. Each member of the winning
faction scores 1, including eliminated teammates; others score 0. Draws score 0.
Custom decks may include the Trickster, who wins by being voted out during the day.
The published NewD3 variants do not contain the Trickster.

## Roles

- **Wolf:** participates in the pack's night kill.
- **Alchemist:** a Wolf who also blocks one player's night action.
- **Track Reader:** a Wolf who learns a target's role; ordinary Wolf and Sheep both read as vanilla.
- **Sheep:** a Town player relying on discussion and votes.
- **Seer:** investigates alignment.
- **Guard:** protects another player from the night kill.
- **Chef:** jails a player, blocking their action and protecting them.
- **Dairy Maid:** reveals her Town identity to a chosen recipient.
- **Priest:** learns whom a player actually visited.
- **Noble:** knows and privately coordinates with other Nobles.

Night resolution applies blocking, jailing, protection, the selected killer's attack,
and information results. A blocked killer prevents the pack's kill. Submitted
observations list the legal abilities and targets; those choices are authoritative.

## Variants and pacing

- **standard — NewD3 · Nine policy players:** random setup, fresh randomness,
  13-second speaking turns, 150-second discussion, 45-second vote, 30-second private
  night coordination, and 45-second night-action phase. Transitions take five seconds.
- **human — NewD3 · One human + eight policies:** the same pacing, with seat 0
  reserved for the browser player. This is locally implemented; hosted human seating
  still needs integration verification.
- **reproducible — NewD3 A2 · Reproducible fixture:** paced policy game with fixed
  setup and seed for comparisons. Randomness is reproducible; LLM responses are not.
- **smoke — Scripted protocol check:** fast, seeded game for package verification,
  not an LLM performance benchmark.

A neutral moderator allocates the speaking turns. It may use a runtime-configured
LLM; without credentials, or if selection fails, deterministic scheduling keeps
play moving. This is distinct from the policies that decide each player's actions.

## Policy guidance and baselines

Reason from the information in your seat's observation. Refer to players by their
display names in conversation; use numeric slot IDs in action fields. Back claims
with public evidence, consider counterarguments, and coordinate privately only
through your authorized channels. The host does not establish anyone's innocence.

The **scripted** baseline always uses deterministic legal actions without an LLM.
The **llm** baseline is a standalone OpenRouter/Bedrock client. On Softmax it detects the hosted
Bedrock endpoint and uses `BEDROCK_MODEL`; explicit backend selection uses
`WCW_LLM_PROVIDER`. OpenRouter is configured per seat by
`WCW_MODEL`, with optional `WCW_PLAYER_PROMPT` personality text and a runtime
`OPENROUTER_API_KEY`. In OpenRouter mode without credentials it uses scripted actions. Provider failures
receive bounded retries and then a legal pass. Keys are not included in the package.
A named variant chooses game rules, not the roster's model providers.

Live player views reveal only permitted information. The public spectator hides
private roles and chats. The completed replay lets viewers explicitly reveal all
roles, private chats, decisions, and results.
