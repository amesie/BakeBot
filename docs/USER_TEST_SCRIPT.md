# Usability test script: 5 users, unaided

**Purpose:** evidence for the Accessibility / Usability NFR in SRS section 10: a customer completes an order in **at most 6 steps** on a low-end Android phone, and **5 out of 5** test users manage it **without help**.

**Who:** 5 people who match KD Pops' customers. Aim for at least 3 learners and 1 teacher, using their own (or a low-end) Android phone. None of them should have seen the site before.

**You need:** the link `https://bake-bot-phi.vercel.app`, this sheet, a timer, and a Kaydee or helper login to cancel the test orders afterwards.

---

## Before you start (read this to each person)

> "We are testing the ordering website, not you. Please think out loud while you use it. I can't help you during the task. If you get completely stuck, tell me and we will stop that task. The order you place is a test order and will be cancelled."

Ask them to use their **own name** and a **real cell number they can see**, or a test number such as `082 000 1111`.

## Tasks

| # | Task (read out exactly) | Success means | Steps it should take |
|---|---|---|---|
| 1 | "Order 3 Funfetti and 2 Belgian Chocolate cake pops to collect at 2nd break on any day next week. You want to pay cash." | Reaches "Thank you! Your order is in." with an order number | 6: open link → consent and age → choose flavours, day, slot, payment, name, number → review → place order → confirmation |
| 2 | "Find out how much a Cookies and Cream cake pop costs." | Says R12 (from the menu or BakeBot) | 1-2 |
| 3 | "Ask the website whether the pops contain nuts." | Uses Ask BakeBot; sees "I'll check with Kaydee" or taps Talk to Kaydee | 2-3 |
| 4 | "Open your order again to check its status." | Opens the status link from the confirmation (or saved link) and sees "Waiting for Kaydee" | 1-2 |

## What to record for each user

| User | Phone model | Task 1 done unaided? (Y/N) | Task 1 time | Steps taken | Where they hesitated | Tasks 2-4 done? | Comments (quote them) |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |

**"Unaided"** means they finished without you pointing, explaining or touching the phone. Re-reading the task aloud is allowed.

## After the test

1. Ask: "On a scale of 1 to 5, how easy was it to order?" and "Was anything confusing?"
2. Kaydee or the helper **declines each test order** in the dashboard (Approve tab → Decline).
3. Write the results into `docs/TEST_REPORT.md` under "Usability test", and add photos or screen recordings if users agreed.

**Pass:** 5/5 users complete Task 1 unaided in 6 steps or fewer.
