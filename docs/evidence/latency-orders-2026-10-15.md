# Order API latency (2026-10-15)

50 consecutive `POST https://bake-bot-phi.vercel.app/api/orders` from a home connection in South Africa. Vercel function region dub1, Supabase eu-west-1.

| p50 | p95 | max | min | HTTP statuses |
|---|---|---|---|---|
| 242 ms | **277 ms** | 770 ms | 214 ms | 201: 50 |

Target: p95 <= 2,000 ms. **Met.**

All times in order: 770, 277, 260, 243, 250, 247, 233, 216, 251, 231, 242, 222, 254, 246, 245, 245, 248, 220, 246, 217, 236, 255, 214, 223, 222, 238, 225, 225, 233, 238, 248, 230, 238, 255, 252, 253, 255, 235, 221, 248, 254, 216, 252, 300, 252, 241, 219, 218, 245, 227
