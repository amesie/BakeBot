# Acceptance test with Kaydee

A scripted session (about 45 minutes) in which Kaydee checks that the system does what the SRS promised. Do it on her phone, with a team member as "customer" on a second phone.

**Before the session:** Kaydee can log in at `https://bake-bot-phi.vercel.app/auth/login`. You have two phones, one test customer number, and this sheet. Everything done here creates real test orders; Kaydee declines them at the end.

Mark each line **Pass**, **Fail** or **Comment**.

## A. Customer ordering (customer phone)

| # | Step | Expected | Requirement | Result |
|---|---|---|---|---|
| A1 | Open the link, scroll to the menu | 4 flavours with the right prices (R15 / R12 / R15 / R10) | REQ-04 | |
| A2 | Tap "Order Now", tap "I don't agree" | "Nothing has been saved" and Kaydee's WhatsApp | REQ-01, POPIA | |
| A3 | Agree, answer "Yes" to under 18 without guardian consent | Cannot continue | Security NFR | |
| A4 | Tick guardian consent, continue, press "Review order" with name and number empty | List of what is missing; nothing sent | REQ-05 | |
| A5 | Order 2 Funfetti for 2nd break, cash, review, place | Order number KDP-…, "Kaydee will confirm after school", status link | REQ-04, 08, 10 | |
| A6 | Switch the language to Afrikaans, then isiXhosa | Whole page changes language | Spec 7.9 | |
| A7 | Turn on flight mode, place another order, turn flight mode off | "Saved on your phone", then the order goes through once | REQ-25, REQ-09 | |
| A8 | Ask BakeBot "How much are the pops?" and "Do they contain nuts?" | Correct prices; "I'll check with Kaydee" for nuts | REQ-21, 22 | |
| A9 | Tap "Talk to Kaydee", leave name and number | "Kaydee will reply on WhatsApp after school" | REQ-23 | |

## B. Kaydee's dashboard (Kaydee's phone)

| # | Step | Expected | Requirement | Result |
|---|---|---|---|---|
| B1 | Log in, open Approve | The test orders are waiting, with name, number and items | REQ-07, 12 | |
| B2 | Search the customer's name | Only their orders show | (owner request) | |
| B3 | Approve one order; tap the WhatsApp button | WhatsApp opens with the confirmation and invoice link; the invoice opens | REQ-12, REQ-14 | |
| B4 | Customer phone: open the status link | "Confirmed", collection day, place (Mrs Felix's class, R129), amount | REQ-12 | |
| B5 | Place a 31-pop order (customer), try to approve without a quote | "Enter a quote before approving"; with a quote it is approved | REQ-07 | |
| B6 | Customer: EFT order approved → send a screenshot as proof | Kaydee sees "Proof uploaded", opens it with "View proof" | REQ-15 | |
| B7 | Mark the order paid | Customer's status page says "Paid" | REQ-17 | |
| B8 | Batch: check the bake list, tap "Mark ready" on one order, confirm the popup | Customer told to collect; WhatsApp ready button appears | REQ-18, D-047, D-048 | |
| B9 | Batch: "Batch delayed?" with a new date | Customers see the new date | REQ-19 | |
| B10 | Payments: mark the ready order "Collected" | Order shows collected | Lifecycle | |
| B11 | Inbox: the Talk-to-Kaydee chat from A9 is there; "Reply on WhatsApp" | WhatsApp opens to the customer's number | REQ-23 | |
| B12 | BakeBot answers: write the allergen answer, switch it on, save | Customer asks about nuts again and gets Kaydee's answer | REQ-22 | |
| B13 | Settings: change the price of Funfetti, then change it back | Menu on the website changes straight away | Spec 4 dashboard | |
| B14 | Helper logs in on her phone | Sees Payments and Batch only; phone numbers masked | Spec 7.8 | |

## C. Things that happen by themselves (check the next day)

| # | Check | Expected | Requirement | Result |
|---|---|---|---|---|
| C1 | After 15:00: Approve tab | "BakeBot updates" summary if orders were waiting | REQ-11 | |
| C2 | After Thursday 20:00 | Bake list for next week in BakeBot updates | REQ-18 | |
| C3 | Day after collecting (B10), after 16:00 | Customer's status page asks for feedback; Kaydee sees it in Feedback | REQ-26 | |

## D. Kaydee's verdict

- Would you use this instead of the notes app, diary and WhatsApp group? Why or why not?
- Does it ask for payment in a way you are comfortable with (as BakeBot, not you)?
- What is the one thing you would change first?

**After the session:** decline all test orders (Approve tab, or Payments for approved ones) and remove the test customer's details in Settings → "Delete a customer's details".

Signed off by Kaydee: ____________________  Date: ____________
