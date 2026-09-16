# One all-LLM playtest

Use the benchmark's .env in memory, its default contestant personalities and
player/host prompt builders, and OpenRouter google/gemini-3.7-flash for all nine
seats. Keep authoritative Who Cried Wolf rules and seat-private observations.
Adapt the benchmark's older output format to the current action schema.

For this first behavioral test, use the existing Session with a logical clock:
wait for all model replies for each window, admit them before its logical deadline,
then advance. Provider calls have a 45-second wall-clock bound and one repair
attempt. This tests complete LLM gameplay, not the hosted 8-second latency budget.
Host narration uses only public information and cannot select speakers or resolve
rules. Save host lines, per-call usage/latency, results, and the standard replay.
Credentials never enter saved configs or logs. No scripted actions are substituted
for successful model decisions; failures remain explicit in the run report.
