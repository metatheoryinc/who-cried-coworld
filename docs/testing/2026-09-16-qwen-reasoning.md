# Qwen reasoning latency diagnostic

Six paid calls to `qwen/qwen3.8-max`, using the benchmark persona prompt, typed action schema, 1,200-token output cap, and the launcher's throughput routing. No game was launched or restarted. Each diagnostic allowed up to 30 seconds so responses could be measured beyond the actual 12.9-second adapter deadline.

| Effort | Conversation | Action | Seconds | Valid action | Fits 12.9s |
| --- | --- | --- | --- | --- | --- |
| minimal | 1 speech | bid | 6.539 | yes | yes |
| minimal | 1 speech | wolf chat | 8.462 | yes | yes |
| low | 1 speech | bid | 8.166 | yes | yes |
| low | 1 speech | wolf chat | 6.805 | yes | yes |
| minimal | 37 synthetic speeches | bid | 13.685 | yes | no |
| minimal | 37 synthetic speeches | wolf chat | 10.093 | yes | yes |

All responses were HTTP 200 with finish reason `stop`. Total reported cost: $0.038138. Schema validity does not imply factual/gameplay quality; synthetic long-context dialogue was deliberately repetitive. Some later calls benefited from prompt caching. This is a small diagnostic, not a reliability benchmark or proof that minimal is faster than low.

Conclusion: both effort settings are accepted and can produce usable actions. Minimal is promising but does not reliably fit the current cadence with longer context: one of four minimal calls exceeded the deadline. The live model settings remain unchanged pending a timing/model decision. A longer Qwen deadline or faster model would need further testing; simply enabling minimal is not sufficient to guarantee participation.

Artifacts: `artifacts/qwen-diagnostic-1789588616064/results.json` and `artifacts/qwen-diagnostic-1789588666785/results.json`.

Reproduce (paid API calls):

```sh
node tools/qwen-diagnostic.mjs
node tools/qwen-diagnostic.mjs --long-context
```

OpenRouter's [reasoning documentation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) describes the effort controls. The model catalog did not list this exact model ID at diagnostic time; acceptance of minimal/low was verified directly by these requests.
