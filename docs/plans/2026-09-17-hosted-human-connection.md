# Hosted human connection implementation plan

Goal: adapt the existing human UI to Coworld's supplied WebSocket address and proxied HTTP paths, preserving local play and seat authentication.

Architecture: follow the bundled Paint Arena client (`address` query parameter, HTTP-to-WebSocket conversion). Serve relative assets beneath `/client/`; accept the authenticated reserved human seat on `/player` as well as the local `/human` alias. Obtain the displayed seat from server messages, not a required browser query token. Keep other policy seats and private-state projection unchanged.

An alternative would rewrite the supplied socket URL to `/human`; that can break the platform's proxy routing. Using the supplied URL unchanged is preferred. Serving assets from the origin root also breaks path-prefixed proxies.

1. Add failing URL tests for local and hosted URLs, preserved proxy query parameters, missing browser seat parameters, invalid protocols, and replay paths.
2. Extend runtime integration tests to connect the human via `/player`, chat, reject bad credentials and duplicate controllers, and reconnect. Keep `/human` compatibility.
3. Implement a URL helper, relative player assets, server-confirmed seat identity, and human routing on `/player`. Keep end-of-game replay links under the same proxy prefix.
4. Build and run tests/typecheck. Exercise a local path-stripping reverse proxy in a browser with eight scripted policies (no paid calls).
5. Document evidence and remaining production validation. Publishing and an actual hosted human episode are separate follow-ups.
