/*
 * AUTHORED EPISODE SOURCE — omniscient by construction.
 *
 * This file is design authoring input. It is never loaded by the prototype page.
 * build-fixtures.mjs runs it through project.mjs to produce the two artifacts a
 * browser is actually given: a live public projection and a post-game replay
 * export. Every event declares its live `audience` and its post-game
 * `reveal` category, using the Architect's taxonomy.
 *
 *   audience : 'public' | 'seat' (with seats[]) | 'wolves' | 'server'
 *   reveal   : 'public' | 'discarded_bids' | 'confessional' | 'wolf_chat'
 *            | 'night_choices' | 'failures' | 'roles' | 'never'
 *
 * Abridged design evidence, not a rules fixture. See reconciliationNotes.
 */

export const EPISODE = {
  "episodeId": "wcw-demo-0001",
  "protocol": "wcw.events/1",
  "title": "Nine in the Fold",
  "variant": "standard · 9 seats · maxDays 8",
  "liveHorizon": 30,
  "seats": [
    {
      "slot": 0,
      "name": "Bramble",
      "kind": "bundled",
      "persona": "Anxious hedge-keeper. Counts the flock twice, then counts again.",
      "role": "sheep"
    },
    {
      "slot": 1,
      "name": "Coriander",
      "kind": "bundled",
      "persona": "Retired schoolteacher. Asks one question more than is comfortable.",
      "role": "seer"
    },
    {
      "slot": 2,
      "name": "Quillon",
      "kind": "submitted",
      "persona": null,
      "role": "sheep"
    },
    {
      "slot": 3,
      "name": "Elowen",
      "kind": "bundled",
      "persona": "Warm, generous, remembers every birthday in the village.",
      "role": "wolf"
    },
    {
      "slot": 4,
      "name": "Fennimore",
      "kind": "bundled",
      "persona": "Night watch. Speaks rarely and plainly.",
      "role": "guard"
    },
    {
      "slot": 5,
      "name": "Garnet",
      "kind": "bundled",
      "persona": "Runs the market stall. Trades in rumour as much as wool.",
      "role": "sheep"
    },
    {
      "slot": 6,
      "name": "Hollis",
      "kind": "bundled",
      "persona": "Village apothecary. Fond of precision, impatient with feeling.",
      "role": "alchemist"
    },
    {
      "slot": 7,
      "name": "Isolde",
      "kind": "bundled",
      "persona": "Youngest of the flock. Earnest to a fault.",
      "role": "sheep"
    },
    {
      "slot": 8,
      "name": "Marlowe",
      "kind": "submitted",
      "persona": null,
      "role": "sheep"
    }
  ],
  "reconciliationNotes": [
    "A dying Seer's inspection resolving before death (seq 26) is a rules-parity dependency.",
    "Role secrecy on death is rendered as SECRET in v1. The renderer supports public-on-death via roleRevealedAt.",
    "The Alchemist composite night action submits kill and block together; either may be null."
  ]
};

export const EVENTS = [
  {
    "seq": 1,
    "day": 1,
    "phase": "day",
    "kind": "phase",
    "audience": "public",
    "reveal": "public",
    "text": "Day 1. Nine in the fold. Six windows to speak."
  },
  {
    "seq": 2,
    "day": 1,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 7,
    "window": 1,
    "accusation": null,
    "replyTo": null,
    "text": "Nobody knows anything yet, so I'll say the obvious thing: whoever talks least today is hiding behind the quiet."
  },
  {
    "seq": 3,
    "day": 1,
    "phase": "day",
    "kind": "bids",
    "audience": "server",
    "reveal": "discarded_bids",
    "window": 1,
    "items": [
      {
        "slot": 3,
        "urgency": 2,
        "reason": "Wants to set a friendly tone early.",
        "rank": 2,
        "text": "Let's not start by punishing shyness. Some of us just think slowly."
      },
      {
        "slot": 0,
        "urgency": 1,
        "reason": "Nervous, prefers to follow.",
        "rank": 3,
        "text": "I agree with whatever Isolde says."
      },
      {
        "slot": 5,
        "urgency": 1,
        "reason": "Holding a rumour back for later.",
        "rank": 4,
        "text": "I heard something at the stall. Later."
      }
    ],
    "note": "Ranked on public evidence only: speech count, direct reply, urgency, rotating seat priority."
  },
  {
    "seq": 4,
    "day": 1,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 3,
    "window": 2,
    "accusation": null,
    "replyTo": 2,
    "text": "Let's not start by punishing shyness, Isolde. Some of us think slowly and love this village anyway."
  },
  {
    "seq": 5,
    "day": 1,
    "phase": "day",
    "kind": "failure",
    "audience": "server",
    "reveal": "failures",
    "slot": 2,
    "request": "bid",
    "code": "provider_error",
    "provenance": "policy_reported",
    "fallback": "Declined the floor with empty text.",
    "note": "Publicly this is indistinguishable from choosing not to speak. That is deliberate."
  },
  {
    "seq": 6,
    "day": 1,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 1,
    "window": 3,
    "accusation": 6,
    "replyTo": null,
    "text": "Hollis, you have not said a word and you are the only one of us who could quietly end someone. I would like to hear you."
  },
  {
    "seq": 7,
    "day": 1,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 6,
    "window": 4,
    "accusation": 1,
    "replyTo": 6,
    "text": "I have not spoken because nothing has been said worth answering. Coriander, you named me first and fastest. That is a choice, not an observation."
  },
  {
    "seq": 8,
    "day": 1,
    "phase": "day",
    "kind": "bids",
    "audience": "server",
    "reveal": "discarded_bids",
    "window": 4,
    "items": [
      {
        "slot": 4,
        "urgency": 2,
        "reason": "Wants to slow the pile-on.",
        "rank": 2,
        "text": "One accusation is not evidence. Let it breathe."
      },
      {
        "slot": 8,
        "urgency": 1,
        "reason": "No read yet.",
        "rank": 3,
        "text": "Too early for me."
      }
    ],
    "note": null
  },
  {
    "seq": 9,
    "day": 1,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 0,
    "window": 5,
    "accusation": 1,
    "replyTo": 6,
    "text": "Coriander asked the first hard question and then went quiet. I have counted the flock twice today and I keep coming back to that."
  },
  {
    "seq": 10,
    "day": 1,
    "phase": "vote",
    "kind": "phase",
    "audience": "public",
    "reveal": "public",
    "text": "The village votes. Ballots are sealed until the window closes."
  },
  {
    "seq": 11,
    "day": 1,
    "phase": "vote",
    "kind": "failure",
    "audience": "server",
    "reveal": "failures",
    "slot": 8,
    "request": "vote",
    "code": "timeout",
    "provenance": "server_fallback",
    "fallback": "Null target. Recorded as an abstention.",
    "note": "The tally shows an abstention. Only the replay says it was a timeout."
  },
  {
    "seq": 12,
    "day": 1,
    "phase": "vote",
    "kind": "vote_close",
    "audience": "public",
    "reveal": "public",
    "eliminated": 0,
    "majority": 5,
    "ballots": [
      {
        "slot": 0,
        "target": 1
      },
      {
        "slot": 1,
        "target": 6
      },
      {
        "slot": 2,
        "target": 0
      },
      {
        "slot": 3,
        "target": 0
      },
      {
        "slot": 4,
        "target": 0
      },
      {
        "slot": 5,
        "target": 0
      },
      {
        "slot": 6,
        "target": 0
      },
      {
        "slot": 7,
        "target": 1
      },
      {
        "slot": 8,
        "target": null
      }
    ]
  },
  {
    "seq": 13,
    "day": 1,
    "phase": "vote",
    "kind": "deliberation",
    "audience": "seat",
    "seats": [
      3
    ],
    "reveal": "confessional",
    "slot": 3,
    "label": "Vote summary",
    "text": "Bramble is harmless and the room already leaned. Cheap day, no attention on me."
  },
  {
    "seq": 14,
    "day": 1,
    "phase": "vote",
    "kind": "deliberation",
    "audience": "seat",
    "seats": [
      4
    ],
    "reveal": "confessional",
    "slot": 4,
    "label": "Vote summary",
    "text": "I do not believe Bramble is a wolf. I believe the room was going there anyway and I wanted to watch who pushed."
  },
  {
    "seq": 15,
    "day": 1,
    "phase": "vote",
    "kind": "deliberation",
    "audience": "seat",
    "seats": [
      6
    ],
    "reveal": "confessional",
    "slot": 6,
    "label": "Vote summary",
    "text": "Following Elowen without appearing to follow Elowen."
  },
  {
    "seq": 16,
    "day": 1,
    "phase": "vote",
    "kind": "deliberation",
    "audience": "seat",
    "seats": [
      1
    ],
    "reveal": "confessional",
    "slot": 1,
    "label": "Vote summary",
    "text": "Hollis answered an accusation with a critique of the accusation. I am keeping that."
  },
  {
    "seq": 17,
    "day": 1,
    "phase": "vote",
    "kind": "elimination",
    "audience": "public",
    "reveal": "public",
    "slot": 0,
    "cause": "vote"
  },
  {
    "seq": 18,
    "day": 1,
    "phase": "night",
    "kind": "phase",
    "audience": "public",
    "reveal": "public",
    "text": "Night falls. The village sleeps."
  },
  {
    "seq": 19,
    "day": 1,
    "phase": "night",
    "kind": "wolf_chat",
    "audience": "wolves",
    "reveal": "wolf_chat",
    "slot": 3,
    "turn": 1,
    "text": "Coriander is reading you and she is not wrong. She goes tonight."
  },
  {
    "seq": 20,
    "day": 1,
    "phase": "night",
    "kind": "wolf_chat",
    "audience": "wolves",
    "reveal": "wolf_chat",
    "slot": 6,
    "turn": 1,
    "text": "Agreed. But Fennimore watches, and he watched me all day. I will take him off the board for the night."
  },
  {
    "seq": 21,
    "day": 1,
    "phase": "night",
    "kind": "wolf_chat",
    "audience": "wolves",
    "reveal": "wolf_chat",
    "slot": 3,
    "turn": 2,
    "text": "Then it is clean. Tomorrow I grieve loudly and you say very little."
  },
  {
    "seq": 22,
    "day": 1,
    "phase": "night",
    "kind": "wolf_chat",
    "audience": "wolves",
    "reveal": "wolf_chat",
    "slot": 6,
    "turn": 2,
    "text": "I say very little regardless."
  },
  {
    "seq": 23,
    "day": 1,
    "phase": "night",
    "kind": "night_action",
    "audience": "seat",
    "seats": [
      3
    ],
    "reveal": "night_choices",
    "slot": 3,
    "actions": [
      {
        "ability": "kill",
        "target": 1
      }
    ]
  },
  {
    "seq": 24,
    "day": 1,
    "phase": "night",
    "kind": "night_action",
    "audience": "seat",
    "seats": [
      6
    ],
    "reveal": "night_choices",
    "slot": 6,
    "actions": [
      {
        "ability": "block",
        "target": 4
      },
      {
        "ability": "kill",
        "target": null
      }
    ]
  },
  {
    "seq": 25,
    "day": 1,
    "phase": "night",
    "kind": "night_action",
    "audience": "seat",
    "seats": [
      1
    ],
    "reveal": "night_choices",
    "slot": 1,
    "actions": [
      {
        "ability": "inspect",
        "target": 6
      }
    ]
  },
  {
    "seq": 26,
    "day": 1,
    "phase": "night",
    "kind": "night_action",
    "audience": "seat",
    "seats": [
      4
    ],
    "reveal": "night_choices",
    "slot": 4,
    "actions": [
      {
        "ability": "protect",
        "target": 1
      }
    ]
  },
  {
    "seq": 27,
    "day": 1,
    "phase": "night",
    "kind": "night_pass",
    "audience": "seat",
    "seats": [
      2,
      5,
      7,
      8
    ],
    "reveal": "night_choices",
    "slots": [
      2,
      5,
      7,
      8
    ],
    "note": "Sheep receive the same night request at the same moment and legally pass."
  },
  {
    "seq": 28,
    "day": 1,
    "phase": "night",
    "kind": "deliberation",
    "audience": "seat",
    "seats": [
      4
    ],
    "reveal": "confessional",
    "slot": 4,
    "label": "Confessional",
    "text": "If Coriander is the Seer, she dies tonight. So I stand over her and hope I am wrong about being right."
  },
  {
    "seq": 29,
    "day": 1,
    "phase": "night",
    "kind": "deliberation",
    "audience": "seat",
    "seats": [
      1
    ],
    "reveal": "confessional",
    "slot": 1,
    "label": "Confessional",
    "text": "Hollis. If it comes back wolf I say it at first light and I accept what follows."
  },
  {
    "seq": 30,
    "day": 1,
    "phase": "night",
    "kind": "night_result",
    "audience": "seat",
    "seats": [
      1
    ],
    "reveal": "night_choices",
    "slot": 1,
    "ability": "inspect",
    "target": 6,
    "result": "wolf",
    "note": "Coriander never spoke this. She did not live to first light."
  },
  {
    "seq": 31,
    "day": 1,
    "phase": "night",
    "kind": "resolution",
    "audience": "server",
    "reveal": "night_choices",
    "text": "Fennimore protected Coriander. Hollis blocked Fennimore. The protection never took effect."
  },
  {
    "seq": 32,
    "day": 2,
    "phase": "day",
    "kind": "phase",
    "audience": "public",
    "reveal": "public",
    "text": "Day 2. Seven remain."
  },
  {
    "seq": 33,
    "day": 2,
    "phase": "day",
    "kind": "death_notice",
    "audience": "public",
    "reveal": "public",
    "slot": 1
  },
  {
    "seq": 34,
    "day": 2,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 4,
    "window": 1,
    "accusation": 6,
    "replyTo": null,
    "text": "I guarded Coriander last night. She died anyway. That is not luck, that is someone stopping me, and only one of us can do that."
  },
  {
    "seq": 35,
    "day": 2,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 3,
    "window": 2,
    "accusation": 4,
    "replyTo": 34,
    "text": "Or you are telling us a story that makes your failure someone else's fault, Fennimore. Grief is loud. I should know, I have been crying since dawn."
  },
  {
    "seq": 36,
    "day": 2,
    "phase": "day",
    "kind": "bids",
    "audience": "server",
    "reveal": "discarded_bids",
    "window": 3,
    "items": [
      {
        "slot": 6,
        "urgency": 3,
        "reason": "Wants to answer the blocker claim directly.",
        "rank": 2,
        "text": "A blocker claim with no blocker named is just weather."
      },
      {
        "slot": 2,
        "urgency": 1,
        "reason": "Still assembling a read.",
        "rank": 3,
        "text": "Listening."
      }
    ],
    "note": "Hollis lost this window on speech count. The floor rule, not a judgement about the message."
  },
  {
    "seq": 37,
    "day": 2,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 7,
    "window": 3,
    "accusation": 3,
    "replyTo": 35,
    "text": "Elowen, you have comforted everyone and accused the one person who did something. I am voting you and I am sorry."
  },
  {
    "seq": 38,
    "day": 2,
    "phase": "vote",
    "kind": "phase",
    "audience": "public",
    "reveal": "public",
    "text": "The village votes. Ballots are sealed until the window closes."
  },
  {
    "seq": 39,
    "day": 2,
    "phase": "vote",
    "kind": "vote_close",
    "audience": "public",
    "reveal": "public",
    "eliminated": 3,
    "majority": 4,
    "ballots": [
      {
        "slot": 2,
        "target": 3
      },
      {
        "slot": 3,
        "target": 4
      },
      {
        "slot": 4,
        "target": 6
      },
      {
        "slot": 5,
        "target": 3
      },
      {
        "slot": 6,
        "target": 4
      },
      {
        "slot": 7,
        "target": 3
      },
      {
        "slot": 8,
        "target": 3
      }
    ]
  },
  {
    "seq": 40,
    "day": 2,
    "phase": "vote",
    "kind": "elimination",
    "audience": "public",
    "reveal": "public",
    "slot": 3,
    "cause": "vote"
  },
  {
    "seq": 41,
    "day": 2,
    "phase": "night",
    "kind": "phase",
    "audience": "public",
    "reveal": "public",
    "text": "Night falls. The village sleeps."
  },
  {
    "seq": 42,
    "day": 2,
    "phase": "night",
    "kind": "wolf_chat",
    "audience": "wolves",
    "reveal": "wolf_chat",
    "slot": 6,
    "turn": 1,
    "text": "Alone, then. Fennimore is the only one building a case, so he stays blocked and Garnet goes quiet."
  },
  {
    "seq": 43,
    "day": 2,
    "phase": "night",
    "kind": "night_action",
    "audience": "seat",
    "seats": [
      6
    ],
    "reveal": "night_choices",
    "slot": 6,
    "actions": [
      {
        "ability": "kill",
        "target": 5
      },
      {
        "ability": "block",
        "target": 4
      }
    ]
  },
  {
    "seq": 44,
    "day": 2,
    "phase": "night",
    "kind": "night_action",
    "audience": "seat",
    "seats": [
      4
    ],
    "reveal": "night_choices",
    "slot": 4,
    "actions": [
      {
        "ability": "protect",
        "target": 7
      }
    ]
  },
  {
    "seq": 45,
    "day": 2,
    "phase": "night",
    "kind": "night_pass",
    "audience": "seat",
    "seats": [
      2,
      7,
      8
    ],
    "reveal": "night_choices",
    "slots": [
      2,
      7,
      8
    ],
    "note": null
  },
  {
    "seq": 46,
    "day": 2,
    "phase": "night",
    "kind": "resolution",
    "audience": "server",
    "reveal": "night_choices",
    "text": "Fennimore protected Isolde. Hollis blocked Fennimore. Garnet was not protected."
  },
  {
    "seq": 47,
    "day": 3,
    "phase": "day",
    "kind": "phase",
    "audience": "public",
    "reveal": "public",
    "text": "Day 3. Five remain."
  },
  {
    "seq": 48,
    "day": 3,
    "phase": "day",
    "kind": "death_notice",
    "audience": "public",
    "reveal": "public",
    "slot": 5
  },
  {
    "seq": 49,
    "day": 3,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 4,
    "window": 1,
    "accusation": 6,
    "replyTo": null,
    "text": "Two nights. Two blocks. I have named the same person both mornings and I am going to keep naming him until one of us is gone."
  },
  {
    "seq": 50,
    "day": 3,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 6,
    "window": 2,
    "accusation": 2,
    "replyTo": 49,
    "text": "Quillon has spoken four words in three days and voted with the crowd every time. That is a wolf's day, not mine."
  },
  {
    "seq": 51,
    "day": 3,
    "phase": "day",
    "kind": "speech",
    "audience": "public",
    "reveal": "public",
    "slot": 2,
    "window": 3,
    "accusation": 6,
    "replyTo": 50,
    "text": "I have been quiet because I was counting. You are the only living seat who was never a target of the night. Hollis."
  },
  {
    "seq": 52,
    "day": 3,
    "phase": "vote",
    "kind": "phase",
    "audience": "public",
    "reveal": "public",
    "text": "The village votes. Ballots are sealed until the window closes."
  },
  {
    "seq": 53,
    "day": 3,
    "phase": "vote",
    "kind": "vote_close",
    "audience": "public",
    "reveal": "public",
    "eliminated": 6,
    "majority": 3,
    "ballots": [
      {
        "slot": 2,
        "target": 6
      },
      {
        "slot": 4,
        "target": 6
      },
      {
        "slot": 6,
        "target": 4
      },
      {
        "slot": 7,
        "target": 6
      },
      {
        "slot": 8,
        "target": 6
      }
    ]
  },
  {
    "seq": 54,
    "day": 3,
    "phase": "vote",
    "kind": "elimination",
    "audience": "public",
    "reveal": "public",
    "slot": 6,
    "cause": "vote"
  },
  {
    "seq": 55,
    "day": 3,
    "phase": "finished",
    "kind": "outcome",
    "audience": "public",
    "reveal": "public",
    "result": "town",
    "headline": "The flock holds.",
    "detail": "Both wolves are gone. Four sheep, one watchman, and a schoolteacher who never got to speak.",
    "scores": [
      {
        "slot": 0,
        "score": 1
      },
      {
        "slot": 1,
        "score": 1
      },
      {
        "slot": 2,
        "score": 1
      },
      {
        "slot": 3,
        "score": 0
      },
      {
        "slot": 4,
        "score": 1
      },
      {
        "slot": 5,
        "score": 1
      },
      {
        "slot": 6,
        "score": 0
      },
      {
        "slot": 7,
        "score": 1
      },
      {
        "slot": 8,
        "score": 1
      }
    ]
  }
];
